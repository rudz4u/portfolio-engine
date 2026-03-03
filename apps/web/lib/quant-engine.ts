// Quant engine — inlined from packages/quant-engine to avoid workspace
// dependency resolution complexity during Netlify builds.

// ── Indicators ────────────────────────────────────────────────────────────────

export function calculateSMA(prices: number[], period: number): number[] {
    const sma = new Array(prices.length).fill(null)
    if (prices.length < period) return sma
    let sum = 0
    for (let i = 0; i < period; i++) sum += prices[i]
    sma[period - 1] = sum / period
    for (let i = period; i < prices.length; i++) {
        sum = sum - prices[i - period] + prices[i]
        sma[i] = sum / period
    }
    return sma
}

export function calculateEMA(prices: number[], period: number): number[] {
    const ema = new Array(prices.length).fill(null)
    if (prices.length < period) return ema
    const multiplier = 2 / (period + 1)
    let sum = 0
    for (let i = 0; i < period; i++) sum += prices[i]
    let prevEma = sum / period
    ema[period - 1] = prevEma
    for (let i = period; i < prices.length; i++) {
        const currentEma = (prices[i] - prevEma) * multiplier + prevEma
        ema[i] = currentEma
        prevEma = currentEma
    }
    return ema
}

export function calculateMACD(
    prices: number[],
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
    const fastEma = calculateEMA(prices, fastPeriod)
    const slowEma = calculateEMA(prices, slowPeriod)
    const macdLine = new Array(prices.length).fill(null)
    for (let i = slowPeriod - 1; i < prices.length; i++) {
        if (fastEma[i] !== null && slowEma[i] !== null) {
            macdLine[i] = fastEma[i] - slowEma[i]
        }
    }
    const signalLine = new Array(prices.length).fill(null)
    const histogram = new Array(prices.length).fill(null)
    if (prices.length >= slowPeriod + signalPeriod - 1) {
        const macdValues = macdLine.slice(slowPeriod - 1)
        const signalEma = calculateEMA(macdValues, signalPeriod)
        for (let i = 0; i < signalEma.length; i++) {
            if (signalEma[i] !== null) {
                const idx = (slowPeriod - 1) + i
                signalLine[idx] = signalEma[i]
                histogram[idx] = macdLine[idx] - signalLine[idx]
            }
        }
    }
    return { macdLine, signalLine, histogram }
}

export function calculateRSI(prices: number[], period = 14): number[] {
    if (prices.length < period + 1) return Array(prices.length).fill(null)
    const rsi = new Array(prices.length).fill(null)
    let gains = 0, losses = 0
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1]
        if (diff >= 0) gains += diff; else losses -= diff
    }
    let avgGain = gains / period
    let avgLoss = losses / period
    rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1]
        const g = diff >= 0 ? diff : 0
        const l = diff < 0 ? -diff : 0
        avgGain = ((avgGain * (period - 1)) + g) / period
        avgLoss = ((avgLoss * (period - 1)) + l) / period
        rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss))
    }
    return rsi
}

export function calculateBollingerBands(
    prices: number[],
    period = 20,
    stdDevMultiplier = 2
): { middleBand: number[]; upperBand: number[]; lowerBand: number[] } {
    const middleBand = calculateSMA(prices, period)
    const upperBand = new Array(prices.length).fill(null)
    const lowerBand = new Array(prices.length).fill(null)
    for (let i = period - 1; i < prices.length; i++) {
        const slice = prices.slice(i - period + 1, i + 1)
        const mean = middleBand[i]
        const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period
        const stdDev = Math.sqrt(variance)
        upperBand[i] = mean + (stdDev * stdDevMultiplier)
        lowerBand[i] = mean - (stdDev * stdDevMultiplier)
    }
    return { middleBand, upperBand, lowerBand }
}

// ── Composite Scorer ──────────────────────────────────────────────────────────

export interface StockData { prices: number[] }

export interface ScoreContext {
    rsiWeight?: number
    macdWeight?: number
    bbWeight?: number
    vixLevel?: number
}

export function computeCompositeScore(
    data: StockData,
    context: ScoreContext = {}
): { score: number; signal: 'BUY' | 'SELL' | 'HOLD'; insights: string[] } {
    const { prices } = data
    if (!prices || prices.length < 35) {
        return { score: 0, signal: 'HOLD', insights: ['Insufficient data for quantitative analysis (< 35 periods).'] }
    }

    const rsi = calculateRSI(prices, 14)
    const { lowerBand, upperBand } = calculateBollingerBands(prices, 20, 2)
    const { histogram } = calculateMACD(prices)

    const currentPrice = prices[prices.length - 1]
    const currentRsi = rsi[rsi.length - 1] ?? 50
    const currentLowerBb = lowerBand[lowerBand.length - 1] ?? 0
    const currentUpperBb = upperBand[upperBand.length - 1] ?? Infinity
    const currentMacdHist = histogram[histogram.length - 1] ?? 0
    const prevMacdHist = histogram[histogram.length - 2] ?? 0

    const insights: string[] = []
    const wRsi = context.rsiWeight ?? 0.3
    const wbb = context.bbWeight ?? 0.3
    const wMacd = context.macdWeight ?? 0.4

    let rsiScore = 50
    if (currentRsi < 30) {
        rsiScore = 90
        insights.push(`RSI is oversold (${currentRsi.toFixed(1)} < 30).`)
    } else if (currentRsi > 70) {
        rsiScore = 10
        insights.push(`RSI is overbought (${currentRsi.toFixed(1)} > 70).`)
    } else {
        rsiScore = 100 - currentRsi
        insights.push(`RSI is neutral (${currentRsi.toFixed(1)}).`)
    }

    let bbScore = 50
    if (currentPrice <= currentLowerBb) {
        bbScore = 85
        insights.push(`Price is hugging or below the lower Bollinger Band.`)
    } else if (currentPrice >= currentUpperBb) {
        bbScore = 15
        insights.push(`Price is hugging or above the upper Bollinger Band.`)
    } else {
        insights.push(`Price trades within normal bands.`)
    }

    let macdScore = 50
    if (currentMacdHist > 0 && currentMacdHist > prevMacdHist) {
        macdScore = 80
        insights.push(`MACD histogram shows expanding bullish momentum.`)
    } else if (currentMacdHist < 0 && currentMacdHist < prevMacdHist) {
        macdScore = 20
        insights.push(`MACD histogram shows expanding bearish momentum.`)
    } else {
        insights.push(`MACD histogram momentum is shrinking or neutral.`)
    }

    let composite = (rsiScore * wRsi) + (bbScore * wbb) + (macdScore * wMacd)

    const vix = context.vixLevel ?? 15
    if (vix > 25) {
        const boost = (vix - 25) * 0.5
        composite += boost
        insights.push(`High VIX (${vix}) detected. Applied +${boost.toFixed(1)} discount boost to composite score.`)
    }

    composite = Math.max(0, Math.min(100, composite))
    const signal: 'BUY' | 'SELL' | 'HOLD' = composite >= 70 ? 'BUY' : composite <= 30 ? 'SELL' : 'HOLD'

    return { score: parseFloat(composite.toFixed(2)), signal, insights }
}
