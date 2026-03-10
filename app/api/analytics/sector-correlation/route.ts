import { NextRequest, NextResponse } from "next/server"
import { getUpstoxHeaders } from "@/lib/upstox"
import { resolveUpstoxToken } from "@/lib/upstox-token"

/**
 * GET /api/analytics/sector-correlation?segments=BFSI,IT,Auto,...
 *
 * Fetches 90 days of daily candle data for the Nifty sector index that
 * corresponds to each requested segment, then returns pairwise Pearson
 * correlation of daily close-to-close returns.
 *
 * Response: { labels: string[], matrix: number[][] }
 *   - labels[i]     — segment name shown in the UI
 *   - matrix[i][j] — Pearson r in [-1, 1] between segments i and j
 *
 * Segments with no matching index, or whose Upstox fetch fails, are silently
 * omitted.  The diagonal is always 1.
 */

// Mapping from portfolio segment names → Nifty index instrument_keys.
// Only well-established, publicly documented indices are listed here.
const SEGMENT_TO_INDEX: Record<string, string> = {
  BFSI:           "NSE_INDEX|Nifty Bank",
  IT:             "NSE_INDEX|Nifty IT",
  Technology:     "NSE_INDEX|Nifty IT",
  Auto:           "NSE_INDEX|Nifty Auto",
  FMCG:           "NSE_INDEX|Nifty FMCG",
  Pharma:         "NSE_INDEX|Nifty Pharma",
  Healthcare:     "NSE_INDEX|Nifty Pharma",
  Metals:         "NSE_INDEX|Nifty Metal",
  Energy:         "NSE_INDEX|Nifty Energy",
  Green_Energy:    "NSE_INDEX|Nifty Energy",
  Infrastructure: "NSE_INDEX|Nifty Infrastructure",
  PSU:            "NSE_INDEX|Nifty PSE",
  Defence:        "NSE_INDEX|Nifty India Defence",
  EV:             "NSE_INDEX|Nifty EV and New Age Automotive",
}

// Pearson correlation of two equal-length arrays of daily returns.
function pearson(a: number[], b: number[]): number {
  const n = a.length
  if (n < 5) return 0
  const aMean = a.reduce((s, v) => s + v, 0) / n
  const bMean = b.reduce((s, v) => s + v, 0) / n
  let num = 0
  let denA = 0
  let denB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - aMean
    const db = b[i] - bMean
    num += da * db
    denA += da * da
    denB += db * db
  }
  const den = Math.sqrt(denA * denB)
  if (den === 0) return 0
  // Clamp to [-1, 1] to guard against floating-point drift
  return Math.min(1, Math.max(-1, num / den))
}

// Upstox candle tuple: [timestamp_iso, open, high, low, close, volume, oi]
type Candle = [string, number, number, number, number, number, number]

// Convert candle array to a Map<YYYY-MM-DD, close_price>
function candleCloseMap(candles: Candle[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of candles) {
    m.set(c[0].slice(0, 10), c[4])
  }
  return m
}

// Compute daily close-to-close return series from a date→close map.
// Returns an array aligned on the provided sorted date list.
function dailyReturns(closeMap: Map<string, number>, dates: string[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < dates.length; i++) {
    const prev = closeMap.get(dates[i - 1])
    const curr = closeMap.get(dates[i])
    if (prev != null && curr != null && prev !== 0) {
      returns.push((curr - prev) / prev)
    } else {
      // Missing data on this day — use 0 as neutral filler
      returns.push(0)
    }
  }
  return returns
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const segmentsParam = searchParams.get("segments") ?? ""

  const requestedSegments = segmentsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  if (requestedSegments.length === 0) {
    return NextResponse.json({ error: "segments query param is required" }, { status: 400 })
  }

  const token = await resolveUpstoxToken()
  if (!token) {
    return NextResponse.json(
      { error: "Connect your Upstox account in Settings to view sector correlation." },
      { status: 401 },
    )
  }

  // Deduplicate: multiple segments may map to the same index.
  // Keep track of which segments share an index so we can merge labels.
  const indexToSegments = new Map<string, string[]>()
  for (const seg of requestedSegments) {
    const idx = SEGMENT_TO_INDEX[seg]
    if (!idx) continue
    const existing = indexToSegments.get(idx) ?? []
    if (!existing.includes(seg)) existing.push(seg)
    indexToSegments.set(idx, existing)
  }

  if (indexToSegments.size < 2) {
    return NextResponse.json(
      { error: "Not enough mappable sectors (need ≥ 2 with Nifty index equivalents)." },
      { status: 422 },
    )
  }

  // Date range: 90 days ending today
  const toDate = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)

  // Fetch candle data for every unique index in parallel
  const uniqueIndices = [...indexToSegments.keys()]
  const fetchResults = await Promise.allSettled(
    uniqueIndices.map(async (indexKey) => {
      const url = `https://api.upstox.com/v3/historical-candle/${encodeURIComponent(indexKey)}/days/1/${toDate}/${fromDate}`
      const res = await fetch(url, {
        headers: getUpstoxHeaders(token),
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok || !Array.isArray(json?.data?.candles)) {
        throw new Error(json?.errors?.[0]?.message ?? json?.message ?? "API error")
      }
      return { indexKey, candles: json.data.candles as Candle[] }
    }),
  )

  // Collect successfully fetched series
  const series: Array<{ label: string; closeMap: Map<string, number> }> = []

  for (let i = 0; i < uniqueIndices.length; i++) {
    const result = fetchResults[i]
    if (result.status !== "fulfilled") continue

    const { indexKey, candles } = result.value
    const segments = indexToSegments.get(indexKey)!
    // Use the first matching segment name as the display label
    series.push({
      label: segments[0],
      closeMap: candleCloseMap(candles),
    })
  }

  if (series.length < 2) {
    return NextResponse.json(
      { error: "Upstox returned insufficient data for correlation. Try again after market hours." },
      { status: 500 },
    )
  }

  // Build the union of all dates across series, sorted ascending
  const allDates = [...new Set(series.flatMap((s) => [...s.closeMap.keys()]))].sort()

  // Compute daily return vectors aligned on allDates
  const returnVectors = series.map((s) => dailyReturns(s.closeMap, allDates))

  // Compute NxN Pearson correlation matrix
  const n = series.length
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => {
      if (i === j) return 1
      return Math.round(pearson(returnVectors[i], returnVectors[j]) * 100) / 100
    }),
  )

  return NextResponse.json({
    labels: series.map((s) => s.label),
    matrix,
    days: allDates.length,
  })
}
