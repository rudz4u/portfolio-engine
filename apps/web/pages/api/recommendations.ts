import { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../lib/supabase/server'
import { computeCompositeScore } from 'quant-engine'

const supabase = createAdminClient()


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    // Generate mock prices to feed into our algorithm
    function generateTrend(base: number, trend: 'up' | 'down' | 'flat', length = 40) {
        return Array.from({ length }, (_, i) => {
            const noise = (Math.random() - 0.5) * 5;
            if (trend === 'up') return base + (i * 1.5) + noise;
            if (trend === 'down') return base - (i * 1.5) + noise;
            return base + Math.sin(i) * 5 + noise;
        });
    }

    const mockedInstruments = [
        { name: 'RELIANCE', key: 'NSE_EQ|INE002A01018', basePrice: 2500, trend: 'up' as const },
        { name: 'TCS', key: 'NSE_EQ|INE467B01029', basePrice: 3800, trend: 'down' as const },
        { name: 'INFY', key: 'NSE_EQ|INE009A01021', basePrice: 1500, trend: 'flat' as const },
        { name: 'HDFCBANK', key: 'NSE_EQ|INE040A01034', basePrice: 1600, trend: 'down' as const },
        { name: 'ITC', key: 'NSE_EQ|INE154A01025', basePrice: 450, trend: 'up' as const }
    ];

    const recommendations = mockedInstruments.map(inst => {
        const prices = generateTrend(inst.basePrice, inst.trend);
        const context = { vixLevel: 16 }; // Normal volatility

        // Using our Phase 3 algorithms
        const { score, signal, insights } = computeCompositeScore({ prices }, context);

        return {
            instrument_name: inst.name,
            instrument_key: inst.key,
            current_price: prices[prices.length - 1].toFixed(2),
            score,
            signal,
            insights
        }
    });

    return res.status(200).json({
        status: 'success',
        data: recommendations
    })
}
