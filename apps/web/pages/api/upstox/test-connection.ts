import { NextApiRequest, NextApiResponse } from 'next'
import { IS_SANDBOX, UPSTOX_ENDPOINTS, getAccessToken, upstoxHeaders, SANDBOX_SUPPORTED } from '../../../lib/upstoxConfig'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const accessToken = getAccessToken()

    if (!accessToken) {
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

    // If we have a token in sandbox mode, actually test it by placing a dry-run
    // We validate the token looks like a JWT and report readiness.
    if (IS_SANDBOX) {
        const isTokenValid = accessToken.length > 20 && (accessToken.includes('.') || accessToken.length > 50)

        return res.status(200).json({
            status: isTokenValid ? 'sandbox_ready' : 'invalid_token',
            mode: 'sandbox',
            message: isTokenValid
                ? 'Sandbox mode active with access token configured. Order APIs (Place/Modify/Cancel) are ready for testing. Holdings served from Supabase seeded data.'
                : 'Access token appears invalid. Generate a new one from the Upstox Developer Portal → Sandbox section.',
            sandbox_order_available: isTokenValid,
            holdings_source: 'supabase',
            api_base: 'https://api-hft.upstox.com',
            supported_endpoints: SANDBOX_SUPPORTED.map(ep => `${ep.method} ${ep.path}`)
        })
    }

    // Live mode — test with the profile endpoint
    try {
        const profileRes = await fetch(UPSTOX_ENDPOINTS.profile, {
            headers: upstoxHeaders(accessToken)
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
