import { NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"
import { createClient } from "@/lib/supabase/server"
import { createOAuthState } from "@/lib/upstox-oauth-state"

/**
 * GET /api/oauth/upstox/authorize
 * Redirects the user to Upstox's OAuth2 authorization page.
 *
 * CSRF protection: the current user's Supabase user ID is embedded in the
 * `state` parameter as an HMAC-signed, base64url-encoded token.
 * The callback verifies the signature server-side — NO browser cookie needed.
 * This works reliably on Netlify where Set-Cookie headers on 302 redirects
 * can be stripped by the CDN edge layer before reaching the browser.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const clientId = UPSTOX_CONFIG.clientId
  if (!clientId) {
    return NextResponse.json(
      { error: "UPSTOX_CLIENT_ID is not configured on the server." },
      { status: 500 }
    )
  }

  const redirectUri =
    UPSTOX_CONFIG.redirectUri ||
    "https://investbuddyai.com/api/oauth/upstox/callback"

  // Embed the logged-in user's ID in the state for CSRF-safe identity passing.
  // The settings page is a protected route, so the user is always authenticated here.
  let userId = "anon"
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) userId = user.id
  } catch {
    // Fallback: anon state — callback will use session instead
  }

  const state = createOAuthState(userId)

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  })

  return NextResponse.redirect(
    `${UPSTOX_CONFIG.authUrl}?${params.toString()}`
  )
}
