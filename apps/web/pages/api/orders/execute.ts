import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { instrument_key, side, quantity, price, user_id } = req.body

    if (!instrument_key || !side || !quantity || !user_id) {
        return res.status(400).json({ error: 'Missing required order configuration parameters.' })
    }

    // In production, this would make a live POST request to Upstox's /v2/order/place endpoint
    // using the user's stored access_token from `user_settings`.

    // Mock execution
    const mockExternalOrderId = 'mock_upstox_order_' + Math.random().toString(36).substring(7)

    // Insert into local Supabase mock `orders` table for tracking
    const { data, error } = await supabase
        .from('orders')
        .insert([
            {
                user_id,
                instrument_key,
                side, // 'BUY' or 'SELL'
                quantity,
                price: price || null, // null implies market order for this mock
                status: 'COMPLETE', // usually 'OPEN' or 'PENDING' until webhook confirms
                external_order_id: mockExternalOrderId,
                meta: { source: 'dummy_api' }
            }
        ])
        .select()
        .single()

    if (error) {
        return res.status(500).json({ error: error.message })
    }

    // Simulate network latency communicating with Broker
    await new Promise(resolve => setTimeout(resolve, 600))

    return res.status(200).json({
        status: 'success',
        data: data,
        message: `Simulated ${side} order successfully executed and tracked.`
    })
}
