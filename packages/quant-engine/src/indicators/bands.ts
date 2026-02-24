import { calculateSMA } from './moving_averages';

export function calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDevMultiplier: number = 2
): { middleBand: number[]; upperBand: number[]; lowerBand: number[] } {

    const middleBand = calculateSMA(prices, period);
    const upperBand = new Array(prices.length).fill(null);
    const lowerBand = new Array(prices.length).fill(null);

    for (let i = period - 1; i < prices.length; i++) {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = middleBand[i];

        // Compute sample standard deviation
        let varianceSum = 0;
        for (let j = 0; j < slice.length; j++) {
            varianceSum += Math.pow(slice[j] - mean, 2);
        }
        const variance = varianceSum / period; // using population variance for BB
        const stdDev = Math.sqrt(variance);

        upperBand[i] = mean + (stdDev * stdDevMultiplier);
        lowerBand[i] = mean - (stdDev * stdDevMultiplier);
    }

    return { middleBand, upperBand, lowerBand };
}
