/**
 * POST /api/instruments/ltp
 *
 * Fetches last-traded prices for a batch of symbols via Upstox v3 LTP API.
 * Falls back to NSE_EQ segment look-up from the instruments table when no
 * proper instrument_key is supplied.
 *
 * Body: { symbols?: [{ trading_symbol, isin? }], instrument_keys?: string[] }
 * Response: { prices: { "RELIANCE": 2450.50, ... }, errors: { "XYZ": "Not found" } }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/server"
import { resolveUpstoxToken } from "@/lib/upstox-token"
import { getUpstoxHeaders } from "@/lib/upstox"

export const maxDuration = 30
export const dynamic = "force-dynamic"

const MAX_SYMBOLS = 50
const UPSTOX_LTP_URL = "https://api.upstox.com/v3/market-quote/ltp"

// ── In-process price cache ────────────────────────────────────────────────────
const priceCache = new Map<string, { price: number; at: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCached(key: string): number | null {
  const entry = priceCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) { priceCache.delete(key); return null }
  return entry.price
}
function setCache(key: string, price: number) {
  priceCache.set(key, { price, at: Date.now() })
}

// Strip broker-format suffixes like "-EQ5/-", "-RE.1/-", "-EQ" from trading symbols
function cleanNseSymbol(sym: string): string {
  return sym.split("-")[0].trim().toUpperCase()
}

// ── Upstox v3 LTP batch fetch ─────────────────────────────────────────────────
// instrument_keys must be in "NSE_EQ|SYMBOL" format (pipe-separated).
// Response keys use ":" separator: "NSE_EQ:SYMBOL".
async function fetchUpstoxLtp(
  instrumentKeys: string[],
  token: string,
): Promise<Record<string, number>> {
  if (instrumentKeys.length === 0) return {}
  try {
    const keyParam = instrumentKeys.map((k) => encodeURIComponent(k)).join(",")
    const url = `${UPSTOX_LTP_URL}?instrument_key=${keyParam}`
    const res = await fetch(url, {
      headers: getUpstoxHeaders(token),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      console.warn(`[ltp] Upstox v3 LTP ${res.status}: ${txt.slice(0, 200)}`)
      return {}
    }
    const json = await res.json()
    const map: Record<string, number> = {}
    for (const [key, val] of Object.entries(json?.data ?? {})) {
      // key comes back as "NSE_EQ:RELIANCE" — extract the symbol part
      const sym = key.includes(":") ? key.split(":")[1] : key.split("|")[1] ?? key
      const price = (val as { last_price?: number })?.last_price
      if (sym && price && price > 0) map[sym.toUpperCase()] = price
    }
    return map
  } catch (err) {
    console.warn("[ltp] Upstox v3 LTP fetch error:", err)
    return {}
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
    symbols?: { trading_symbol: string; isin?: string }[]
    instrument_keys?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Build a unified list of { symbol (uppercase), instrument_key }
  // instrument_key may be supplied directly (e.g. "NSE_EQ|RELIANCE") or looked up from symbols
  const symbolToKey = new Map<string, string>()

  // Accept direct instrument_keys (already in NSE_EQ|SYMBOL format)
  for (const ik of body.instrument_keys ?? []) {
    const sym = ik.includes("|") ? ik.split("|")[1].toUpperCase() : ik.toUpperCase()
    symbolToKey.set(sym, ik)
  }

  // For symbols without keys, try the instruments table first
  const symbolsNeedingKey: { trading_symbol: string; isin?: string }[] = []
  for (const s of body.symbols ?? []) {
    const sym = s.trading_symbol?.toUpperCase().trim()
    if (!sym) continue
    if (!symbolToKey.has(sym)) symbolsNeedingKey.push(s)
  }

  if (symbolsNeedingKey.length > 0) {
    try {
      const admin = await createAdminClient()

      // ── ISIN-based lookup (most reliable) ───────────────────────────────
      // Query by isin column so import-seeded self-referential rows are handled
      const isins = symbolsNeedingKey.map((s) => s.isin).filter(Boolean) as string[]
      if (isins.length > 0) {
        const { data: rows } = await admin
          .from("instruments")
          .select("trading_symbol, instrument_key, isin")
          .in("isin", isins)
          .limit(MAX_SYMBOLS)

        // ISIN → resolved NSE_EQ|SYMBOL
        const isinKeyMap = new Map<string, string>()
        for (const row of rows ?? []) {
          if (!row.isin) continue
          const ik = row.instrument_key as string
          isinKeyMap.set(
            row.isin as string,
            ik?.includes("|") ? ik : `NSE_EQ|${cleanNseSymbol((row.trading_symbol as string) ?? "")}`,
          )
        }

        for (const s of symbolsNeedingKey) {
          const sym = s.trading_symbol?.toUpperCase().trim()
          if (sym && s.isin && isinKeyMap.has(s.isin)) {
            symbolToKey.set(sym, isinKeyMap.get(s.isin)!)
          }
        }
      }

      // ── Clean-symbol lookup for anything still unresolved ───────────────
      const stillMissing = symbolsNeedingKey.filter(
        (s) => !symbolToKey.has(s.trading_symbol?.toUpperCase().trim() ?? "")
      )
      if (stillMissing.length > 0) {
        const cleanSyms = [...new Set(stillMissing.map((s) => cleanNseSymbol(s.trading_symbol)))]
        const { data: rows } = await admin
          .from("instruments")
          .select("trading_symbol, instrument_key")
          .in("trading_symbol", cleanSyms)
          .limit(MAX_SYMBOLS)
        for (const row of rows ?? []) {
          const sym = (row.trading_symbol as string)?.toUpperCase()
          const ik = row.instrument_key as string
          if (sym && ik?.includes("|")) symbolToKey.set(sym, ik)
        }
      }
    } catch (err) {
      console.warn("[ltp] Instruments table look-up failed:", err)
    }
  }

  // For anything still without a key, synthesise NSE_EQ|cleanSymbol
  for (const s of symbolsNeedingKey) {
    const sym = s.trading_symbol?.toUpperCase().trim()
    if (sym && !symbolToKey.has(sym)) symbolToKey.set(sym, `NSE_EQ|${cleanNseSymbol(sym)}`)
  }

  const allSymbols = [...symbolToKey.keys()].slice(0, MAX_SYMBOLS)
  const prices: Record<string, number> = {}
  const errors: Record<string, string> = {}

  // Serve from cache first
  const uncachedSymbols: string[] = []
  for (const sym of allSymbols) {
    const cached = getCached(sym)
    if (cached !== null) prices[sym] = cached
    else uncachedSymbols.push(sym)
  }

  if (uncachedSymbols.length === 0) {
    return NextResponse.json({ prices, errors, source: "cache" })
  }

  const upstoxToken = await resolveUpstoxToken()
  if (!upstoxToken) {
    for (const sym of uncachedSymbols) errors[sym] = "No Upstox token"
    return NextResponse.json({ prices, errors, source: "none" })
  }

  // Batch into groups of 50 (Upstox limit per request)
  const BATCH = 50
  for (let i = 0; i < uncachedSymbols.length; i += BATCH) {
    const batch = uncachedSymbols.slice(i, i + BATCH)
    const keys = batch.map((sym) => symbolToKey.get(sym)!).filter(Boolean)
    const result = await fetchUpstoxLtp(keys, upstoxToken)
    for (const sym of batch) {
      if (result[sym] !== undefined) {
        prices[sym] = result[sym]
        setCache(sym, result[sym])
      } else {
        errors[sym] = "Price unavailable"
      }
    }
  }

  return NextResponse.json({ prices, errors, source: "upstox_v3" })
}
