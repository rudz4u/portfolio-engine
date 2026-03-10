/**
 * GET /api/analysis/technicals
 *
 * Computes full technical analysis (indicators + candlestick patterns) for
 * one or more instruments. Fetches historical candle data from Upstox V3,
 * runs indicators and pattern detection, returns structured results.
 *
 * Query params:
 *   symbols   — comma-separated trading symbols (e.g. RELIANCE,INFY)
 *   timeframe — 15min | 1H | 1D | 1W | 1M (default: 1D)
 *
 * Response: { status: "success", data: TechnicalAnalysis[] }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/server"
import { resolveUpstoxToken } from "@/lib/upstox-token"
import { fetchCandleDataBatch } from "@/lib/candles/fetch"
import { computeTechnicalAnalysis, computeOverlayArrays } from "@/lib/candles/technicals"
import { TIMEFRAME_PRESETS } from "@/lib/candles/types"
import type { TechnicalAnalysis } from "@/lib/candles/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_SYMBOLS = 20

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  const token = await resolveUpstoxToken()
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "Connect your Upstox account in Settings to view technical analysis." },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get("symbols") ?? ""
  const timeframeLabel = searchParams.get("timeframe") ?? "1D"

  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS)

  if (symbols.length === 0) {
    return NextResponse.json(
      { status: "error", message: "symbols query param is required (comma-separated trading symbols)" },
      { status: 400 },
    )
  }

  // Resolve timeframe preset
  const preset = TIMEFRAME_PRESETS.find((p) => p.label === timeframeLabel)
  if (!preset) {
    return NextResponse.json(
      { status: "error", message: `Invalid timeframe: ${timeframeLabel}. Use: ${TIMEFRAME_PRESETS.map((p) => p.label).join(", ")}` },
      { status: 400 },
    )
  }

  // Resolve trading symbols to instrument_keys via instruments table
  const admin = await createAdminClient()
  let { data: instruments } = await admin
    .from("instruments")
    .select("instrument_key, trading_symbol, isin")
    .in("trading_symbol", symbols)

  if (!instruments || instruments.length === 0) {
    // Fallback: try matching on instrument_key directly (some entries use bare symbols as keys)
    const { data: fallbackInst } = await admin
      .from("instruments")
      .select("instrument_key, trading_symbol, isin")
      .in("instrument_key", symbols)

    if (!fallbackInst || fallbackInst.length === 0) {
      return NextResponse.json(
        { status: "error", message: "No matching instruments found for the provided symbols." },
        { status: 404 },
      )
    }
    instruments = fallbackInst
  }

  const symbolToKey = new Map<string, string>()
  const keyToSymbol = new Map<string, string>()
  for (const inst of instruments) {
    // Build a proper Upstox key from ISIN if the instrument_key is a bare symbol
    const upstoxKey = inst.instrument_key.includes("|")
      ? inst.instrument_key
      : inst.isin
        ? `NSE_EQ|${inst.isin}`
        : `NSE_EQ|${inst.instrument_key}`
    symbolToKey.set(inst.trading_symbol, upstoxKey)
    keyToSymbol.set(upstoxKey, inst.trading_symbol)
  }

  const instrumentKeys = [...symbolToKey.values()]

  // Date range from preset
  const toDate = new Date().toISOString().slice(0, 10)
  const fromDate = new Date(Date.now() - preset.lookbackDays * 86_400_000).toISOString().slice(0, 10)

  // Batch fetch candle data
  const batchResults = await fetchCandleDataBatch(
    instrumentKeys,
    preset.unit,
    preset.interval,
    toDate,
    fromDate,
    token,
  )

  // Compute technical analysis for each successful fetch
  const analyses: TechnicalAnalysis[] = []
  const errors: Array<{ symbol: string; error: string }> = []

  for (const result of batchResults) {
    const symbol = keyToSymbol.get(result.instrumentKey) ?? result.instrumentKey
    if (result.error || result.candles.length < 7) {
      errors.push({
        symbol,
        error: result.error ?? "Insufficient candle data (need at least 7 candles)",
      })
      continue
    }

    const analysis = computeTechnicalAnalysis(
      result.candles,
      result.instrumentKey,
      symbol,
      timeframeLabel,
      { recentOnly: 20, minConfidence: 0.4 },
    )

    // Compute overlay arrays for chart rendering
    const overlays = computeOverlayArrays(result.candles)

    // Strip full candle array from response to reduce payload
    // (client can fetch via /api/candles/[key] if it needs chart data)
    analyses.push({
      ...analysis,
      candles: [], // omit for lighter response
      ...overlays,  // include smaArrays + bollingerArray
    } as TechnicalAnalysis & typeof overlays)
  }

  return NextResponse.json({
    status: "success",
    data: {
      analyses,
      errors,
      timeframe: timeframeLabel,
      computedAt: new Date().toISOString(),
    },
  })
}
