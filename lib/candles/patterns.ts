/**
 * Candlestick Pattern Detection Engine
 *
 * Detects 16 Tier 1+2 candlestick patterns from OHLCV data arrays.
 * Each detector is a pure function: (candles) → PatternSignal[]
 *
 * Patterns are classified as:
 *  - Bullish reversal  (Hammer, Bullish Engulfing, Morning Star, Piercing Line,
 *                        Inverted Hammer, Bullish Harami, Three White Soldiers, Dragonfly Doji)
 *  - Bearish reversal  (Shooting Star, Bearish Engulfing, Evening Star, Dark Cloud Cover,
 *                        Hanging Man, Bearish Harami, Three Black Crows, Gravestone Doji)
 *
 * Each pattern uses body/shadow ratios and trend context for detection.
 */

import type { CandleData, PatternSignal, PatternDirection } from "./types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function body(c: CandleData): number {
  return Math.abs(c.close - c.open)
}

function upperShadow(c: CandleData): number {
  return c.high - Math.max(c.open, c.close)
}

function lowerShadow(c: CandleData): number {
  return Math.min(c.open, c.close) - c.low
}

function totalRange(c: CandleData): number {
  return c.high - c.low
}

function isBullish(c: CandleData): boolean {
  return c.close > c.open
}

function isBearish(c: CandleData): boolean {
  return c.close < c.open
}

function midpoint(c: CandleData): number {
  return (c.open + c.close) / 2
}

/** Simple moving average of close prices for trend detection */
function smaClose(candles: CandleData[], period: number): number | null {
  if (candles.length < period) return null
  const slice = candles.slice(-period)
  return slice.reduce((s, c) => s + c.close, 0) / period
}

/** Determine if the preceding context is a downtrend */
function isDowntrend(candles: CandleData[], lookback = 5): boolean {
  if (candles.length < lookback) return false
  const sma5 = smaClose(candles, Math.min(5, candles.length))
  const sma20 = smaClose(candles, Math.min(20, candles.length))
  if (sma5 !== null && sma20 !== null && sma5 < sma20) return true
  // Fallback: recent candles trending down
  const recent = candles.slice(-lookback)
  return recent[recent.length - 1].close < recent[0].close
}

/** Determine if the preceding context is an uptrend */
function isUptrend(candles: CandleData[], lookback = 5): boolean {
  if (candles.length < lookback) return false
  const sma5 = smaClose(candles, Math.min(5, candles.length))
  const sma20 = smaClose(candles, Math.min(20, candles.length))
  if (sma5 !== null && sma20 !== null && sma5 > sma20) return true
  const recent = candles.slice(-lookback)
  return recent[recent.length - 1].close > recent[0].close
}

/** Whether the body is "small" relative to total range (doji-like) */
function isSmallBody(c: CandleData, threshold = 0.3): boolean {
  const range = totalRange(c)
  if (range === 0) return true
  return body(c) / range < threshold
}

/** Whether the body is "large" relative to total range */
function isLargeBody(c: CandleData, threshold = 0.6): boolean {
  const range = totalRange(c)
  if (range === 0) return false
  return body(c) / range > threshold
}

// ── Tier 1: High-Reliability Patterns ─────────────────────────────────────────

/**
 * HAMMER — Single candle bullish reversal
 * Small body at top, long lower shadow (≥2× body), little/no upper shadow.
 * Appears in downtrend.
 */
function detectHammer(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const c = candles[i]
    const b = body(c)
    const ls = lowerShadow(c)
    const us = upperShadow(c)
    const range = totalRange(c)

    if (range === 0 || b === 0) continue
    if (ls < 2 * b) continue              // lower shadow must be ≥2× body
    if (us > b * 0.5) continue             // upper shadow must be small
    if (!isDowntrend(candles.slice(0, i))) continue

    const conf = Math.min(1, (ls / b - 2) * 0.2 + 0.6)
    signals.push({
      name: "Hammer",
      direction: "bullish",
      category: "reversal",
      endIndex: i,
      candleCount: 1,
      confidence: Math.round(conf * 100) / 100,
      description: "Small body with long lower shadow in a downtrend — buyers rejected lower prices, potential reversal upward.",
    })
  }
  return signals
}

/**
 * SHOOTING STAR — Single candle bearish reversal
 * Small body at bottom, long upper shadow (≥2× body), little/no lower shadow.
 * Appears in uptrend.
 */
