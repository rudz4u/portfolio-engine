import { calculateRSI } from '../src/indicators/rsi';

describe('RSI Indicator', () => {
    it('should return nulls if there are not enough prices', () => {
        const prices = [10, 11, 12];
        const rsi = calculateRSI(prices, 14);
        expect(rsi).toEqual([null, null, null]);
    });

    it('should calculate RSI correctly for a given period', () => {
        // Some mock price data
        const prices = [
            44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42,
            45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00
        ];

        const rsi = calculateRSI(prices, 14);

        // First 14 values should be null (index 0 to 13)
        expect(rsi[13]).toBeNull();

        // Test RSI value at index 14
        expect(rsi[14]).toBeCloseTo(70.46, 2);

        // Test RSI value at index 15
        expect(rsi[15]).toBeCloseTo(66.25, 2);
    });
});
