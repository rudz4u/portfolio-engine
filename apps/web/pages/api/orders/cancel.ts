import { NextApiRequest, NextApiResponse } from 'next'
import { createAdminClient } from '../../../lib/supabase/server'
import { IS_SANDBOX, UPSTOX_ENDPOINTS, getAccessToken, upstoxHeaders } from '../../../lib/upstoxConfig'

const supabase = createAdminClient()


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method Not Allowed. Use DELETE.' })
    }

    const order_id = (req.query.order_id as string) || req.body?.order_id
    const user_id = (req.query.user_id as string) || req.body?.user_id

    if (!order_id) {
        return res.status(400).json({ error: 'Missing required parameter: order_id' })
    }

    const accessToken = getAccessToken()

    if (!accessToken) {
        return res.status(200).json({
            status: 'no_token',
            mode: IS_SANDBOX ? 'sandbox' : 'live',
            message: 'No access token configured. Cannot cancel orders without an Upstox access token.'
        })
    }

    try {
        const cancelUrl = `${UPSTOX_ENDPOINTS.cancelOrder}?order_id=${encodeURIComponent(order_id)}`

        const upstoxRes = await fetch(cancelUrl, {
            method: 'DELETE',
            headers: upstoxHeaders(accessToken),
        })

        const upstoxData = await upstoxRes.json()

        // Log to Supabase
        if (user_id) {
            await supabase
                .from('orders')
                .insert([{
                    user_id,
                    instrument_key: 'CANCEL',
                    side: 'CANCEL',
                    quantity: 0,
                    price: null,
                    status: upstoxRes.ok ? 'CANCELLED' : 'CANCEL_FAILED',
                    external_order_id: order_id,
                    meta: {
                        source: IS_SANDBOX ? 'upstox_sandbox' : 'upstox_live',
                        action: 'cancel',
                        api_url: cancelUrl,
                        response: upstoxData,
                        http_status: upstoxRes.status
                    }
                }])
        }

        if (!upstoxRes.ok) {
            return res.status(upstoxRes.status).json({
                status: 'error',
                mode: IS_SANDBOX ? 'sandbox' : 'live',
                message: `Cancel order failed: ${upstoxData?.errors?.[0]?.message || upstoxData?.message || 'Unknown error'}`,
                upstox_response: upstoxData
            })
        }

        return res.status(200).json({
            status: 'success',
            mode: IS_SANDBOX ? 'sandbox' : 'live',
            order_id: upstoxData?.data?.order_id,
            message: `Order ${order_id} cancelled successfully.`,
            upstox_response: upstoxData
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 'error',
            message: `Failed to cancel order: ${err.message}`
        })
    }
}