function detectShootingStar(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const c = candles[i]
    const b = body(c)
    const us = upperShadow(c)
    const ls = lowerShadow(c)
    const range = totalRange(c)

    if (range === 0 || b === 0) continue
    if (us < 2 * b) continue
    if (ls > b * 0.5) continue
    if (!isUptrend(candles.slice(0, i))) continue

    const conf = Math.min(1, (us / b - 2) * 0.2 + 0.6)
    signals.push({
      name: "Shooting Star",
      direction: "bearish",
      category: "reversal",
      endIndex: i,
      candleCount: 1,
      confidence: Math.round(conf * 100) / 100,
      description: "Small body with long upper shadow in an uptrend — sellers pushed price back down, potential reversal.",
    })
  }
  return signals
}

/**
 * BULLISH ENGULFING — Two candle bullish reversal
 * Small bearish candle followed by larger bullish candle that engulfs it.
 */
function detectBullishEngulfing(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]

    if (!isBearish(prev) || !isBullish(curr)) continue
    if (curr.open > prev.close || curr.close < prev.open) continue // must engulf body
    if (body(curr) <= body(prev)) continue // current must be larger

    if (!isDowntrend(candles.slice(0, i - 1))) continue

    const ratio = body(curr) / (body(prev) || 1)
    const conf = Math.min(1, 0.5 + ratio * 0.1)
    signals.push({
      name: "Bullish Engulfing",
      direction: "bullish",
      category: "reversal",
      endIndex: i,
      candleCount: 2,
      confidence: Math.round(conf * 100) / 100,
      description: "Large bullish candle completely engulfs prior bearish candle — strong buying pressure overtaking sellers.",
    })
  }
  return signals
}

/**
 * BEARISH ENGULFING — Two candle bearish reversal
 * Small bullish candle followed by larger bearish candle that engulfs it.
 */
function detectBearishEngulfing(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]

    if (!isBullish(prev) || !isBearish(curr)) continue
    if (curr.open < prev.close || curr.close > prev.open) continue
    if (body(curr) <= body(prev)) continue

    if (!isUptrend(candles.slice(0, i - 1))) continue

    const ratio = body(curr) / (body(prev) || 1)
    const conf = Math.min(1, 0.5 + ratio * 0.1)
    signals.push({
      name: "Bearish Engulfing",
      direction: "bearish",
      category: "reversal",
      endIndex: i,
      candleCount: 2,
      confidence: Math.round(conf * 100) / 100,
      description: "Large bearish candle completely engulfs prior bullish candle — strong selling pressure overtaking buyers.",
    })
  }
  return signals
}

/**
 * MORNING STAR — Three candle bullish reversal
 * Long bearish → small body (indecision) → long bullish closing above midpoint of first.
 */
function detectMorningStar(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 6; i < candles.length; i++) {
    const first = candles[i - 2]
    const second = candles[i - 1]
    const third = candles[i]

    if (!isBearish(first) || !isBullish(third)) continue
    if (!isLargeBody(first) || !isLargeBody(third)) continue
    if (!isSmallBody(second)) continue
    // Third candle should close above midpoint of first
    if (third.close < midpoint(first)) continue

    if (!isDowntrend(candles.slice(0, i - 2))) continue

    const conf = Math.min(1, 0.65 + (third.close - midpoint(first)) / (body(first) || 1) * 0.2)
    signals.push({
      name: "Morning Star",
      direction: "bullish",
      category: "reversal",
      endIndex: i,
      candleCount: 3,
      confidence: Math.round(Math.min(1, conf) * 100) / 100,
      description: "Three-candle reversal: long red, small indecision, then long green — sellers losing control, buyers taking over.",
    })
  }
  return signals
}

/**
 * EVENING STAR — Three candle bearish reversal
 * Long bullish → small body → long bearish closing below midpoint of first.
 */
function detectEveningStar(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 6; i < candles.length; i++) {
    const first = candles[i - 2]
    const second = candles[i - 1]
    const third = candles[i]

    if (!isBullish(first) || !isBearish(third)) continue
    if (!isLargeBody(first) || !isLargeBody(third)) continue
    if (!isSmallBody(second)) continue
    if (third.close > midpoint(first)) continue

    if (!isUptrend(candles.slice(0, i - 2))) continue

    const conf = Math.min(1, 0.65 + (midpoint(first) - third.close) / (body(first) || 1) * 0.2)
    signals.push({
      name: "Evening Star",
      direction: "bearish",
      category: "reversal",
      endIndex: i,
      candleCount: 3,
      confidence: Math.round(Math.min(1, conf) * 100) / 100,
      description: "Three-candle reversal: long green, small indecision, then long red — buyers losing control, sellers taking over.",
    })
  }
  return signals
}

