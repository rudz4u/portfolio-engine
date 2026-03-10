/**
 * Technical Analysis Orchestrator
 *
 * Feeds real OHLCV candle data into the quant engine's indicator functions
 * (lib/quant/indicators.ts) and the pattern detection engine to produce
 * a complete TechnicalAnalysis result.
 */

import { sma, ema, rsi, rsiSignal, macd, bollingerBands, atr } from "@/lib/quant/indicators"
import { detectPatterns, patternSummary, type DetectOptions } from "./patterns"
import type { CandleData, TechnicalIndicators, TechnicalAnalysis, PatternDirection } from "./types"

/**
 * Compute all technical indicators from an array of OHLCV candles.
 * Requires at least 30 candles for meaningful results; 50+ recommended.
 */
export function computeIndicators(candles: CandleData[]): TechnicalIndicators {
  const closes = candles.map((c) => c.close)
  const highs = candles.map((c) => c.high)
  const lows = candles.map((c) => c.low)
  const volumes = candles.map((c) => c.volume)

  // RSI (14-period)
  const rsiValues = rsi(closes)
  const latestRsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null
  const rsiSig = latestRsi !== null ? rsiSignal(latestRsi) : "neutral"

  // MACD (12-26-9)
  const macdResult = macd(closes)
  const macdLatest = macdResult.macd.length > 0
    ? {
        value: macdResult.macd[macdResult.macd.length - 1],
        signal: macdResult.signal[macdResult.signal.length - 1],
        histogram: macdResult.histogram[macdResult.histogram.length - 1],
      }
    : null
  const macdTrend: "bullish" | "bearish" | "neutral" = macdLatest
    ? macdLatest.histogram > 0
      ? "bullish"
      : macdLatest.histogram < 0
        ? "bearish"
        : "neutral"
    : "neutral"

  // Bollinger Bands (20-period, 2σ)
  const bbValues = bollingerBands(closes)
  const bbLatest = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null
  const lastClose = closes[closes.length - 1]
  const bollingerPosition: "above" | "within" | "below" = bbLatest
    ? lastClose > bbLatest.upper
      ? "above"
      : lastClose < bbLatest.lower
        ? "below"
        : "within"
    : "within"

  // SMAs
  const sma20Values = sma(closes, 20)
  const sma50Values = sma(closes, 50)
  const sma200Values = sma(closes, 200)
  const sma20 = sma20Values.length > 0 ? sma20Values[sma20Values.length - 1] : null
  const sma50 = sma50Values.length > 0 ? sma50Values[sma50Values.length - 1] : null
  const sma200 = sma200Values.length > 0 ? sma200Values[sma200Values.length - 1] : null

  // ATR (14-period)
  const atrValues = atr(highs, lows, closes)
  const atrLatest = atrValues.length > 0 ? atrValues[atrValues.length - 1] : null

  // Volume trend: compare last 5-day avg volume vs 20-day avg
  const vol20 = volumes.length >= 20
    ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
    : null
  const vol5 = volumes.length >= 5
    ? volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
    : null
  const volumeTrend: "high" | "normal" | "low" =
    vol20 && vol5
      ? vol5 > vol20 * 1.5 ? "high" : vol5 < vol20 * 0.5 ? "low" : "normal"
      : "normal"

  return {
    rsi: latestRsi !== null ? Math.round(latestRsi * 100) / 100 : null,
    rsiSignal: rsiSig,
    macd: macdLatest
      ? {
          value: Math.round(macdLatest.value * 100) / 100,
          signal: Math.round(macdLatest.signal * 100) / 100,
          histogram: Math.round(macdLatest.histogram * 100) / 100,
        }
      : null,
    macdTrend,
    bollingerBands: bbLatest
      ? {
          upper: Math.round(bbLatest.upper * 100) / 100,
          middle: Math.round(bbLatest.middle * 100) / 100,
          lower: Math.round(bbLatest.lower * 100) / 100,
        }
      : null,
    bollingerPosition,
    sma20: sma20 !== null ? Math.round(sma20 * 100) / 100 : null,
    sma50: sma50 !== null ? Math.round(sma50 * 100) / 100 : null,
    sma200: sma200 !== null ? Math.round(sma200 * 100) / 100 : null,
    atr: atrLatest !== null ? Math.round(atrLatest * 100) / 100 : null,
    volumeTrend,
    avgVolume20: vol20 !== null ? Math.round(vol20) : null,
  }
}

/**
 * Derive an overall directional signal from indicators + patterns.
 */
