/**
 * Quant Engine — Technical Indicators
 * Works on arrays of { close, high, low, volume, date } OHLCV data
 * Also exports simplified single-value scorers for live holdings data
 */

/* ── Moving Averages ───────────────────────────────────────────── */

export function sma(prices: number[], period: number): number[] {
  if (prices.length < period) return []
  const result: number[] = []
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1)
    result.push(slice.reduce((a, b) => a + b, 0) / period)
  }
  return result
}

export function ema(prices: number[], period: number): number[] {
  if (prices.length < period) return []
  const k = 2 / (period + 1)
  const result: number[] = []
  // Seed with SMA of first `period` values
  const seed = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(seed)
  for (let i = period; i < prices.length; i++) {
    result.push(prices[i] * k + result[result.length - 1] * (1 - k))
  }
  return result
}

/* ── RSI ───────────────────────────────────────────────────────── */

export function rsi(prices: number[], period = 14): number[] {
  if (prices.length < period + 1) return []
  const changes = prices.slice(1).map((p, i) => p - prices[i])
  const gains = changes.map((c) => Math.max(c, 0))
  const losses = changes.map((c) => Math.abs(Math.min(c, 0)))

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  const result: number[] = []
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  result.push(100 - 100 / (1 + rs))

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result.push(100 - 100 / (1 + rs))
  }
  return result
}

/** Classify RSI into signal */
export function rsiSignal(rsiValue: number): "oversold" | "neutral" | "overbought" {
  if (rsiValue < 30) return "oversold"
  if (rsiValue > 70) return "overbought"
  return "neutral"
}

/* ── MACD ──────────────────────────────────────────────────────── */

export interface MACDResult {
  macd: number[]
  signal: number[]
  histogram: number[]
}

export function macd(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult {
  const fastEma = ema(prices, fastPeriod)
  const slowEma = ema(prices, slowPeriod)
  // Align: slowEma starts at index slowPeriod-1, fastEma starts at fastPeriod-1
  const diff = slowPeriod - fastPeriod
  const macdLine = slowEma.map((v, i) => fastEma[i + diff] - v)
  const signalLine = ema(macdLine, signalPeriod)
  const histOffset = signalPeriod - 1
  const histogram = signalLine.map((v, i) => macdLine[i + histOffset] - v)
  return { macd: macdLine, signal: signalLine, histogram }
}

/* ── Bollinger Bands ───────────────────────────────────────────── */

export interface BollingerBand {
  upper: number
  middle: number
  lower: number
}

export function bollingerBands(prices: number[], period = 20, multiplier = 2): BollingerBand[] {
  if (prices.length < period) return []
  const result: BollingerBand[] = []
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period
    const stdDev = Math.sqrt(variance)
    result.push({
      upper: mean + multiplier * stdDev,
      middle: mean,
      lower: mean - multiplier * stdDev,
    })
  }
  return result
}

/* ── ATR (Average True Range) ──────────────────────────────────── */

export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number[] {
  if (closes.length < period + 1) return []
  const trueRanges: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    )
    trueRanges.push(tr)
  }
  // Wilder's smoothing
  let atrVal = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result = [atrVal]
  for (let i = period; i < trueRanges.length; i++) {
    atrVal = (atrVal * (period - 1) + trueRanges[i]) / period
    result.push(atrVal)
  }
  return result
}

/* ── Momentum ──────────────────────────────────────────────────── */

export function roc(prices: number[], period = 12): number[] {
  const result: number[] = []
  for (let i = period; i < prices.length; i++) {
    result.push(((prices[i] - prices[i - period]) / prices[i - period]) * 100)
  }
  return result
}
