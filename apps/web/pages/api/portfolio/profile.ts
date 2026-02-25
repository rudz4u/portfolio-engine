import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN

    if (!accessToken || accessToken === 'PASTE_YOUR_FULL_TOKEN_HERE') {
        return res.status(200).json({
            status: 'no_token',
            message: 'UPSTOX_ACCESS_TOKEN not configured. Set it in .env.local and Netlify env vars.'
        })
    }

    try {
        const profileRes = await fetch('https://api.upstox.com/v2/user/profile', {
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
            profile: profileData?.data
        })
    } catch (err: any) {
        return res.status(500).json({ status: 'error', message: err.message })
    }
}
