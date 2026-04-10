/**
 * Build RealTechnicalData map for the scoring engine from candle data.
 *
 * This bridges the candle-based technical analysis pipeline
 * (lib/candles/technicals.ts) with the scoring engine (lib/quant/scoring.ts).
 * It fetches candles for a set of instrument keys, computes full technicals,
 * and returns a Map<instrumentKey, RealTechnicalData> ready for scoreHoldings().
 */

import { fetchCandleDataBatch, type BatchCandleResult } from "@/lib/candles/fetch"
import { computeTechnicalAnalysis } from "@/lib/candles/technicals"
import { resolveMarketDataToken } from "@/lib/upstox-token"
import type { RealTechnicalData } from "@/lib/quant/scoring"

/**
 * Fetch real technical indicator data for a set of instrument keys.
 * Returns a Map that can be passed directly to scoreHoldings() as the `technicals` parameter.
 *
 * Falls back gracefully: if no Upstox token is available or fetches fail,
 * returns an empty Map (scoring engine will use P&L approximations).
 *
 * @param instrumentKeys - Array of Upstox instrument keys
 * @param symbolMap      - Map of instrument_key → trading_symbol (for logging/context)
 * @param concurrency    - Max parallel requests (default 5)
 */
export async function buildTechnicalsMap(
  instrumentKeys: string[],
  symbolMap?: Map<string, string>,
  concurrency = 5,
): Promise<Map<string, RealTechnicalData>> {
  const technicals = new Map<string, RealTechnicalData>()

  if (instrumentKeys.length === 0) return technicals

  const token = resolveMarketDataToken()
  if (!token) return technicals // No market data token — scoring falls back to approximations

  try {
    const toDate = new Date().toISOString().slice(0, 10)
    const fromDate = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)

    const batchResults: BatchCandleResult[] = await fetchCandleDataBatch(
      instrumentKeys,
      "days",
      1,
      toDate,
      fromDate,
      token,
      concurrency,
    )

    for (const result of batchResults) {
      if (result.error || result.candles.length < 30) continue

      const sym = symbolMap?.get(result.instrumentKey) ?? result.instrumentKey
      const ta = computeTechnicalAnalysis(
        result.candles,
        result.instrumentKey,
        sym,
        "1D",
        { recentOnly: 5, minConfidence: 0.5 },
      )

      const bullishPatterns = ta.patterns.filter((p) => p.direction === "bullish").length
      const bearishPatterns = ta.patterns.filter((p) => p.direction === "bearish").length

      technicals.set(result.instrumentKey, {
        rsi: ta.indicators.rsi,
        rsiSignal: ta.indicators.rsiSignal,
        macdTrend: ta.indicators.macdTrend,
        bullishPatterns,
        bearishPatterns,
      })
    }
  } catch {
    // Non-critical — scoring engine falls back to approximations when map is empty
  }

  return technicals
}
