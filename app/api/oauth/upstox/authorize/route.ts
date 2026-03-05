import { NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"

/**
 * GET /api/oauth/upstox/authorize
 * Redirects the user to Upstox's OAuth2 authorization page.
 * A random `state` value is generated for CSRF protection and stored in a
 * short-lived HttpOnly cookie.  The callback validates it before proceeding.
 */
export async function GET() {
  const clientId = UPSTOX_CONFIG.clientId
  if (!clientId) {
    return NextResponse.json(
      { error: "UPSTOX_CLIENT_ID is not configured on the server." },
      { status: 500 }
    )
  }

  // The redirect URI MUST match exactly what is registered in the Upstox developer portal.
  const redirectUri =
    UPSTOX_CONFIG.redirectUri ||
    "https://investbuddyai.com/api/oauth/upstox/callback"

  // Generate a random state token for CSRF protection.
  const state = crypto.randomUUID().replace(/-/g, "")

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  })

  const response = NextResponse.redirect(
    `${UPSTOX_CONFIG.authUrl}?${params.toString()}`
  )

  // Store state in a short-lived first-party cookie so the callback can verify it.
  response.cookies.set("upstox_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes — enough time for the user to complete Upstox login
    path: "/",
  })

  return response
}
