import { NextApiRequest, NextApiResponse } from 'next'

const IS_SANDBOX = process.env.UPSTOX_SANDBOX !== 'false'
const UPSTOX_BASE = IS_SANDBOX ? 'https://api.upstox.com' : 'https://api.upstox.com'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN

    if (!accessToken || accessToken === 'PASTE_YOUR_FULL_TOKEN_HERE') {
        return res.status(200).json({
            status: IS_SANDBOX ? 'sandbox_mode' : 'no_token',
            mode: IS_SANDBOX ? 'sandbox' : 'live',
            message: IS_SANDBOX
                ? 'Sandbox mode active. Holdings are served from Supabase. Set UPSTOX_ACCESS_TOKEN for sandbox order testing.'
                : 'Set UPSTOX_ACCESS_TOKEN to connect your live Upstox account.',
            sandbox_order_available: false,
            holdings_source: IS_SANDBOX ? 'supabase' : 'upstox_api'
        })
    }

    // If we have a token, test it by calling a lightweight endpoint
    // In sandbox mode, only order APIs work. We'll test by checking if the token format looks valid.
    if (IS_SANDBOX) {
        // Sandbox tokens don't work with profile/holdings endpoints.
        // We validate the token looks reasonable (JWT-like) and report sandbox_ready.
        const isTokenValid = accessToken.length > 20

        return res.status(200).json({
            status: isTokenValid ? 'sandbox_ready' : 'invalid_token',
            mode: 'sandbox',
            message: isTokenValid
                ? 'Sandbox mode active with access token configured. Order APIs (Place/Modify/Cancel) are ready for testing. Holdings served from Supabase seeded data.'
                : 'Access token appears invalid. Generate a new one from the Upstox Developer Portal.',
            sandbox_order_available: isTokenValid,
            holdings_source: 'supabase',
            supported_endpoints: [
                'POST /v2/order/place',
                'PUT /v2/order/modify',
                'DELETE /v2/order/cancel',
                'POST /v3/order/place',
            ]
        })
    }

    // Live mode — test with the profile endpoint
    try {
        const profileRes = await fetch(`${UPSTOX_BASE}/v2/user/profile`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        })
        const profileData = await profileRes.json()

        if (!profileRes.ok) {
            return res.status(200).json({
                status: 'error',
                mode: 'live',
                message: 'Upstox token invalid or expired. Generate a new access token.',
                details: profileData
            })
        }

        return res.status(200).json({
            status: 'connected',
            mode: 'live',
            message: `Connected to Upstox as ${profileData?.data?.user_name || 'Unknown User'}`,
            profile: profileData?.data,
            holdings_source: 'upstox_api'
        })
    } catch (err: any) {
        return res.status(500).json({
            status: 'error',
            mode: 'live',
            message: err.message
        })
    }
}
