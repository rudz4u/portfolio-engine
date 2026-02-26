import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const IS_SANDBOX = process.env.UPSTOX_SANDBOX !== 'false'
const UPSTOX_ORDER_URL = 'https://api.upstox.com/v2/order/place'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { instrument_key, side, quantity, price, user_id, order_type, product } = req.body

    if (!instrument_key || !side || !quantity || !user_id) {
        return res.status(400).json({ error: 'Missing required order configuration parameters.' })
    }

    const accessToken = process.env.UPSTOX_ACCESS_TOKEN

    // If sandbox mode AND we have an access token, try the real Upstox sandbox order API
    if (IS_SANDBOX && accessToken && accessToken !== 'PASTE_YOUR_FULL_TOKEN_HERE') {
        try {
            const orderPayload = {
                quantity: Number(quantity),
                product: product || 'D',        // D = Delivery, I = Intraday
                validity: 'DAY',
                price: price ? Number(price) : 0,
                tag: 'portfolio_engine',
                instrument_token: instrument_key,
                order_type: order_type || (price ? 'LIMIT' : 'MARKET'),
                transaction_type: side.toUpperCase(), // BUY or SELL
                disclosed_quantity: 0,
                trigger_price: 0,
                is_amo: false
            }

            const upstoxRes = await fetch(UPSTOX_ORDER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(orderPayload)
            })

            const upstoxData = await upstoxRes.json()

            // Log the order into Supabase regardless of outcome
            const { data: orderRow, error: insertError } = await supabase
                .from('orders')
                .insert([
                    {
                        user_id,
                        instrument_key,
                        side: side.toUpperCase(),
                        quantity: Number(quantity),
                        price: price ? Number(price) : null,
                        status: upstoxRes.ok ? 'SUBMITTED' : 'FAILED',
                        external_order_id: upstoxData?.data?.order_id || null,
                        meta: {
                            source: 'upstox_sandbox',
                            request: orderPayload,
                            response: upstoxData,
                            http_status: upstoxRes.status
                        }
                    }
                ])
                .select()
                .single()

            if (!upstoxRes.ok) {
                return res.status(upstoxRes.status).json({
                    status: 'error',
                    mode: 'sandbox',
                    message: `Upstox sandbox order failed: ${upstoxData?.errors?.[0]?.message || upstoxData?.message || 'Unknown error'}`,
                    upstox_response: upstoxData,
                    order_record: orderRow
                })
            }

            return res.status(200).json({
                status: 'success',
                mode: 'sandbox',
                data: orderRow,
                upstox_order_id: upstoxData?.data?.order_id,
                message: `Sandbox ${side.toUpperCase()} order placed via Upstox API. Order ID: ${upstoxData?.data?.order_id}`
            })
        } catch (err: any) {
            return res.status(500).json({
                status: 'error',
                mode: 'sandbox',
                message: `Failed to call Upstox sandbox: ${err.message}`
            })
        }
    }

    // Fallback: Mock execution (no access token or non-sandbox)
    const mockExternalOrderId = 'mock_order_' + Date.now() + '_' + Math.random().toString(36).substring(7)

    const { data, error } = await supabase
        .from('orders')
        .insert([
            {
                user_id,
                instrument_key,
                side: side.toUpperCase(),
                quantity: Number(quantity),
                price: price ? Number(price) : null,
                status: 'COMPLETE',
                external_order_id: mockExternalOrderId,
                meta: {
                    source: IS_SANDBOX ? 'mock_sandbox_no_token' : 'mock_live',
                    note: 'No Upstox access token configured. Order simulated locally.'
                }
            }
        ])
        .select()
        .single()

    if (error) {
        return res.status(500).json({ error: error.message })
    }

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 400))

    return res.status(200).json({
        status: 'success',
        mode: IS_SANDBOX ? 'mock_sandbox' : 'mock_live',
        data: data,
        message: `Simulated ${side.toUpperCase()} order executed locally. ${IS_SANDBOX ? 'Add UPSTOX_ACCESS_TOKEN to use real sandbox API.' : ''}`
    })
}
