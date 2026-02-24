export function calculateSMA(prices: number[], period: number): number[] {
    const sma = new Array(prices.length).fill(null);

    if (prices.length < period) return sma;

    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
    }

    sma[period - 1] = sum / period;

    for (let i = period; i < prices.length; i++) {
        sum = sum - prices[i - period] + prices[i];
        sma[i] = sum / period;
    }

    return sma;
}

export function calculateEMA(prices: number[], period: number): number[] {
    const ema = new Array(prices.length).fill(null);

    if (prices.length < period) return ema;

    const multiplier = 2 / (period + 1);

    // EMA usually starts from SMA of first `period` items
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += prices[i];
    }
    let prevEma = sum / period;
    ema[period - 1] = prevEma;

    for (let i = period; i < prices.length; i++) {
        const currentEma = (prices[i] - prevEma) * multiplier + prevEma;
        ema[i] = currentEma;
        prevEma = currentEma;
    }

    return ema;
}

export function calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {

    const fastEma = calculateEMA(prices, fastPeriod);
    const slowEma = calculateEMA(prices, slowPeriod);

    const macdLine = new Array(prices.length).fill(null);

    for (let i = slowPeriod - 1; i < prices.length; i++) {
        if (fastEma[i] !== null && slowEma[i] !== null) {
            macdLine[i] = fastEma[i] - slowEma[i];
        }
    }

    // Extract the non-null parts to calculate the signal line (EMA of MACD)
    const signalLine = new Array(prices.length).fill(null);
    const histogram = new Array(prices.length).fill(null);

    if (prices.length >= slowPeriod + signalPeriod - 1) {
        const macdValues = macdLine.slice(slowPeriod - 1);
        const signalEma = calculateEMA(macdValues, signalPeriod);

        for (let i = 0; i < signalEma.length; i++) {
            if (signalEma[i] !== null) {
                const actualIndex = (slowPeriod - 1) + i;
                signalLine[actualIndex] = signalEma[i];
                histogram[actualIndex] = macdLine[actualIndex] - signalLine[actualIndex];
            }
        }
    }

    return { macdLine, signalLine, histogram };
}