function deriveOverallSignal(
  indicators: TechnicalIndicators,
  patternDir: PatternDirection,
): { direction: PatternDirection; summary: string } {
  let bullishPoints = 0
  let bearishPoints = 0

  // RSI
  if (indicators.rsiSignal === "oversold") bullishPoints += 2
  else if (indicators.rsiSignal === "overbought") bearishPoints += 2

  // MACD
  if (indicators.macdTrend === "bullish") bullishPoints += 2
  else if (indicators.macdTrend === "bearish") bearishPoints += 2

  // Bollinger position
  if (indicators.bollingerPosition === "below") bullishPoints += 1 // potential bounce
  else if (indicators.bollingerPosition === "above") bearishPoints += 1

  // SMA alignment (price vs SMA50)
  if (indicators.sma50 !== null) {
    // We need the close price — infer from Bollinger middle (SMA20)
    const priceProxy = indicators.sma20 ?? indicators.sma50
    if (priceProxy > indicators.sma50) bullishPoints += 1
    else bearishPoints += 1
  }

  // Volume confirmation
  if (indicators.volumeTrend === "high") {
    // High volume confirms the prevailing pattern direction
    if (patternDir === "bullish") bullishPoints += 1
    else if (patternDir === "bearish") bearishPoints += 1
  }

  // Pattern direction weight (patterns are the core feature)
  if (patternDir === "bullish") bullishPoints += 3
  else if (patternDir === "bearish") bearishPoints += 3

  const direction: PatternDirection =
    bullishPoints > bearishPoints + 1 ? "bullish" :
    bearishPoints > bullishPoints + 1 ? "bearish" :
    "neutral"

  const parts: string[] = []
  if (indicators.rsi !== null) parts.push(`RSI ${indicators.rsi.toFixed(0)} (${indicators.rsiSignal})`)
  if (indicators.macdTrend !== "neutral") parts.push(`MACD ${indicators.macdTrend}`)
  if (indicators.bollingerPosition !== "within") parts.push(`Price ${indicators.bollingerPosition} Bollinger`)
  if (indicators.volumeTrend !== "normal") parts.push(`Volume ${indicators.volumeTrend}`)

  const signalLabel = direction === "bullish" ? "Bullish" : direction === "bearish" ? "Bearish" : "Neutral"
  const summary = parts.length > 0
    ? `${signalLabel} — ${parts.join(", ")}`
    : `${signalLabel} — insufficient indicator data`

  return { direction, summary }
}

/** Overlay arrays for chart rendering */
export interface OverlayArrays {
  smaArrays: { sma20?: number[]; sma50?: number[]; sma200?: number[] }
  bollingerArray: { upper: number; middle: number; lower: number }[]
}

/**
 * Compute SMA and Bollinger arrays (for chart overlays).
 */
export function computeOverlayArrays(candles: CandleData[]): OverlayArrays {
  const closes = candles.map((c) => c.close)
  const sma20Arr = sma(closes, 20)
  const sma50Arr = sma(closes, 50)
  const sma200Arr = sma(closes, 200)
  const bbArr = bollingerBands(closes)

  return {
    smaArrays: {
      sma20: sma20Arr.length > 0 ? sma20Arr.map((v) => Math.round(v * 100) / 100) : undefined,
      sma50: sma50Arr.length > 0 ? sma50Arr.map((v) => Math.round(v * 100) / 100) : undefined,
      sma200: sma200Arr.length > 0 ? sma200Arr.map((v) => Math.round(v * 100) / 100) : undefined,
    },
    bollingerArray: bbArr.map((b) => ({
      upper: Math.round(b.upper * 100) / 100,
      middle: Math.round(b.middle * 100) / 100,
      lower: Math.round(b.lower * 100) / 100,
    })),
  }
}

/**
 * Compute full technical analysis including indicators + pattern detection.
 */
export function computeTechnicalAnalysis(
  candles: CandleData[],
  instrumentKey: string,
  tradingSymbol: string,
  timeframeLabel: string,
  patternOptions?: DetectOptions,
): TechnicalAnalysis {
  const indicators = computeIndicators(candles)
  const patterns = detectPatterns(candles, patternOptions)
  const { netDirection } = patternSummary(patterns)
  const { direction, summary } = deriveOverallSignal(indicators, netDirection)

  return {
    instrumentKey,
    tradingSymbol,
    timeframe: timeframeLabel,
    candles,
    indicators,
    patterns,
    overallSignal: direction,
    signalSummary: summary,
    computedAt: new Date().toISOString(),
  }
}
