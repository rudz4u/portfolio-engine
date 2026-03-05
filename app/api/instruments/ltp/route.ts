/**
 * POST /api/instruments/ltp
 *
 * Fetches current/last-traded prices for a batch of symbols.
 * Used during portfolio import when LTP is absent from the broker export.
 *
 * Primary source : Yahoo Finance (unofficial, no auth required)
 *   URL: https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}.NS
 *   Tries .NS (NSE) first, then .BO (BSE) for unlisted symbols.
 *
 * Fallback       : Upstox market-quote API (only if user has OAuth token)
 *
 * Body  : { symbols: [{ trading_symbol: string, isin?: string }] }
 * Response: { prices: { "RELIANCE": 2450.50, ... }, errors: { "XYZ": "Not found" } }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveUpstoxToken } from "@/lib/upstox-token"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"

export const maxDuration = 30
export const dynamic = "force-dynamic"

const MAX_SYMBOLS = 50

// ── Simple in-process cache (survives across requests in the same Lambda warm instance) ──
const priceCache = new Map<string, { price: number; at: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

function getCached(symbol: string): number | null {
  const entry = priceCache.get(symbol)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    priceCache.delete(symbol)
    return null
  }
  return entry.price
}

function setCache(symbol: string, price: number) {
  priceCache.set(symbol, { price, at: Date.now() })
}

// ── Yahoo Finance fetch ────────────────────────────────────────────────────────

async function fetchYahooPrice(symbol: string): Promise<number | null> {
  const suffixes = ["NS", "BO"] // NSE first, then BSE
  for (const suffix of suffixes) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.${suffix}?interval=1d&range=1d`
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; portfolio-engine/1.0)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000), // 5-second timeout per symbol
      })
      if (!res.ok) continue
      const json = await res.json()
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta) continue
      const price: number =
        meta.regularMarketPrice ??
        meta.previousClose ??
        meta.chartPreviousClose
      if (price && price > 0) return price
    } catch {
      // try next suffix
    }
  }
  return null
}

// ── Upstox market-quote fetch (batch, NSE_EQ segment assumed) ─────────────────

async function fetchUpstoxPrices(
  symbols: string[],
  token: string
): Promise<Record<string, number>> {
  const keys = symbols.map((s) => `NSE_EQ|${s}`).join(",")
  try {
    const url = `${UPSTOX_CONFIG.baseUrl}/market-quote/quotes?instrument_key=${encodeURIComponent(keys)}`
    const res = await fetch(url, {
      headers: getUpstoxHeaders(token),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return {}
    const json = await res.json()
    const map: Record<string, number> = {}
    for (const [key, val] of Object.entries(json?.data ?? {})) {
      // key is like "NSE_EQ:RELIANCE"
      const sym = key.split(":")[1] || key.split("|")[1] || key
      const price = (val as Record<string, number>)?.last_price
      if (sym && price && price > 0) map[sym] = price
    }
    return map
  } catch {
    return {}
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { symbols?: { trading_symbol: string; isin?: string }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const symbolsInput = body.symbols ?? []
  if (!Array.isArray(symbolsInput) || symbolsInput.length === 0) {
    return NextResponse.json({ prices: {}, errors: {} })
  }

  // Deduplicate + clamp
  const symbols = [
    ...new Set(
      symbolsInput
        .map((s) => s.trading_symbol?.toUpperCase().trim())
        .filter(Boolean) as string[]
    ),
  ].slice(0, MAX_SYMBOLS)

  const prices: Record<string, number> = {}
  const errors: Record<string, string> = {}

  // Serve anything already cached
  const uncached: string[] = []
  for (const sym of symbols) {
    const cached = getCached(sym)
    if (cached !== null) {
      prices[sym] = cached
    } else {
      uncached.push(sym)
    }
  }

  if (uncached.length === 0) {
    return NextResponse.json({ prices, errors, source: "cache" })
  }

  // ── Try Upstox first if the user has an OAuth token ──
  const upstoxToken = await resolveUpstoxToken()
  let resolvedViaUpstox = 0
  if (upstoxToken) {
    const upstoxPrices = await fetchUpstoxPrices(uncached, upstoxToken)
    for (const sym of uncached) {
      if (upstoxPrices[sym] !== undefined) {
        prices[sym] = upstoxPrices[sym]
        setCache(sym, upstoxPrices[sym])
        resolvedViaUpstox++
      }
    }
  }

  // ── Yahoo Finance for anything Upstox didn't cover ──
  const stillMissing = uncached.filter((s) => prices[s] === undefined)

  // Fetch in parallel but throttle to 10 concurrent to avoid rate limits
  const CONCURRENCY = 10
  for (let i = 0; i < stillMissing.length; i += CONCURRENCY) {
    const batch = stillMissing.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (sym) => {
        const price = await fetchYahooPrice(sym)
        return { sym, price }
      })
    )
    for (const result of results) {
      if (result.status === "fulfilled") {
        const { sym, price } = result.value
        if (price !== null && price > 0) {
          prices[sym] = price
          setCache(sym, price)
        } else {
          errors[sym] = "Price unavailable"
        }
      } else {
        errors[result.reason?.sym ?? "unknown"] = "Fetch failed"
      }
    }
  }

  const source =
    resolvedViaUpstox > 0
      ? stillMissing.length === 0
        ? "upstox"
        : "upstox+yahoo"
      : "yahoo"

  return NextResponse.json({ prices, errors, source })
}
