import { calculateRSI } from "../indicators/rsi";
import { calculateBollingerBands } from "../indicators/bands";
import { calculateMACD } from "../indicators/moving_averages";

export interface StockData {
    prices: number[];
}

export interface ScoreContext {
    rsiWeight?: number;
    macdWeight?: number;
    bbWeight?: number;
    vixLevel?: number; // E.g., current global Volatility Index. Usually 15-20 is normal. > 30 is high.
}

export function computeCompositeScore(
    data: StockData,
    context: ScoreContext = {}
): { score: number; signal: 'BUY' | 'SELL' | 'HOLD'; insights: string[] } {
    const { prices } = data;
    if (!prices || prices.length < 35) {
        return { score: 0, signal: 'HOLD', insights: ["Insufficient data for quantitative analysis (< 35 periods)."] };
    }

    // Calculate Indicators
    const rsi = calculateRSI(prices, 14);
    const { lowerBand, upperBand } = calculateBollingerBands(prices, 20, 2);
    const { histogram } = calculateMACD(prices);

    const currentPrice = prices[prices.length - 1];
    const currentRsi = rsi[rsi.length - 1] ?? 50;
    const currentLowerBb = lowerBand[lowerBand.length - 1] ?? 0;
    const currentUpperBb = upperBand[upperBand.length - 1] ?? Infinity;
    const currentMacdHist = histogram[histogram.length - 1] ?? 0;
    const prevMacdHist = histogram[histogram.length - 2] ?? 0;

    let baseScore = 50; // Neutral
    const insights: string[] = [];

    // 1. RSI Logic (Weight: defined or default 30%)
    const wRsi = context.rsiWeight ?? 0.3;
    let rsiScore = 50;
    if (currentRsi < 30) {
        rsiScore = 90; // Oversold -> strong buy signal
        insights.push(`RSI is oversold (${currentRsi.toFixed(1)} < 30).`);
    } else if (currentRsi > 70) {
        rsiScore = 10; // Overbought -> strong sell signal
        insights.push(`RSI is overbought (${currentRsi.toFixed(1)} > 70).`);
    } else {
        // scale roughly between 30 and 70 bounds
        rsiScore = 100 - (currentRsi);
        insights.push(`RSI is neutral (${currentRsi.toFixed(1)}).`);
    }

    // 2. Bollinger Bands Logic (Weight: defined or default 30%)
    const wbb = context.bbWeight ?? 0.3;
    let bbScore = 50;
    if (currentPrice <= currentLowerBb) {
        bbScore = 85;
        insights.push(`Price is hugging or below the lower Bollinger Band.`);
    } else if (currentPrice >= currentUpperBb) {
        bbScore = 15;
        insights.push(`Price is hugging or above the upper Bollinger Band.`);
    } else {
        insights.push(`Price trades within normal bands.`);
    }

    // 3. MACD Histogram Momentum (Weight: defined or default 40%)
    const wMacd = context.macdWeight ?? 0.4;
    let macdScore = 50;
    if (currentMacdHist > 0 && currentMacdHist > prevMacdHist) {
        macdScore = 80;
        insights.push(`MACD histogram shows expanding bullish momentum.`);
    } else if (currentMacdHist < 0 && currentMacdHist < prevMacdHist) {
        macdScore = 20;
        insights.push(`MACD histogram shows expanding bearish momentum.`);
    } else {
        insights.push(`MACD histogram momentum is shrinking or neutral.`);
    }

    // Assemble Score
    let composite = (rsiScore * wRsi) + (bbScore * wbb) + (macdScore * wMacd);

    // VIX Discount Logic
    // High volatility discounts the risk barrier (making buillish scores higher because panic brings opportunity)
    const vix = context.vixLevel ?? 15;
    if (vix > 25) {
        const boost = (vix - 25) * 0.5; // E.g., Vix 35 -> +5 points to score
        composite += boost;
        insights.push(`High VIX (${vix}) detected. Applied +${boost.toFixed(1)} discount boost to composite score.`);
    }

    // Cap Score
    composite = Math.max(0, Math.min(100, composite));

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (composite >= 70) signal = 'BUY';
    else if (composite <= 30) signal = 'SELL';

    return {
        score: parseFloat(composite.toFixed(2)),
        signal,
        insights
    };
}
