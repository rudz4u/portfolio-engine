import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const clientId = process.env.UPSTOX_CLIENT_ID || 'bbf36103-0716-4731-aea7-a2bd8d4a1c3f'
    const redirectUri = process.env.UPSTOX_REDIRECT_URI || 'https://brokerai.rudz.in/api/oauth/upstox/callback'
    const state = 'secure_random_state'

    const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`

    res.redirect(authUrl)
}
