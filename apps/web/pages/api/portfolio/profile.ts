import { NextApiRequest, NextApiResponse } from 'next'
import { IS_SANDBOX, UPSTOX_ENDPOINTS, getAccessToken, upstoxHeaders, SANDBOX_SUPPORTED, LIVE_ONLY_ENDPOINTS } from '../../../lib/upstoxConfig'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const accessToken = getAccessToken()

    if (!accessToken) {
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
            note: 'Upstox Sandbox only supports Order APIs (Place/Modify/Cancel). Profile and Holdings endpoints require a live account token (UPSTOX_SANDBOX=false).',
            sandbox_supported_endpoints: SANDBOX_SUPPORTED.map(ep => `${ep.method} ${ep.path}`),
            live_only_endpoints: LIVE_ONLY_ENDPOINTS
        })
    }

    // Live mode — actually call the API
    try {
        const profileRes = await fetch(UPSTOX_ENDPOINTS.profile, {
            headers: upstoxHeaders(accessToken)
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
            profile: profileData?.data
        })
    } catch (err: any) {
        return res.status(500).json({ status: 'error', message: err.message })
    }
}
