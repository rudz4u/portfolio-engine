import { createServerClient } from '@supabase/ssr'
import { type NextApiRequest, type NextApiResponse } from 'next'

/**
 * Creates a Supabase server client for use in API routes (Pages Router).
 * Reads/writes auth cookies from the request/response pair.
 */
export function createClient(req: NextApiRequest, res: NextApiResponse) {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return Object.keys(req.cookies).map((name) => ({
                        name,
                        value: req.cookies[name] || '',
                    }))
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        res.setHeader('Set-Cookie', serialize(name, value, options))
                    })
                },
            },
        }
    )
}

/**
 * Creates a Supabase admin client with the service role key.
 * Use this for server-side operations that bypass RLS.
 */
export function createAdminClient() {
    const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

function serialize(
    name: string,
    value: string,
    options: Record<string, any> = {}
): string {
    let cookie = `${name}=${encodeURIComponent(value)}`
    if (options.maxAge != null) cookie += `; Max-Age=${options.maxAge}`
    if (options.domain) cookie += `; Domain=${options.domain}`
    if (options.path) cookie += `; Path=${options.path}`
    else cookie += `; Path=/`
    if (options.httpOnly) cookie += `; HttpOnly`
    if (options.secure) cookie += `; Secure`
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`
    return cookie
}
