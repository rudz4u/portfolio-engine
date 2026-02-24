import { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const { code, state, error } = req.query

    if (error) {
        return res.redirect(`/dashboard?error=${error}`)
    }

    if (!code) {
        return res.status(400).json({ error: 'Missing authorization code' })
    }

    // Skeleton implementation returning mock token
    // In production, exchange the code for access token via POST to /v2/login/authorization/token

    const mockToken = 'upstox_mock_access_token_12345'

    // Redirect back to dashboard indicating success
    res.redirect(`/dashboard?success=oauth_completed`)
}
