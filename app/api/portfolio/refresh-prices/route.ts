/**
 * GET /api/portfolio/refresh-prices?portfolioId=xxx
 *
 * Fetches live LTP for all holdings via Upstox v3 market-quote/ltp.
 *
 * Token resolution order (handled by resolveUpstoxToken):
 *   1. User's personal Upstox OAuth token (user_settings.preferences.upstox_access_token)
 *   2. Server-level UPSTOX_ACCESS_TOKEN env var — covers import-only users with no Upstox account
 *
 * Updates ltp, unrealized_pl, current_value for each holding and returns the updated array.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { resolveUpstoxToken } from "@/lib/upstox-token"
import { getUpstoxHeaders } from "@/lib/upstox"

export const maxDuration = 45
export const dynamic = "force-dynamic"

const UPSTOX_LTP_URL = "https://api.upstox.com/v3/market-quote/ltp"

// ── Upstox v3 LTP batch fetch ─────────────────────────────────────────────────

async function fetchUpstoxLtp(
  instrumentKeys: string[],
  token: string,
): Promise<Record<string, number>> {
  if (instrumentKeys.length === 0) return {}
  const BATCH = 50
  const result: Record<string, number> = {}

  for (let i = 0; i < instrumentKeys.length; i += BATCH) {
    const batch = instrumentKeys.slice(i, i + BATCH)
    try {
      const keyParam = batch.map((k) => encodeURIComponent(k)).join(",")
      const res = await fetch(`${UPSTOX_LTP_URL}?instrument_key=${keyParam}`, {
        headers: getUpstoxHeaders(token),
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) {
        console.warn(`[refresh-prices] Upstox LTP ${res.status}`)
        continue
      }
      const json = await res.json()
      for (const [key, val] of Object.entries(json?.data ?? {})) {
        // Response key: "NSE_EQ:RELIANCE" — normalise to "NSE_EQ|RELIANCE"
        const normKey = key.replace(":", "|")
        const price = (val as { last_price?: number })?.last_price
        if (normKey && price && price > 0) result[normKey] = price
      }
    } catch (err) {
      console.warn("[refresh-prices] Upstox batch error:", err)
    }
  }
  return result
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const portfolioId = searchParams.get("portfolioId")
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId is required" }, { status: 400 })
  }

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify portfolio ownership
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .single()
  if (!portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 })
  }

  const admin = await createAdminClient()

  // Fetch current holdings
  const { data: holdings, error: holdingsError } = await admin
    .from("holdings")
    .select("*")
    .eq("portfolio_id", portfolioId)

  if (holdingsError || !holdings?.length) {
    return NextResponse.json({ holdings: [], updated: 0 })
  }

  // ── Resolve instrument_keys ────────────────────────────────────────────────
  // Holdings may carry a proper NSE_EQ|SYMBOL key or a bare ISIN/symbol.
  // Upstox v3 requires the NSE_EQ|SYMBOL format.

  const properKeys = holdings
    .map((h) => h.instrument_key as string)
    .filter((k) => k && k.includes("|") && !k.startsWith("INE") && !k.startsWith("INF"))

  const needsResolution = holdings.filter(
    (h) => typeof h.instrument_key === "string" &&
      (h.instrument_key.startsWith("INE") || h.instrument_key.startsWith("INF") || !h.instrument_key.includes("|"))
  )

  // Map: original instrument_key stored in DB → proper NSE_EQ|SYMBOL key
  const isinToKey = new Map<string, string>()

  if (needsResolution.length > 0) {
    const isins = needsResolution
      .map((h) => h.instrument_key as string)
      .filter((k) => k.startsWith("INE") || k.startsWith("INF"))
    const tradingSymbols = needsResolution
      .map((h) => (h.trading_symbol || h.company_name) as string)
      .filter(Boolean)

    const qParts: string[] = []
    if (isins.length > 0) qParts.push(`isin.in.(${isins.join(",")})`)
    if (tradingSymbols.length > 0) qParts.push(`trading_symbol.in.(${tradingSymbols.join(",")})`)

    if (qParts.length > 0) {
      const { data: instrRows } = await admin
        .from("instruments")
        .select("isin, trading_symbol, instrument_key")
        .or(qParts.join(","))

      for (const row of instrRows ?? []) {
        if (row.isin && row.instrument_key) isinToKey.set(row.isin as string, row.instrument_key as string)
        if (row.trading_symbol && row.instrument_key) isinToKey.set(row.trading_symbol as string, row.instrument_key as string)
      }
    }

    // Synthesise NSE_EQ|SYMBOL for anything the DB didn't cover
    for (const h of needsResolution) {
      const ik = h.instrument_key as string
      if (!isinToKey.has(ik)) {
        const sym = (h.trading_symbol || h.company_name) as string
        if (sym) isinToKey.set(ik, `NSE_EQ|${sym.toUpperCase()}`)
      }
    }
  }

  const resolvedKeys = [
    ...properKeys,
    ...needsResolution
      .map((h) => isinToKey.get(h.instrument_key as string))
      .filter(Boolean) as string[],
  ]
  const uniqueKeys = [...new Set(resolvedKeys)]

  if (uniqueKeys.length === 0) {
    return NextResponse.json({ holdings, updated: 0 })
  }

  // ── Fetch prices via Upstox v3 ────────────────────────────────────────────
  // resolveUpstoxToken() returns the user's OAuth token first, then falls back
  // to the server-level UPSTOX_ACCESS_TOKEN env var — so import-only users
  // (no personal Upstox account) still get live prices via the app token.
  const upstoxToken = await resolveUpstoxToken()
  if (!upstoxToken) {
    return NextResponse.json({
      holdings,
      updated: 0,
      message: "Live prices unavailable — no Upstox token configured.",
    })
  }

  const ltpMap = await fetchUpstoxLtp(uniqueKeys, upstoxToken)

  if (Object.keys(ltpMap).length === 0) {
    return NextResponse.json({ holdings, updated: 0, message: "Upstox returned no prices" })
  }

  // ── Update holdings in DB ──────────────────────────────────────────────────
  let updated = 0
  const updatedHoldings = await Promise.all(
    holdings.map(async (h) => {
      let key = h.instrument_key as string
      if (isinToKey.has(key)) key = isinToKey.get(key)!

      const ltp = ltpMap[key]
      if (!ltp || ltp <= 0) return h

      const qty = (h.quantity as number) ?? 0
      const avg = (h.avg_price as number) ?? 0
      const unrealized_pl = qty > 0 && avg > 0 ? (ltp - avg) * qty : 0
      const current_value = qty * ltp

      const { data: updatedRow } = await admin
        .from("holdings")
        .update({ ltp, unrealized_pl, current_value })
        .eq("id", h.id)
        .select("*")
        .single()

      if (updatedRow) { updated++; return updatedRow }
      return h
    })
  )

  return NextResponse.json({ holdings: updatedHoldings, updated, source: "upstox_v3" })
}
