import { calculateSMA, calculateEMA, calculateMACD } from '../src/indicators/moving_averages';

describe('Moving Averages', () => {
    const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

    describe('SMA', () => {
        it('calculates correct SMA', () => {
            const sma = calculateSMA(prices, 3);
            expect(sma[0]).toBeNull();
            expect(sma[1]).toBeNull();
            expect(sma[2]).toBe(11); // (10 + 11 + 12) / 3
            expect(sma[3]).toBe(12); // (11 + 12 + 13) / 3
        });
    });

    describe('EMA', () => {
        it('calculates correct EMA', () => {
            const ema = calculateEMA(prices, 3);
            expect(ema[2]).toBe(11); // First value starts as SMA
            expect(ema[3]).toBe(12); // (13 - 11) * (2/4) + 11 = 12
        });
    });

    describe('MACD', () => {
        it('calculates MACD lines', () => {
            // Need a bit longer array for standard 12, 26, 9
            const longPrices = Array.from({ length: 40 }, (_, i) => 100 + i);
            const { macdLine, signalLine, histogram } = calculateMACD(longPrices, 12, 26, 9);

            expect(macdLine[24]).toBeNull(); // Before slow period
            expect(macdLine[25]).not.toBeNull();
            expect(signalLine[25 + 9 - 2]).toBeNull();
            expect(signalLine[33]).not.toBeNull();
            expect(histogram[33]).not.toBeNull();
        });
    });
});