/**
 * PIERCING LINE — Two candle bullish reversal
 * Bearish candle followed by bullish candle opening below prior close,
 * closing above prior midpoint.
 */
function detectPiercingLine(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]

    if (!isBearish(prev) || !isBullish(curr)) continue
    if (!isLargeBody(prev, 0.5)) continue
    if (curr.open > prev.close) continue    // must open below prior close
    if (curr.close < midpoint(prev)) continue // must close above midpoint

    if (!isDowntrend(candles.slice(0, i - 1))) continue

    const penetration = (curr.close - prev.close) / body(prev)
    const conf = Math.min(1, 0.5 + penetration * 0.3)
    signals.push({
      name: "Piercing Line",
      direction: "bullish",
      category: "reversal",
      endIndex: i,
      candleCount: 2,
      confidence: Math.round(conf * 100) / 100,
      description: "Bullish candle opens below prior close but closes above its midpoint — buyers stepping in to reverse downtrend.",
    })
  }
  return signals
}

/**
 * DARK CLOUD COVER — Two candle bearish reversal
 * Bullish candle followed by bearish candle opening above prior high,
 * closing below prior midpoint.
 */
function detectDarkCloudCover(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]

    if (!isBullish(prev) || !isBearish(curr)) continue
    if (!isLargeBody(prev, 0.5)) continue
    if (curr.open < prev.high) continue     // must open above prior high
    if (curr.close > midpoint(prev)) continue // must close below midpoint

    if (!isUptrend(candles.slice(0, i - 1))) continue

    const penetration = (prev.close - curr.close) / body(prev)
    const conf = Math.min(1, 0.5 + penetration * 0.3)
    signals.push({
      name: "Dark Cloud Cover",
      direction: "bearish",
      category: "reversal",
      endIndex: i,
      candleCount: 2,
      confidence: Math.round(conf * 100) / 100,
      description: "Bearish candle opens above prior high but closes below its midpoint — sellers pushing through buyer support.",
    })
  }
  return signals
}

// ── Tier 2: Important Patterns ────────────────────────────────────────────────

/**
 * INVERTED HAMMER — Single candle bullish reversal
 * Small body at bottom, long upper shadow (≥2× body), in downtrend.
 */
function detectInvertedHammer(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const c = candles[i]
    const b = body(c)
    const us = upperShadow(c)
    const ls = lowerShadow(c)
    const range = totalRange(c)

    if (range === 0 || b === 0) continue
    if (us < 2 * b) continue
    if (ls > b * 0.5) continue
    if (!isDowntrend(candles.slice(0, i))) continue

    const conf = Math.min(1, (us / b - 2) * 0.15 + 0.55)
    signals.push({
      name: "Inverted Hammer",
      direction: "bullish",
      category: "reversal",
      endIndex: i,
      candleCount: 1,
      confidence: Math.round(conf * 100) / 100,
      description: "Small body with long upper shadow in a downtrend — buyers attempted to push higher, potential bullish reversal.",
    })
  }
  return signals
}

/**
 * HANGING MAN — Single candle bearish reversal
 * Same shape as hammer but appears in uptrend (warning sign).
 */
function detectHangingMan(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const c = candles[i]
    const b = body(c)
    const ls = lowerShadow(c)
    const us = upperShadow(c)
    const range = totalRange(c)

    if (range === 0 || b === 0) continue
    if (ls < 2 * b) continue
    if (us > b * 0.5) continue
    if (!isUptrend(candles.slice(0, i))) continue

    const conf = Math.min(1, (ls / b - 2) * 0.15 + 0.55)
    signals.push({
      name: "Hanging Man",
      direction: "bearish",
      category: "reversal",
      endIndex: i,
      candleCount: 1,
      confidence: Math.round(conf * 100) / 100,
      description: "Small body with long lower shadow in an uptrend — selling pressure increasing, uptrend may be ending.",
    })
  }
  return signals
}

/**
 * BULLISH HARAMI — Two candle bullish reversal
 * Large bearish candle followed by small bullish candle contained within its body.
 */
function detectBullishHarami(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]

    if (!isBearish(prev) || !isBullish(curr)) continue
    if (!isLargeBody(prev, 0.5)) continue
    if (!isSmallBody(curr, 0.5)) continue
    // Current body must be within prev body
    if (curr.close > prev.open || curr.open < prev.close) continue

    if (!isDowntrend(candles.slice(0, i - 1))) continue

    const ratio = body(prev) / (body(curr) || 1)
    const conf = Math.min(1, 0.45 + Math.min(ratio, 5) * 0.08)
    signals.push({
      name: "Bullish Harami",
      direction: "bullish",
      category: "reversal",
      endIndex: i,
      candleCount: 2,
      confidence: Math.round(conf * 100) / 100,
      description: "Small bullish candle contained within prior large bearish candle — selling pressure decreasing, possible reversal.",
    })
  }
  return signals
}

