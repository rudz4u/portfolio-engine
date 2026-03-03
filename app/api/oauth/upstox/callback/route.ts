import { NextRequest, NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/oauth/upstox/callback
 * Upstox redirects here after the user grants access.
 * This handler:
 *   1. Exchanges the authorization code for an access token
 *   2. Saves the token to user_settings.preferences (JSONB)
 *   3. Redirects to /settings?success=upstox_connected&sync=1
 *      (sync=1 tells the Settings page to auto-trigger /api/upstox/sync client-side,
 *       avoiding a serverless timeout from doing 150+ DB round-trips inline here)
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

  // ── 1. Exchange code for access token ────────────────────────────────────
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

  // ── 2. Identify the logged-in Supabase user ──────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${baseUrl}/signin?next=/settings`)
  }

  // ── 3. Save token to user_settings.preferences JSONB ────────────────────
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

  console.log(`[OAuth callback] Token saved for user ${user.id} — redirect to settings for client-side sync`)

  // ── 4. Redirect — Settings page detects sync=1 and fires /api/upstox/sync ─
  return NextResponse.redirect(`${baseUrl}/settings?success=upstox_connected&sync=1`)
}
