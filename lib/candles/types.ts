/**
 * Candle Data Types — Shared types for historical OHLCV data,
 * pattern detection, and technical analysis.
 */

/** Single OHLCV candle from Upstox Historical Candle Data V3 */
export interface CandleData {
  timestamp: string // ISO 8601 with timezone
  open: number
  high: number
  low: number
  close: number
  volume: number
  oi: number // open interest
}

/** Timeframe presets for candle data retrieval */
export interface TimeframePreset {
  unit: "minutes" | "hours" | "days" | "weeks" | "months"
  interval: number
  label: string           // e.g. "15min", "1H", "1D", "1W", "1M"
  lookbackDays: number    // recommended lookback for this timeframe
}

/** Pre-configured timeframe options */
export const TIMEFRAME_PRESETS: TimeframePreset[] = [
  { unit: "minutes", interval: 5,   label: "5min",  lookbackDays: 3 },
  { unit: "minutes", interval: 15,  label: "15min", lookbackDays: 5 },
  { unit: "minutes", interval: 30,  label: "30min", lookbackDays: 10 },
  { unit: "hours",   interval: 1,   label: "1H",    lookbackDays: 30 },
  { unit: "days",    interval: 1,   label: "1D",    lookbackDays: 365 },
  { unit: "weeks",   interval: 1,   label: "1W",    lookbackDays: 1095 },
  { unit: "months",  interval: 1,   label: "1M",    lookbackDays: 3650 },
]

/** Pattern type classification */
export type PatternDirection = "bullish" | "bearish" | "neutral"
export type PatternCategory = "reversal" | "continuation" | "indecision"

/** Detected candlestick pattern */
export interface PatternSignal {
  name: string
  direction: PatternDirection
  category: PatternCategory
  /** Index of the last candle forming this pattern (0-based from input array) */
  endIndex: number
  /** Number of candles that form the pattern (1, 2, or 3+) */
  candleCount: number
  /** Confidence 0–1 based on how well proportions match ideal form */
  confidence: number
  /** Human-readable description */
  description: string
}

/** Technical indicator results computed from real OHLCV data */
export interface TechnicalIndicators {
  rsi: number | null                      // 0–100 (14-period)
  rsiSignal: "oversold" | "neutral" | "overbought"
  macd: { value: number; signal: number; histogram: number } | null
  macdTrend: "bullish" | "bearish" | "neutral"
  bollingerBands: { upper: number; middle: number; lower: number } | null
  bollingerPosition: "above" | "within" | "below" // price relative to bands
  sma20: number | null
  sma50: number | null
  sma200: number | null
  atr: number | null                      // 14-period average true range
  volumeTrend: "high" | "normal" | "low"  // vs 20-day average
  avgVolume20: number | null
}

/** Full technical analysis result for a single instrument */
export interface TechnicalAnalysis {
  instrumentKey: string
  tradingSymbol: string
  timeframe: string
  candles: CandleData[]
  indicators: TechnicalIndicators
  patterns: PatternSignal[]
  /** Overall signal derived from indicators + patterns */
  overallSignal: PatternDirection
  signalSummary: string
  computedAt: string // ISO timestamp
}