/**
 * BEARISH HARAMI — Two candle bearish reversal
 * Large bullish candle followed by small bearish candle contained within its body.
 */
function detectBearishHarami(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]

    if (!isBullish(prev) || !isBearish(curr)) continue
    if (!isLargeBody(prev, 0.5)) continue
    if (!isSmallBody(curr, 0.5)) continue
    if (curr.open > prev.close || curr.close < prev.open) continue

    if (!isUptrend(candles.slice(0, i - 1))) continue

    const ratio = body(prev) / (body(curr) || 1)
    const conf = Math.min(1, 0.45 + Math.min(ratio, 5) * 0.08)
    signals.push({
      name: "Bearish Harami",
      direction: "bearish",
      category: "reversal",
      endIndex: i,
      candleCount: 2,
      confidence: Math.round(conf * 100) / 100,
      description: "Small bearish candle contained within prior large bullish candle — buying pressure weakening, possible reversal.",
    })
  }
  return signals
}

/**
 * THREE WHITE SOLDIERS — Three candle bullish reversal
 * Three consecutive long bullish candles, each closing higher, small wicks.
 */
function detectThreeWhiteSoldiers(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 6; i < candles.length; i++) {
    const c1 = candles[i - 2]
    const c2 = candles[i - 1]
    const c3 = candles[i]

    if (!isBullish(c1) || !isBullish(c2) || !isBullish(c3)) continue
    if (!isLargeBody(c1, 0.5) || !isLargeBody(c2, 0.5) || !isLargeBody(c3, 0.5)) continue
    // Each opens within previous body and closes higher
    if (c2.open < c1.open || c2.close <= c1.close) continue
    if (c3.open < c2.open || c3.close <= c2.close) continue
    // Small upper shadows (not more than 30% of body)
    if (upperShadow(c1) > body(c1) * 0.3) continue
    if (upperShadow(c2) > body(c2) * 0.3) continue
    if (upperShadow(c3) > body(c3) * 0.3) continue

    if (!isDowntrend(candles.slice(0, i - 2))) continue

    signals.push({
      name: "Three White Soldiers",
      direction: "bullish",
      category: "reversal",
      endIndex: i,
      candleCount: 3,
      confidence: 0.8,
      description: "Three consecutive long green candles, each closing higher — strong buying momentum, downtrend likely over.",
    })
  }
  return signals
}

/**
 * THREE BLACK CROWS — Three candle bearish reversal
 * Three consecutive long bearish candles, each closing lower, small wicks.
 */
function detectThreeBlackCrows(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 6; i < candles.length; i++) {
    const c1 = candles[i - 2]
    const c2 = candles[i - 1]
    const c3 = candles[i]

    if (!isBearish(c1) || !isBearish(c2) || !isBearish(c3)) continue
    if (!isLargeBody(c1, 0.5) || !isLargeBody(c2, 0.5) || !isLargeBody(c3, 0.5)) continue
    if (c2.open > c1.open || c2.close >= c1.close) continue
    if (c3.open > c2.open || c3.close >= c2.close) continue
    if (lowerShadow(c1) > body(c1) * 0.3) continue
    if (lowerShadow(c2) > body(c2) * 0.3) continue
    if (lowerShadow(c3) > body(c3) * 0.3) continue

    if (!isUptrend(candles.slice(0, i - 2))) continue

    signals.push({
      name: "Three Black Crows",
      direction: "bearish",
      category: "reversal",
      endIndex: i,
      candleCount: 3,
      confidence: 0.8,
      description: "Three consecutive long red candles, each closing lower — strong selling pressure, uptrend likely over.",
    })
  }
  return signals
}

/**
 * DRAGONFLY DOJI — Single candle bullish signal
 * Open ≈ Close ≈ High with long lower shadow. In downtrend signals reversal.
 */
function detectDragonflyDoji(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const c = candles[i]
    const range = totalRange(c)
    if (range === 0) continue

    const b = body(c)
    const ls = lowerShadow(c)
    const us = upperShadow(c)

    // Nearly no body and upper shadow, but long lower shadow
    if (b / range > 0.1) continue       // body must be tiny
    if (us / range > 0.1) continue       // upper shadow must be tiny
    if (ls / range < 0.7) continue       // lower shadow must dominate

    if (!isDowntrend(candles.slice(0, i))) continue

    signals.push({
      name: "Dragonfly Doji",
      direction: "bullish",
      category: "reversal",
      endIndex: i,
      candleCount: 1,
      confidence: 0.6,
      description: "Open, close, and high nearly equal with long lower shadow — buyers recovered all losses, strong reversal signal.",
    })
  }
  return signals
}

