import { NextApiRequest, NextApiResponse } from 'next'
import { createClient, createAdminClient } from '../../../../lib/supabase/server'

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

        // Exchange authorization code for access token
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

        // Get the authenticated Supabase user from their session cookie
        const supabase = createClient(req, res)
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
            console.error('OAuth callback: no authenticated user found', userError)
            return res.redirect(`/signin?next=/dashboard`)
        }

        // Merge access token into existing user settings row (preserving other keys)
        const admin = createAdminClient()
        const { data: existing } = await admin
            .from('user_settings')
            .select('encrypted_keys')
            .eq('user_id', user.id)
            .maybeSingle()

        let keys: Record<string, string> = {}
        if (existing?.encrypted_keys) {
            try { keys = JSON.parse(existing.encrypted_keys) } catch (_) { /* ignore */ }
        }
        keys.upstox_access_token = accessToken

        const { error: saveError } = await admin
            .from('user_settings')
            .upsert(
                { user_id: user.id, encrypted_keys: JSON.stringify(keys), updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
            )

        if (saveError) {
            console.error('Failed to save access token:', saveError)
            return res.redirect(`/dashboard?error=token_save_failed`)
        }

        console.log(`[OAuth] Saved Upstox access token for user ${user.id}`)
        return res.redirect(`/dashboard?success=oauth_completed`)
    } catch (err: any) {
        console.error('OAuth Callback Error:', err)
        return res.redirect(`/dashboard?error=internal_server_error`)
    }
}
