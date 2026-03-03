import { NextRequest, NextResponse } from "next/server"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/oauth/upstox/callback
 * Upstox redirects here after the user grants access.
 * This handler:
 *   1. Exchanges the authorization code for an access token
 *   2. Saves the token to user_settings.preferences (JSONB)
 *   3. Immediately syncs the user's Upstox portfolio into the DB
 *   4. Redirects to /settings?success=upstox_connected
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const baseUrl = new URL(request.url).origin

  if (error || !code) {
    console.error("[OAuth callback] Upstox returned error:", error)
    return NextResponse.redirect(
      `${baseUrl}/settings?error=upstox_auth_failed&message=${encodeURIComponent(
        error || "No authorisation code returned"
      )}`
    )
  }

  // ── 1. Exchange code for access token ─────────────────────────────────────
  const redirectUri =
    UPSTOX_CONFIG.redirectUri ||
    "https://brokerai.rudz.in/api/oauth/upstox/callback"

  let accessToken: string
  try {
    const tokenRes = await fetch(UPSTOX_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: UPSTOX_CONFIG.clientId,
        client_secret: UPSTOX_CONFIG.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[OAuth callback] Token exchange failed:", tokenData)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=token_exchange_failed&message=${encodeURIComponent(
          tokenData.message || "Token exchange failed"
        )}`
      )
    }

    accessToken = tokenData.access_token
  } catch (err) {
    console.error("[OAuth callback] Token fetch threw:", err)
    return NextResponse.redirect(`${baseUrl}/settings?error=token_fetch_error`)
  }

  // ── 2. Identify the logged-in Supabase user ────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // User's session expired — send them to sign-in, they can reconnect after
    return NextResponse.redirect(`${baseUrl}/signin?next=/settings`)
  }

  // ── 3. Save token to user_settings.preferences JSONB ─────────────────────
  const { data: existing } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  const prefs: Record<string, string> =
    ((existing?.preferences as Record<string, string>) ?? {})

  prefs.upstox_access_token = accessToken

  const { error: saveError } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      preferences: prefs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )

  if (saveError) {
    console.error("[OAuth callback] Failed to save token:", saveError)
    return NextResponse.redirect(`${baseUrl}/settings?error=save_token_failed`)
  }

  console.log(`[OAuth callback] Saved access token for user ${user.id}`)

  // ── 4. Auto-sync portfolio ─────────────────────────────────────────────────
  try {
    // Fetch holdings from Upstox
    const holdingsRes = await fetch(
      `${UPSTOX_CONFIG.baseUrl}/portfolio/long-term-holdings`,
      { headers: getUpstoxHeaders(accessToken), next: { revalidate: 0 } }
    )
    const holdingsData = await holdingsRes.json()

    if (holdingsRes.ok) {
      const upstoxHoldings: Record<string, unknown>[] =
        holdingsData.data || []

      // Get or create portfolio row
      let { data: portfolio } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", user.id)
        .single()

      if (!portfolio) {
        const { data: newPortfolio } = await supabase
          .from("portfolios")
          .insert({
            user_id: user.id,
            source: "upstox",
            meta: {},
            fetched_at: new Date().toISOString(),
          })
          .select("id")
          .single()
        portfolio = newPortfolio
      } else {
        await supabase
          .from("portfolios")
          .update({ fetched_at: new Date().toISOString() })
          .eq("id", portfolio.id)
      }

      if (portfolio) {
        let synced = 0
        for (const h of upstoxHoldings) {
          const isin = h.isin as string
          const symbol = (h.trading_symbol as string) || isin
          const instrumentKey = (h.instrument_token as string) || symbol

          await supabase
            .from("instruments")
            .upsert(
              {
                instrument_key: instrumentKey,
                trading_symbol: symbol,
                name: h.company_name as string,
                isin,
                exchange: h.exchange as string,
                metadata: {},
              },
              { onConflict: "instrument_key" }
            )

          const { data: existingHolding } = await supabase
            .from("holdings")
            .select("id")
            .eq("portfolio_id", portfolio.id)
            .eq("instrument_key", instrumentKey)
            .single()

          const holdingData = {
            portfolio_id: portfolio.id,
            instrument_key: instrumentKey,
            quantity: h.quantity as number,
            avg_price: h.average_price as number,
            invested_amount: (h.quantity as number) * (h.average_price as number),
            ltp: h.last_price as number,
            unrealized_pl: h.pnl as number,
            raw: h,
          }

          if (existingHolding) {
            await supabase
              .from("holdings")
              .update(holdingData)
              .eq("id", existingHolding.id)
          } else {
            await supabase.from("holdings").insert(holdingData)
          }
          synced++
        }

        console.log(
          `[OAuth callback] Auto-synced ${synced} holdings for user ${user.id}`
        )
      }
    } else {
      // Non-fatal: token saved, sync just didn't run
      console.warn("[OAuth callback] Holdings fetch failed:", holdingsData)
    }
  } catch (syncErr) {
    // Non-fatal: we already saved the token; user can manually sync later
    console.warn("[OAuth callback] Auto-sync threw (non-fatal):", syncErr)
  }

  // ── 5. Redirect to settings with success ──────────────────────────────────
  return NextResponse.redirect(
    `${baseUrl}/settings?success=upstox_connected`
  )
}
