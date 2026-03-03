import { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../lib/supabase/server'
import { IS_SANDBOX, getAccessToken } from '../../../lib/upstoxConfig'

const supabase = createAdminClient()


/**
 * GET /api/orders/history
 * Returns order history from the local Supabase orders table.
 * In sandbox mode, all orders (both sandbox API and mock) are stored here.
 * Optionally filter by user_id query param.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const user_id = req.query.user_id as string
    const limit = Math.min(Number(req.query.limit) || 50, 200)

    try {
        let query = supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (user_id) {
            query = query.eq('user_id', user_id)
        }

        const { data: orders, error } = await query

        if (error) {
            return res.status(500).json({ status: 'error', message: error.message })
        }

        return res.status(200).json({
            status: 'success',
            mode: IS_SANDBOX ? 'sandbox' : 'live',
            count: orders?.length || 0,
            data: orders || [],
            token_configured: !!getAccessToken(),
        })
    } catch (err: any) {
        return res.status(500).json({ status: 'error', message: err.message })
    }
}
