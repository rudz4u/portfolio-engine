import { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../lib/supabase/server'
import { computeCompositeScore } from 'quant-engine'

const supabase = createAdminClient()

// Fallback mock instruments if no holdings found in DB
const MOCK_INSTRUMENTS = [
    { name: 'RELIANCE', key: 'NSE_EQ|INE002A01018', basePrice: 2500, trend: 'up' as const },
    { name: 'TCS', key: 'NSE_EQ|INE467B01029', basePrice: 3800, trend: 'down' as const },
    { name: 'INFY', key: 'NSE_EQ|INE009A01021', basePrice: 1500, trend: 'flat' as const },
    { name: 'HDFCBANK', key: 'NSE_EQ|INE040A01034', basePrice: 1600, trend: 'down' as const },
    { name: 'ITC', key: 'NSE_EQ|INE154A01025', basePrice: 450, trend: 'up' as const },
]

function generateTrend(base: number, trend: 'up' | 'down' | 'flat', length = 40) {
    return Array.from({ length }, (_, i) => {
        const noise = (Math.random() - 0.5) * base * 0.015
        if (trend === 'up') return base + (i * base * 0.003) + noise
        if (trend === 'down') return base - (i * base * 0.003) + noise
        return base + Math.sin(i * 0.5) * base * 0.02 + noise
    })
}

// Estimate trend from avg_price → ltp
function trendFromPrices(avgPrice: number, ltp: number): 'up' | 'down' | 'flat' {
    const change = (ltp - avgPrice) / avgPrice
    if (change > 0.02) return 'up'
    if (change < -0.02) return 'down'
    return 'flat'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    // Attempt to pull real holdings from Supabase
    const { data: holdings } = await supabase
        .from('holdings')
        .select('instrument_key, avg_price, ltp, quantity, invested_amount, unrealized_pl')
        .order('invested_amount', { ascending: false })
        .limit(15)

    const vixLevel = Number(process.env.CURRENT_VIX) || 18

    let instruments: Array<{ name: string; key: string; basePrice: number; trend: 'up' | 'down' | 'flat' }>

    if (holdings && holdings.length > 0) {
        // Use real holdings
        instruments = holdings.map((h: any) => ({
            name: h.instrument_key?.split('|').pop() || h.instrument_key,
            key: h.instrument_key,
            basePrice: Number(h.ltp) || Number(h.avg_price) || 1000,
            trend: trendFromPrices(Number(h.avg_price) || 1000, Number(h.ltp) || 1000),
        }))
    } else {
        instruments = MOCK_INSTRUMENTS
    }

    const recommendations = instruments.map(inst => {
        const prices = generateTrend(inst.basePrice, inst.trend)
        const { score, signal, insights } = computeCompositeScore({ prices }, { vixLevel })

        // Enrich insights with P&L context if real holdings
        const holding = holdings?.find((h: any) => h.instrument_key === inst.key)
        const enrichedInsights = [...insights]
        if (holding) {
            const pl = Number(holding.unrealized_pl || 0)
            const plPct = holding.avg_price ? ((Number(holding.ltp) - Number(holding.avg_price)) / Number(holding.avg_price) * 100).toFixed(2) : '0'
            enrichedInsights.unshift(`Current P&L: ${pl >= 0 ? '+' : ''}₹${pl.toFixed(2)} (${plPct}%)`)
        }

        return {
            instrument_name: inst.name,
            instrument_key: inst.key,
            current_price: prices[prices.length - 1].toFixed(2),
            ltp: holding ? String(holding.ltp) : null,
            score,
            signal,
            insights: enrichedInsights,
            is_live: !!holding,
        }
    })

    // Sort: BUY first (highest score), then HOLD, then SELL (lowest score)
    recommendations.sort((a, b) => b.score - a.score)

    return res.status(200).json({
        status: 'success',
        source: holdings && holdings.length > 0 ? 'live_holdings' : 'mock_data',
        vix: vixLevel,
        count: recommendations.length,
        data: recommendations,
    })
}
