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

        if (!isTokenValid) {
            return res.status(200).json({
                status: 'invalid_token',
                mode: 'sandbox',
                message: 'Access token appears invalid. Generate a new one from the Upstox Developer Portal → Sandbox section.',
                sandbox_order_available: false,
                holdings_source: 'supabase',
            })
        }

        // Actually validate the token by making a test call to Upstox
        try {
            const testRes = await fetch(UPSTOX_ENDPOINTS.placeOrder, {
                method: 'POST',
                headers: upstoxHeaders(accessToken),
                body: JSON.stringify({
                    quantity: 1,
                    product: 'D',
                    validity: 'DAY',
                    price: 0,
                    tag: 'connection_test',
                    instrument_token: 'NSE_EQ|INE669E01016',
                    order_type: 'MARKET',
                    transaction_type: 'BUY',
                    disclosed_quantity: 0,
                    trigger_price: 0,
                    is_amo: false
                })
            })
            const testData = await testRes.json()

            // UDAPI100050 = Invalid token
            if (testData?.errors?.[0]?.errorCode === 'UDAPI100050') {
                return res.status(200).json({
                    status: 'token_invalid',
                    mode: 'sandbox',
                    message: 'Token rejected by Upstox (UDAPI100050). This usually means the token was generated from a regular app instead of a Sandbox App. Go to Upstox Developer Portal → Sandbox section → Generate a new sandbox-specific token.',
                    sandbox_order_available: false,
                    holdings_source: 'supabase',
                    api_base: 'https://api-hft.upstox.com',
                    upstox_error: testData,
                    fix_steps: [
                        '1. Go to https://account.upstox.com/developer/apps#sandbox',
                        '2. Create a New Sandbox App (if you don\'t have one)',
                        '3. Click "Generate" to create a sandbox token (valid 30 days)',
                        '4. Update UPSTOX_ACCESS_TOKEN in .env.local and Netlify env vars',
                        '5. Redeploy'
                    ]
                })
            }

            // If we get a success or any non-auth error, the token is valid
            return res.status(200).json({
                status: 'sandbox_ready',
                mode: 'sandbox',
                message: 'Sandbox mode active with valid access token. Order APIs (Place/Modify/Cancel) are ready for testing. Holdings served from Supabase seeded data.',
                sandbox_order_available: true,
                holdings_source: 'supabase',
                api_base: 'https://api-hft.upstox.com',
                supported_endpoints: SANDBOX_SUPPORTED.map(ep => `${ep.method} ${ep.path}`),
                token_test: testData?.status === 'success' ? 'order_placed' : 'token_valid_order_rejected',
                test_response: testData
            })
        } catch (err: any) {
            // Network error — can't validate, report as ready with caveat
            return res.status(200).json({
                status: 'sandbox_ready',
                mode: 'sandbox',
                message: 'Sandbox mode active with access token configured. Could not validate token against Upstox (network issue). Order APIs should be ready for testing.',
                sandbox_order_available: true,
                holdings_source: 'supabase',
                api_base: 'https://api-hft.upstox.com',
                supported_endpoints: SANDBOX_SUPPORTED.map(ep => `${ep.method} ${ep.path}`),
                validation_error: err.message
            })
        }
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
