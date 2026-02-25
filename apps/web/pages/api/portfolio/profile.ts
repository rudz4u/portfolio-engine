import { NextApiRequest, NextApiResponse } from 'next'

// Upstox sandbox tokens require a different base URL
const UPSTOX_BASE = process.env.UPSTOX_SANDBOX === 'false'
    ? 'https://api.upstox.com'
    : 'https://api-sandbox.upstox.com'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN

    if (!accessToken || accessToken === 'PASTE_YOUR_FULL_TOKEN_HERE') {
        return res.status(200).json({
            status: 'no_token',
            message: 'UPSTOX_ACCESS_TOKEN not configured. Set it in .env.local and Netlify env vars.',
            base_url: UPSTOX_BASE
        })
    }

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
                base_url_used: UPSTOX_BASE,
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