/**
 * GRAVESTONE DOJI — Single candle bearish signal
 * Open ≈ Close ≈ Low with long upper shadow. In uptrend signals reversal.
 */
function detectGravestoneDoji(candles: CandleData[]): PatternSignal[] {
  const signals: PatternSignal[] = []
  for (let i = 5; i < candles.length; i++) {
    const c = candles[i]
    const range = totalRange(c)
    if (range === 0) continue

    const b = body(c)
    const us = upperShadow(c)
    const ls = lowerShadow(c)

    if (b / range > 0.1) continue
    if (ls / range > 0.1) continue
    if (us / range < 0.7) continue

    if (!isUptrend(candles.slice(0, i))) continue

    signals.push({
      name: "Gravestone Doji",
      direction: "bearish",
      category: "reversal",
      endIndex: i,
      candleCount: 1,
      confidence: 0.6,
      description: "Open, close, and low nearly equal with long upper shadow — sellers pushed price back down from highs, reversal signal.",
    })
  }
  return signals
}

// ── Master Detection ──────────────────────────────────────────────────────────

const ALL_DETECTORS = [
  // Tier 1
  detectHammer,
  detectShootingStar,
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectMorningStar,
  detectEveningStar,
  detectPiercingLine,
  detectDarkCloudCover,
  // Tier 2
  detectInvertedHammer,
  detectHangingMan,
  detectBullishHarami,
  detectBearishHarami,
  detectThreeWhiteSoldiers,
  detectThreeBlackCrows,
  detectDragonflyDoji,
  detectGravestoneDoji,
]

export interface DetectOptions {
  /** Only return patterns from the last N candles (default: all) */
  recentOnly?: number
  /** Minimum confidence threshold (default: 0.4) */
  minConfidence?: number
}

/**
 * Runs all pattern detectors and returns signals sorted by recency + confidence.
 * Requires at least 7 candles for meaningful detection.
 */
export function detectPatterns(candles: CandleData[], options?: DetectOptions): PatternSignal[] {
  if (candles.length < 7) return []

  const minConf = options?.minConfidence ?? 0.4
  let allSignals: PatternSignal[] = []

  for (const detector of ALL_DETECTORS) {
    const found = detector(candles)
    allSignals.push(...found)
  }

  // Filter by confidence
  allSignals = allSignals.filter((s) => s.confidence >= minConf)

  // If recentOnly, filter to last N candles
  if (options?.recentOnly) {
    const cutoff = candles.length - options.recentOnly
    allSignals = allSignals.filter((s) => s.endIndex >= cutoff)
  }

  // Sort: most recent first, then by confidence descending
  allSignals.sort((a, b) => {
    if (b.endIndex !== a.endIndex) return b.endIndex - a.endIndex
    return b.confidence - a.confidence
  })

  // Deduplicate: if same candle has overlapping patterns, keep highest confidence
  const seen = new Map<string, PatternSignal>()
  for (const signal of allSignals) {
    const key = `${signal.endIndex}-${signal.name}`
    if (!seen.has(key)) {
      seen.set(key, signal)
    }
  }

  return Array.from(seen.values())
}

/**
 * Returns a net directional summary from detected patterns.
 */
export function patternSummary(patterns: PatternSignal[]): {
  bullishCount: number
  bearishCount: number
  netDirection: PatternDirection
  summary: string
} {
  let bullishCount = 0
  let bearishCount = 0

  for (const p of patterns) {
    if (p.direction === "bullish") bullishCount++
    else if (p.direction === "bearish") bearishCount++
  }

  const netDirection: PatternDirection =
    bullishCount > bearishCount ? "bullish" :
    bearishCount > bullishCount ? "bearish" :
    "neutral"

  const summary =
    patterns.length === 0 ? "No candlestick patterns detected in this timeframe." :
    netDirection === "bullish"  ? `${bullishCount} bullish vs ${bearishCount} bearish patterns — net bullish bias.` :
    netDirection === "bearish"  ? `${bearishCount} bearish vs ${bullishCount} bullish patterns — net bearish bias.` :
    `${bullishCount} bullish and ${bearishCount} bearish patterns — mixed signals, no clear bias.`

  return { bullishCount, bearishCount, netDirection, summary }
}
