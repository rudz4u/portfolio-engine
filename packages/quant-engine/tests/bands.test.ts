import { calculateBollingerBands } from '../src/indicators/bands';

describe('Bollinger Bands', () => {
    it('calculates correct bollinger bands for basic set of numbers', () => {
        // Generate some prices that fluctuate slightly
        const prices = Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i) * 5);

        const { middleBand, upperBand, lowerBand } = calculateBollingerBands(prices, 20, 2);

        expect(middleBand[18]).toBeNull();
        expect(upperBand[18]).toBeNull();

        expect(middleBand[19]).not.toBeNull();
        expect(upperBand[19]).not.toBeNull();
        expect(lowerBand[19]).not.toBeNull();

        // Middle band should be around 100
        expect(middleBand[19]).toBeGreaterThan(99);
        expect(middleBand[19]).toBeLessThan(101);

        // Upper band should be higher than middle
        expect(upperBand[19]).toBeGreaterThan(middleBand[19]);

        // Lower band should be lower than middle
        expect(lowerBand[19]).toBeLessThan(middleBand[19]);
    });
});
