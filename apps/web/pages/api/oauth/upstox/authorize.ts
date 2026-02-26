import { NextApiRequest, NextApiResponse } from 'next'

const IS_SANDBOX = process.env.UPSTOX_SANDBOX !== 'false'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    // In sandbox mode, OAuth authorization dialog is NOT supported.
    // Redirect users to the settings page where they can paste their sandbox access token.
    if (IS_SANDBOX) {
        return res.redirect('/settings?info=sandbox_no_oauth')
    }

    // Live mode — redirect to Upstox OAuth authorization dialog
    const clientId = process.env.UPSTOX_CLIENT_ID || ''
    const redirectUri = process.env.UPSTOX_REDIRECT_URI || ''

    if (!clientId || !redirectUri) {
        return res.redirect('/settings?error=missing_config')
    }

    const state = 'secure_random_state'

    const authUrl = new URL('https://api.upstox.com/v2/login/authorization/dialog');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', state);

    res.redirect(authUrl.toString());
}
