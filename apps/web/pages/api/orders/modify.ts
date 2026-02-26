import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { IS_SANDBOX, UPSTOX_ENDPOINTS, getAccessToken, upstoxHeaders } from '../../../lib/upstoxConfig'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method Not Allowed. Use PUT.' })
    }

    const { order_id, quantity, price, order_type, validity, trigger_price, disclosed_quantity, user_id } = req.body

    if (!order_id) {
        return res.status(400).json({ error: 'Missing required parameter: order_id' })
    }

    const accessToken = getAccessToken()

    if (!accessToken) {
        return res.status(200).json({
            status: 'no_token',
            mode: IS_SANDBOX ? 'sandbox' : 'live',
            message: 'No access token configured. Cannot modify orders without an Upstox access token.'
        })
    }

    try {
        const modifyPayload: Record<string, any> = {
            order_id,
            order_type: order_type || 'LIMIT',
            validity: validity || 'DAY',
        }

        if (quantity !== undefined) modifyPayload.quantity = Number(quantity)
        if (price !== undefined) modifyPayload.price = Number(price)
        // Upstox requires trigger_price even for non-SL orders (defaults to 0)
        modifyPayload.trigger_price = trigger_price !== undefined ? Number(trigger_price) : 0
        if (disclosed_quantity !== undefined) modifyPayload.disclosed_quantity = Number(disclosed_quantity)

        const upstoxRes = await fetch(UPSTOX_ENDPOINTS.modifyOrder, {
            method: 'PUT',
            headers: upstoxHeaders(accessToken),
            body: JSON.stringify(modifyPayload)
        })

        const upstoxData = await upstoxRes.json()

        // Log to Supabase
        if (user_id) {
            await supabase
                .from('orders')
                .insert([{
                    user_id,
                    instrument_key: 'MODIFY',
                    side: 'MODIFY',
                    quantity: quantity ? Number(quantity) : 0,
                    price: price ? Number(price) : null,
                    status: upstoxRes.ok ? 'MODIFIED' : 'MODIFY_FAILED',
                    external_order_id: order_id,
                    meta: {
                        source: IS_SANDBOX ? 'upstox_sandbox' : 'upstox_live',
                        action: 'modify',
                        api_url: UPSTOX_ENDPOINTS.modifyOrder,
                        request: modifyPayload,
                        response: upstoxData,
                        http_status: upstoxRes.status
                    }
                }])
        }

        if (!upstoxRes.ok) {
            return res.status(upstoxRes.status).json({
                status: 'error',
                mode: IS_SANDBOX ? 'sandbox' : 'live',
                message: `Modify order failed: ${upstoxData?.errors?.[0]?.message || upstoxData?.message || 'Unknown error'}`,
                upstox_response: upstoxData
            })
        }

        return res.status(200).json({
            status: 'success',
            mode: IS_SANDBOX ? 'sandbox' : 'live',
            order_id: upstoxData?.data?.order_id,
            message: `Order ${order_id} modified successfully.`,
            upstox_response: upstoxData
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 'error',
            message: `Failed to modify order: ${err.message}`
        })
    }
}
