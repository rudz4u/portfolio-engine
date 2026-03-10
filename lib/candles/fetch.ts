/**
 * Upstox Historical Candle Data V3 — Fetch Utility
 *
 * Fetches OHLCV candle data from Upstox for any instrument across
 * multiple timeframes. Used for technical analysis & pattern detection.
 *
 * API: GET /v3/historical-candle/:instrument_key/:unit/:interval/:to_date/:from_date
 * Response candle tuple: [timestamp, open, high, low, close, volume, oi]
 */

import { getUpstoxHeaders } from "@/lib/upstox"
import type { CandleData } from "./types"

const UPSTOX_BASE = "https://api.upstox.com/v3"

// ── In-process candle cache ───────────────────────────────────────────────────
// Key: `${instrumentKey}|${unit}|${interval}|${from}|${to}`
// Past-date daily/weekly/monthly candles are immutable, so we cache aggressively.
const candleCache = new Map<string, { data: CandleData[]; at: number }>()

/** TTL in ms — 5 min for intraday, 1 hour for daily+, since past candles don't change */
function cacheTtl(unit: string): number {
  if (unit === "minutes" || unit === "hours") return 5 * 60 * 1000
  return 60 * 60 * 1000
}

function getCached(key: string, unit: string): CandleData[] | null {
  const entry = candleCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > cacheTtl(unit)) { candleCache.delete(key); return null }
  return entry.data
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_UNITS = ["minutes", "hours", "days", "weeks", "months"] as const
type Unit = typeof VALID_UNITS[number]

interface FetchCandleOptions {
  instrumentKey: string
  unit: Unit
  interval: number
  toDate: string   // YYYY-MM-DD
  fromDate: string // YYYY-MM-DD
  accessToken: string
}

function validateOptions(opts: FetchCandleOptions): string | null {
  if (!VALID_UNITS.includes(opts.unit)) {
    return `Invalid unit: ${opts.unit}. Must be one of: ${VALID_UNITS.join(", ")}`
  }
  if (opts.unit === "minutes" && (opts.interval < 1 || opts.interval > 300)) {
    return "Minutes interval must be 1–300"
  }
  if (opts.unit === "hours" && (opts.interval < 1 || opts.interval > 5)) {
    return "Hours interval must be 1–5"
  }
  if ((opts.unit === "days" || opts.unit === "weeks" || opts.unit === "months") && opts.interval !== 1) {
    return `${opts.unit} interval must be 1`
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.toDate) || !/^\d{4}-\d{2}-\d{2}$/.test(opts.fromDate)) {
    return "Dates must be in YYYY-MM-DD format"
  }
  return null
}

// ── Upstox raw candle tuple: [timestamp, open, high, low, close, volume, oi]
type RawCandle = [string, number, number, number, number, number, number]

function parseCandleData(raw: RawCandle[]): CandleData[] {
  return raw.map(([timestamp, open, high, low, close, volume, oi]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    oi,
  }))
}

// ── Main fetch function ───────────────────────────────────────────────────────

export async function fetchCandleData(opts: FetchCandleOptions): Promise<CandleData[]> {
  const validation = validateOptions(opts)
  if (validation) throw new Error(validation)

  const cacheKey = `${opts.instrumentKey}|${opts.unit}|${opts.interval}|${opts.fromDate}|${opts.toDate}`
  const cached = getCached(cacheKey, opts.unit)
  if (cached) return cached

  const encodedKey = encodeURIComponent(opts.instrumentKey)
  const url = `${UPSTOX_BASE}/historical-candle/${encodedKey}/${opts.unit}/${opts.interval}/${opts.toDate}/${opts.fromDate}`

  const res = await fetch(url, {
    headers: getUpstoxHeaders(opts.accessToken),
    cache: "no-store",
  })

  const json = await res.json()

  if (!res.ok || !Array.isArray(json?.data?.candles)) {
    const msg = json?.errors?.[0]?.message ?? json?.message ?? `Upstox API error (${res.status})`
    throw new Error(msg)
  }

  const candles = parseCandleData(json.data.candles as RawCandle[])
  // Upstox returns newest-first; reverse to chronological (oldest-first) for indicators
  candles.reverse()

  candleCache.set(cacheKey, { data: candles, at: Date.now() })
  return candles
}

// ── Batch fetch for multiple instruments ──────────────────────────────────────

export interface BatchCandleResult {
  instrumentKey: string
  candles: CandleData[]
  error?: string
}

/**
 * Fetches candle data for multiple instruments with controlled concurrency.
 * Processes in batches of `concurrency` to avoid Upstox rate limits.
 */
export async function fetchCandleDataBatch(
  instrumentKeys: string[],
  unit: Unit,
  interval: number,
  toDate: string,
  fromDate: string,
  accessToken: string,
  concurrency = 5,
): Promise<BatchCandleResult[]> {
  const results: BatchCandleResult[] = []

  for (let i = 0; i < instrumentKeys.length; i += concurrency) {
    const batch = instrumentKeys.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(
      batch.map(async (instrumentKey) => {
        const candles = await fetchCandleData({
          instrumentKey,
          unit,
          interval,
          toDate,
          fromDate,
          accessToken,
        })
        return { instrumentKey, candles }
      }),
    )

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value)
      } else {
        // Extract instrument key from the error context
        const key = batch[batchResults.indexOf(result)]
        results.push({
          instrumentKey: key,
          candles: [],
          error: result.reason?.message ?? "Unknown error",
        })
      }
    }

    // Small delay between batches to be respectful to rate limits
    if (i + concurrency < instrumentKeys.length) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  return results
}
