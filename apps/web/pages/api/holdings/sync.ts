import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Upstox sandbox tokens use a different base URL
const UPSTOX_BASE = process.env.UPSTOX_SANDBOX === 'false'
    ? 'https://api.upstox.com'
    : 'https://api-sandbox.upstox.com'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const accessToken = process.env.UPSTOX_ACCESS_TOKEN

    // --- Fallback to mock if no token is configured ---
    if (!accessToken || accessToken === 'PASTE_YOUR_FULL_TOKEN_HERE') {
        console.warn('[Holdings Sync] No UPSTOX_ACCESS_TOKEN set – returning mock data.')
        return res.status(200).json({
            status: 'mock',
            message: 'Set UPSTOX_ACCESS_TOKEN in your environment to fetch live holdings.',
            data: []
        })
    }

    // --- Live Upstox API call ---
    try {
        const upstoxRes = await fetch(`${UPSTOX_BASE}/v2/portfolio/long-term-holdings`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        })

        const upstoxData = await upstoxRes.json()

        if (!upstoxRes.ok) {
            console.error('[Holdings Sync] Upstox API error:', upstoxData)
            return res.status(upstoxRes.status).json({
                status: 'error',
                message: 'Upstox API returned an error',
                details: upstoxData
            })
        }

        const holdings: any[] = upstoxData?.data || []

        // --- Upsert into Supabase holdings table ---
        if (holdings.length > 0) {
            // Get or create portfolio for the default user (single-user mode)
            const { data: portfolios } = await supabase
                .from('portfolios')
                .select('id')
                .eq('source', 'upstox')
                .limit(1)

            const portfolioId = portfolios?.[0]?.id

            if (portfolioId) {
                const rows = holdings.map((h: any) => ({
                    portfolio_id: portfolioId,
                    instrument_key: h.instrument_key,
                    quantity: h.quantity,
                    avg_price: h.average_price,
                    ltp: h.last_price,
                    invested_amount: (h.average_price || 0) * (h.quantity || 0),
                    unrealized_pl: h.pnl,
                    segment: h.exchange,
                    raw: h
                }))

                const { error: upsertError } = await supabase
                    .from('holdings')
                    .upsert(rows, { onConflict: 'portfolio_id,instrument_key' })

                if (upsertError) {
                    console.error('[Holdings Sync] Supabase upsert error:', upsertError)
                }
            }
        }

        return res.status(200).json({
            status: 'success',
            count: holdings.length,
            data: holdings,
            message: `Synced ${holdings.length} holdings from Upstox.`
        })

    } catch (err: any) {
        console.error('[Holdings Sync] Unexpected error:', err)
        return res.status(500).json({ status: 'error', message: err.message })
    }
}
