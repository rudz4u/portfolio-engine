import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"
import { recordPortfolioSnapshot } from "@/lib/portfolio-snapshot"

export const dynamic = "force-dynamic"
// Increase to 60 s — syncing many users can take a while
export const maxDuration = 60

/**
 * POST /api/cron/sync-all
 * Service-role-protected. Called by the Netlify scheduled function every
 * weekday morning (4:30 AM UTC / 10:00 AM IST) to refresh Upstox holdings
 * for every user who has an upstox_access_token stored in their preferences.
 *
 * Also accepts env UPSTOX_ACCESS_TOKEN as a fallback shared token.
 *
 * Header required: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!supabaseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL not set" }, { status: 500 })
  }

  const admin = createServiceClient(supabaseUrl, serviceKey)
  const envToken = process.env.UPSTOX_ACCESS_TOKEN ?? ""

  // ── Fetch all user_settings rows ──────────────────────────────────────────
  const { data: allSettings, error: sErr } = await admin
    .from("user_settings")
    .select("user_id, preferences")

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  // Collect users that have a token (own key OR shared env token)
  const usersToSync: { userId: string; token: string }[] = []
  for (const row of allSettings ?? []) {
    const prefs = (row.preferences as Record<string, string>) || {}
    const token = prefs.upstox_access_token || envToken
    if (token) usersToSync.push({ userId: row.user_id as string, token })
  }

  if (usersToSync.length === 0) {
    return NextResponse.json({ status: "ok", message: "No users with Upstox token", synced: 0, errors: 0 })
  }

  let synced = 0
  let errored = 0
  const results: Array<{ userId: string; status: string; count?: number; error?: string }> = []

  for (const { userId, token } of usersToSync) {
    try {
      // Fetch holdings from Upstox
      const res = await fetch(`${UPSTOX_CONFIG.baseUrl}/portfolio/long-term-holdings`, {
        headers: getUpstoxHeaders(token),
        cache: "no-store",
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        results.push({ userId, status: "error", error: `Upstox ${res.status}: ${JSON.stringify(errData)}` })
        errored++
        continue
      }

      const data = await res.json()
      const upstoxHoldings: Record<string, unknown>[] = data.data ?? []

      if (upstoxHoldings.length === 0) {
        results.push({ userId, status: "skipped", count: 0 })
        continue
      }

      // Ensure users row exists (portfolios FK → users.id until migration 006 is fully applied)
      const { data: authUser } = await admin.auth.admin.getUserById(userId)
      await admin
        .from("users")
        .upsert({ id: userId, email: authUser?.user?.email ?? "" }, { onConflict: "id" })

      // Ensure portfolio row
      let { data: portfolio } = await admin
        .from("portfolios")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle()

      if (!portfolio) {
        const { data: newPort } = await admin
          .from("portfolios")
          .insert({ user_id: userId, source: "upstox", meta: {}, fetched_at: new Date().toISOString() })
          .select("id")
          .single()
        portfolio = newPort
      } else {
        await admin
          .from("portfolios")
          .update({ fetched_at: new Date().toISOString() })
          .eq("id", portfolio!.id)
      }

      if (!portfolio) {
        results.push({ userId, status: "error", error: "Could not create/find portfolio" })
        errored++
        continue
      }

      // Preserve user-set segments
      const { data: existingRows } = await admin
        .from("holdings")
        .select("instrument_key, segment")
        .eq("portfolio_id", portfolio.id)
      const segmentMap = new Map<string, string | null>(
        (existingRows ?? []).map((r) => [r.instrument_key as string, r.segment as string | null])
      )

      // Build instruments upsert array
      const instruments = upstoxHoldings.map((h) => {
        const isin        = (h.isin as string) || ""
        const symbol      = (h.trading_symbol as string) || (h.tradingsymbol as string) || isin
        const companyName = (h.company_name as string) || symbol
        const instKey     = (h.instrument_key as string) || symbol
        return {
          instrument_key: instKey,
          trading_symbol: symbol,
          name: companyName,
          isin,
          exchange: (h.exchange as string) || "",
          segment: (h.instrument_type as string) || (h.segment as string) || "",
          metadata: h,
        }
      })

      // Build holdings payload (preserve user-set segments)
      const holdingsPayload = upstoxHoldings.map((h) => {
        const isin        = (h.isin as string) || ""
        const symbol      = (h.trading_symbol as string) || (h.tradingsymbol as string) || isin
        const companyName = (h.company_name as string) || symbol
        const instKey     = (h.instrument_key as string) || symbol
        const qty         = (h.quantity as number) || 0
        const avgPrice    = (h.average_price as number) || 0
        const derived     = (h.instrument_type as string) || null
        const segment = segmentMap.has(instKey)
          ? (segmentMap.get(instKey) ?? derived)
          : derived
        return {
          portfolio_id:    portfolio!.id,
          instrument_key:  instKey,
          trading_symbol:  symbol,
          company_name:    companyName,
          quantity:        qty,
          avg_price:       avgPrice,
          invested_amount: qty * avgPrice,
          ltp:             (h.last_price as number) || 0,
          unrealized_pl:   (h.pnl as number) || 0,
          segment,
          raw:             h,
        }
      })

      // Upsert instruments (admin bypasses RLS no-mutation policy)
      await admin
        .from("instruments")
        .upsert(instruments, { onConflict: "instrument_key" })

      // Delete + re-insert holdings
      await admin.from("holdings").delete().eq("portfolio_id", portfolio.id)
      const { error: insErr } = await admin.from("holdings").insert(holdingsPayload)

      if (insErr) {
        results.push({ userId, status: "error", error: insErr.message })
        errored++
      } else {
        // Record daily snapshot (non-fatal)
        await recordPortfolioSnapshot(admin, {
          portfolioId: portfolio.id,
          userId,
          holdings:    holdingsPayload,
        })
        results.push({ userId, status: "ok", count: holdingsPayload.length })
        synced++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ userId, status: "error", error: msg })
      errored++
    }
  }

  console.log(`[sync-all] Done. synced=${synced} errors=${errored}`)
  return NextResponse.json({ status: "ok", synced, errors: errored, results })
}
