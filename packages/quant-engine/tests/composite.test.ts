import { computeCompositeScore } from '../src/scoring/composite';

describe('Composite Scoring Engine', () => {
    it('returns HOLD for insufficient data', () => {
        const result = computeCompositeScore({ prices: [10, 11] });
        expect(result.signal).toBe('HOLD');
        expect(result.score).toBe(0);
        expect(result.insights[0]).toMatch(/Insufficient data/);
    });

    it('calculates a valid score for valid prices', () => {
        // Generate trending down array to trigger oversold variables
        const prices = Array.from({ length: 40 }, (_, i) => 100 - i);

        // Price drops -> RSI should be low (oversold) -> high RSI score -> likely a BUY or strong hold.
        const result = computeCompositeScore({ prices });

        expect(result.score).toBeGreaterThan(0);
        expect(result.insights.length).toBeGreaterThan(0);
    });

    it('applies VIX discount logic when volatility is high', () => {
        const normalPrices = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 5);

        const normalResult = computeCompositeScore({ prices: normalPrices }, { vixLevel: 15 });
        const boostResult = computeCompositeScore({ prices: normalPrices }, { vixLevel: 35 });

        // The high VIX result should strictly be higher due to the discount padding
        expect(boostResult.score).toBeGreaterThan(normalResult.score);
        expect(boostResult.insights.some(i => i.includes('High VIX'))).toBe(true);
    });
});
