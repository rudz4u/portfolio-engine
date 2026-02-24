import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { code, state, error } = req.query

    if (error) {
        return res.redirect(`/dashboard?error=${error}`)
    }

    if (!code) {
        return res.status(400).json({ error: 'Missing authorization code' })
    }

    try {
        const clientId = process.env.UPSTOX_CLIENT_ID || 'bbf36103-0716-4731-aea7-a2bd8d4a1c3f'
        const clientSecret = process.env.UPSTOX_CLIENT_SECRET || 'ovb664yxjf'
        const redirectUri = process.env.UPSTOX_REDIRECT_URI || 'https://brokerai.rudz.in/api/oauth/upstox/callback'

        const tokenRes = await fetch('https://api.upstox.com/v2/login/authorization/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                code: code.toString(),
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            }).toString()
        })

        const tokenData = await tokenRes.json()

        if (!tokenRes.ok) {
            console.error('Upstox Token Error:', tokenData)
            return res.redirect(`/dashboard?error=token_exchange_failed`)
        }

        const accessToken = tokenData.access_token

        // NOTE: In a full production application setting with cookie-based NextAuth or Supabase SSR,
        // you would retrieve the authenticated user ID here and save the `accessToken` directly to their `user_settings` database row.

        console.log("Successfully obtained access token for user!")

        res.redirect(`/dashboard?success=oauth_completed`)
    } catch (err: any) {
        console.error('OAuth Callback Error:', err)
        return res.redirect(`/dashboard?error=internal_server_error`)
    }
}
