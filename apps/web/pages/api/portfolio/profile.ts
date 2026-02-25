import { NextApiRequest, NextApiResponse } from 'next'

const UPSTOX_BASE = process.env.UPSTOX_SANDBOX === 'false'
    ? 'https://api.upstox.com'
    : 'https://api-sandbox.upstox.com'

const IS_SANDBOX = process.env.UPSTOX_SANDBOX !== 'false'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN

    if (!accessToken || accessToken === 'PASTE_YOUR_FULL_TOKEN_HERE') {
        return res.status(200).json({
            status: 'no_token',
            message: 'UPSTOX_ACCESS_TOKEN not configured.'
        })
    }

    // Sandbox does NOT support /v2/user/profile
    // Only Order APIs are sandbox-enabled. Profile/Holdings require a live account.
    if (IS_SANDBOX) {
        return res.status(200).json({
            status: 'sandbox_mode',
            base_url: UPSTOX_BASE,
            note: 'Upstox Sandbox only supports Order APIs (Place/Modify/Cancel). Profile and Holdings endpoints require a live account token (UPSTOX_SANDBOX=false).',
            sandbox_supported_endpoints: [
                'POST /v2/order/place',
                'PUT /v2/order/modify',
                'DELETE /v2/order/cancel',
                'POST /v3/order/place',
            ],
            live_only_endpoints: [
                'GET /v2/user/profile',
                'GET /v2/portfolio/long-term-holdings',
                'GET /v2/portfolio/positions',
                'GET /v2/user/fund-margin'
            ]
        })
    }

    // Live mode — actually call the API
    try {
        const profileRes = await fetch(`${UPSTOX_BASE}/v2/user/profile`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        })
        const profileData = await profileRes.json()

        if (!profileRes.ok) {
            return res.status(profileRes.status).json({
                status: 'error',
                message: 'Upstox token invalid or expired',
                details: profileData
            })
        }

        return res.status(200).json({
            status: 'connected',
            base_url: UPSTOX_BASE,
            profile: profileData?.data
        })
    } catch (err: any) {
        return res.status(500).json({ status: 'error', message: err.message })
    }
}
