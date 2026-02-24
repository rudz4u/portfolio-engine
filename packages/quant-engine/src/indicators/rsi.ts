export function calculateRSI(prices: number[], period: number = 14): number[] {
    if (prices.length < period + 1) {
        return Array(prices.length).fill(null);
    }

    const rsi = new Array(prices.length).fill(null);

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) {
            gains += diff;
        } else {
            losses -= diff;
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    if (avgLoss === 0) {
        rsi[period] = 100;
    } else {
        const rs = avgGain / avgLoss;
        rsi[period] = 100 - (100 / (1 + rs));
    }

    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];

        let currentGain = 0;
        let currentLoss = 0;
        if (diff >= 0) {
            currentGain = diff;
        } else {
            currentLoss = -diff;
        }

        avgGain = ((avgGain * (period - 1)) + currentGain) / period;
        avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;

        if (avgLoss === 0) {
            rsi[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi[i] = 100 - (100 / (1 + rs));
        }
    }

    return rsi;
}
