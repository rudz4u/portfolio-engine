/**
 * GET /api/portfolio/refresh-prices?portfolioId=xxx
 *
 * Fetches live LTP for all holdings via Upstox v3 market-quote/ltp.
 *
 * Token resolution order (handled by resolveUpstoxToken):
 *   1. User's personal Upstox OAuth token (user_settings.preferences.upstox_access_token)
 *   2. Server-level UPSTOX_ACCESS_TOKEN env var — covers import-only users with no Upstox account
 *
 * Updates ltp + unrealized_pl for each holding and returns the updated array.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { resolveUpstoxToken } from "@/lib/upstox-token"
import { getUpstoxHeaders } from "@/lib/upstox"

export const maxDuration = 45
export const dynamic = "force-dynamic"

const UPSTOX_LTP_URL = "https://api.upstox.com/v3/market-quote/ltp"

// ── Upstox v3 LTP batch fetch ─────────────────────────────────────────────────

/**
 * Strip broker-export suffixes so the symbol is suitable for NSE_EQ| key construction.
 * e.g. "BHARTIHEXACOM-EQ5/-" → "BHARTIHEXACOM"
 *      "ASHOKLEYLAND-RE.1/-" → "ASHOKLEYLAND"
 *      "WAAREEENERGIES-EQ"   → "WAAREEENERGIES"
 *
 * NSE trading symbols are purely alphanumeric — anything from the first hyphen
 * onward is a broker/series/segment annotation.
 */
function cleanNseSymbol(sym: string): string {
  return sym.split("-")[0].trim().toUpperCase()
}

/**
 * Known ISIN → correct NSE trading symbol overrides.
 * Broker exports sometimes store wrong scrip names; these ensure the right key is built.
 */
const ISIN_SYMBOL_OVERRIDES: Record<string, string> = {
  "INE053F01010": "IRFC",  // Upstox XLSX reports this as "IndianRailway-Eq"
}

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

  // ── Resolve instrument_keys to NSE_EQ|SYMBOL format ─────────────────────
  //
  // Holdings may store:
  //   (a) NSE_EQ|SYMBOL  — already usable, pass through directly
  //   (b) ISIN (INE.../INF...) — canonical identifier, use to look up the
  //       proper trading_symbol via the instruments table's `isin` column,
  //       then construct NSE_EQ|<clean_symbol>
  //   (c) Broker trading symbol with suffix (e.g. "BHARTIHEXACOM-EQ5/-") —
  //       strip the suffix with cleanNseSymbol() and construct NSE_EQ|<sym>
  //
  // Priority for ISIN holdings:
  //   1. instruments.instrument_key if it contains "|" (Upstox-seeded master)
  //   2. instruments.trading_symbol → cleanNseSymbol()  (any row found by ISIN)
  //   3. holding.trading_symbol     → cleanNseSymbol()  (last resort)

  // (a) Holdings already in proper format
  const properKeys = holdings
    .map((h) => h.instrument_key as string)
    .filter((k) => k && k.includes("|") && !k.startsWith("INE") && !k.startsWith("INF"))

  // (b)+(c) Holdings that need resolution
  const needsResolution = holdings.filter(
    (h) => typeof h.instrument_key === "string" &&
      (h.instrument_key.startsWith("INE") || h.instrument_key.startsWith("INF") || !h.instrument_key.includes("|"))
  )

  // Map: DB instrument_key → resolved NSE_EQ|SYMBOL
  const isinToKey = new Map<string, string>()

  if (needsResolution.length > 0) {
    // Separate into ISIN-style vs bare-symbol holdings
    const isinHoldings = needsResolution.filter(
      (h) => (h.instrument_key as string).startsWith("INE") || (h.instrument_key as string).startsWith("INF")
    )
    const symHoldings = needsResolution.filter(
      (h) => !((h.instrument_key as string).startsWith("INE") || (h.instrument_key as string).startsWith("INF"))
    )

    // ── ISIN path: query instruments table by the `isin` column ──────────
    if (isinHoldings.length > 0) {
      const isins = isinHoldings.map((h) => h.instrument_key as string)
      const { data: instrRows } = await admin
        .from("instruments")
        .select("isin, trading_symbol, instrument_key")
        .in("isin", isins)                           // exact isin column match

      // Build ISIN → { properKey?, cleanSymbol } from master data
      const instrByIsin = new Map<string, { instrument_key: string; trading_symbol: string }>()
      for (const row of instrRows ?? []) {
        if (row.isin) instrByIsin.set(row.isin as string, row as { instrument_key: string; trading_symbol: string })
      }

      for (const h of isinHoldings) {
        const isin = h.instrument_key as string

        // Hardcoded override takes absolute priority
        if (ISIN_SYMBOL_OVERRIDES[isin]) {
          isinToKey.set(isin, `NSE_EQ|${ISIN_SYMBOL_OVERRIDES[isin]}`)
          continue
        }

        const master = instrByIsin.get(isin)

        if (master?.instrument_key && (master.instrument_key as string).includes("|")) {
          // Best case: instruments table has a proper Upstox key
          isinToKey.set(isin, master.instrument_key as string)
        } else if (master?.trading_symbol) {
          // Good case: instruments has a clean trading_symbol from master data
          isinToKey.set(isin, `NSE_EQ|${cleanNseSymbol(master.trading_symbol as string)}`)
        } else {
          // Fallback: use the holding's trading_symbol/company_name with suffix stripped
          const rawSym = (h.trading_symbol || h.company_name) as string
          if (rawSym) isinToKey.set(isin, `NSE_EQ|${cleanNseSymbol(rawSym)}`)
        }
      }
    }

    // ── Symbol path: holding already has a trading symbol, just clean it ──
    for (const h of symHoldings) {
      const rawKey = h.instrument_key as string
      const rawSym = (rawKey || h.trading_symbol || h.company_name) as string
      if (rawSym) isinToKey.set(rawKey, `NSE_EQ|${cleanNseSymbol(rawSym)}`)
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

      const { data: updatedRow } = await admin
        .from("holdings")
        .update({ ltp, unrealized_pl })
        .eq("id", h.id)
        .select("*")
        .single()

      if (updatedRow) { updated++; return updatedRow }
      return h
    })
  )

  return NextResponse.json({ holdings: updatedHoldings, updated, source: "upstox_v3" })
}
