import { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../lib/supabase/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        const admin = createAdminClient()
        const { data: holdings, error } = await admin
            .from('holdings')
            .select('*')
            .order('invested_amount', { ascending: false })

        if (error) {
            return res.status(500).json({ status: 'error', message: error.message })
        }

        if (!holdings || holdings.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: {
                    totalInvested: 0,
                    totalCurrentValue: 0,
                    totalUnrealizedPL: 0,
                    plPercent: 0,
                    holdingsCount: 0,
                    topGainers: [],
                    topLosers: [],
                    sectorBreakdown: [],
                    holdingsList: [],
                }
            })
        }

        const totalInvested = holdings.reduce((s: number, h: any) => s + Number(h.invested_amount || 0), 0)
        const totalCurrentValue = holdings.reduce((s: number, h: any) => {
            const q = Number(h.quantity || 0)
            const ltp = Number(h.ltp || h.avg_price || 0)
            return s + (q * ltp)
        }, 0)
        const totalUnrealizedPL = holdings.reduce((s: number, h: any) => s + Number(h.unrealized_pl || 0), 0)
        const plPercent = totalInvested > 0 ? (totalUnrealizedPL / totalInvested) * 100 : 0

        // Sort by P&L for gainers/losers
        const sorted = [...holdings].sort((a: any, b: any) => Number(b.unrealized_pl) - Number(a.unrealized_pl))
        const topGainers = sorted.slice(0, 5).filter((h: any) => Number(h.unrealized_pl) > 0).map((h: any) => ({
            name: h.instrument_key?.split('|').pop() || h.instrument_key,
            key: h.instrument_key,
            pl: Number(h.unrealized_pl),
            plPct: Number(h.avg_price) > 0 ? ((Number(h.ltp) - Number(h.avg_price)) / Number(h.avg_price) * 100) : 0,
        }))
        const topLosers = sorted.slice(-5).filter((h: any) => Number(h.unrealized_pl) < 0).reverse().map((h: any) => ({
            name: h.instrument_key?.split('|').pop() || h.instrument_key,
            key: h.instrument_key,
            pl: Number(h.unrealized_pl),
            plPct: Number(h.avg_price) > 0 ? ((Number(h.ltp) - Number(h.avg_price)) / Number(h.avg_price) * 100) : 0,
        }))

        // Pseudo-sector breakdown by instrument key prefix / name heuristics
        const sectorMap: Record<string, number> = {}
        holdings.forEach((h: any) => {
            // Simple categorization based on known NSE instrument names
            const name = (h.instrument_key?.split('|').pop() || '').toUpperCase()
            let sector = 'Others'
            if (['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE', 'MPHASIS'].some(s => name.includes(s))) sector = 'IT'
            else if (['HDFCBANK', 'ICICIBANK', 'AXISBANK', 'KOTAKBANK', 'SBI', 'BANKBARODA', 'BANDHANBNK', 'FEDERALBNK'].some(s => name.includes(s))) sector = 'Banking'
            else if (['RELIANCE', 'ONGC', 'BPCL', 'IOC', 'GAIL', 'HINDPETRO', 'MRPL'].some(s => name.includes(s))) sector = 'Energy'
            else if (['SUNPHARMA', 'DRREDDY', 'CIPLA', 'DIVISLAB', 'LUPIN', 'BIOCON', 'AUROPHARMA'].some(s => name.includes(s))) sector = 'Pharma'
            else if (['ITC', 'HINDUNILVR', 'BRITANNIA', 'NESTLEIND', 'MARICO', 'DABUR', 'COLPAL'].some(s => name.includes(s))) sector = 'FMCG'
            else if (['TATAMOTORS', 'M&M', 'MARUTI', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT'].some(s => name.includes(s))) sector = 'Auto'
            else if (['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'SAIL', 'VEDL', 'NMDC'].some(s => name.includes(s))) sector = 'Metals'
            sectorMap[sector] = (sectorMap[sector] || 0) + Number(h.invested_amount || 0)
        })

        const sectorBreakdown = Object.entries(sectorMap)
            .map(([sector, amount]) => ({
                sector,
                amount,
                percent: totalInvested > 0 ? (amount / totalInvested * 100) : 0
            }))
            .sort((a, b) => b.amount - a.amount)

        const holdingsList = holdings.map((h: any) => ({
            name: h.instrument_key?.split('|').pop() || h.instrument_key,
            key: h.instrument_key,
            quantity: h.quantity,
            avgPrice: Number(h.avg_price),
            ltp: Number(h.ltp || h.avg_price),
            investedAmount: Number(h.invested_amount || 0),
            unrealizedPL: Number(h.unrealized_pl || 0),
            plPct: Number(h.avg_price) > 0 ? ((Number(h.ltp) - Number(h.avg_price)) / Number(h.avg_price) * 100) : 0,
        }))

        return res.status(200).json({
            status: 'success',
            data: {
                totalInvested,
                totalCurrentValue,
                totalUnrealizedPL,
                plPercent,
                holdingsCount: holdings.length,
                topGainers,
                topLosers,
                sectorBreakdown,
                holdingsList,
            }
        })
    } catch (err: any) {
        console.error('[Analytics Error]:', err)
        return res.status(500).json({ status: 'error', message: err.message })
    }
}
