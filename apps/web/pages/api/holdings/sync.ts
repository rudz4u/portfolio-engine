import { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../lib/supabase/server'
import { IS_SANDBOX, UPSTOX_ENDPOINTS, getAccessToken, upstoxHeaders } from '../../../lib/upstoxConfig'

const supabase = createAdminClient()


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    // In sandbox mode, serve holdings from Supabase (seeded from the real XLSX portfolio)
    // The Upstox Sandbox does NOT support portfolio/holdings endpoints.
    if (IS_SANDBOX) {
        const { data: portfolios } = await supabase
            .from('portfolios')
            .select('id')
            .eq('source', 'upstox')
            .limit(1)

        const portfolioId = portfolios?.[0]?.id

        if (!portfolioId) {
            return res.status(200).json({
                status: 'sandbox_mode',
                message: 'No portfolio found in Supabase. Run the seed file to populate holdings.',
                data: []
            })
        }

        const { data: holdings, error } = await supabase
            .from('holdings')
            .select('*')
            .eq('portfolio_id', portfolioId)
            .order('instrument_key', { ascending: true })

        if (error) {
            return res.status(500).json({ status: 'error', message: error.message })
        }

        return res.status(200).json({
            status: 'success',
            mode: 'sandbox_supabase',
            count: holdings?.length || 0,
            data: holdings,
            message: `Loaded ${holdings?.length || 0} holdings from seeded Supabase data (Sandbox mode — Upstox portfolio API not available in sandbox).`
        })
    }

    // Live mode — call actual Upstox API
    const accessToken = getAccessToken()
    if (!accessToken) {
        return res.status(200).json({
            status: 'no_token',
            message: 'Set UPSTOX_ACCESS_TOKEN in environment variables.',
            data: []
        })
    }

    try {
        const upstoxRes = await fetch(UPSTOX_ENDPOINTS.holdings, {
            method: 'GET',
            headers: upstoxHeaders(accessToken)
        })

        const upstoxData = await upstoxRes.json()

        if (!upstoxRes.ok) {
            return res.status(upstoxRes.status).json({
                status: 'error',
                message: 'Upstox API returned an error',
                details: upstoxData
            })
        }

        const holdings: any[] = upstoxData?.data || []

        // Upsert into Supabase
        if (holdings.length > 0) {
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

                await supabase
                    .from('holdings')
                    .upsert(rows, { onConflict: 'portfolio_id,instrument_key' })
            }
        }

        return res.status(200).json({
            status: 'success',
            mode: 'live',
            count: holdings.length,
            data: holdings,
            message: `Synced ${holdings.length} holdings from live Upstox account.`
        })

    } catch (err: any) {
        return res.status(500).json({ status: 'error', message: err.message })
    }
}
