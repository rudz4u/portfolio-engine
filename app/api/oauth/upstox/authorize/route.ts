import { NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"

/**
 * GET /api/oauth/upstox/authorize
 * Redirects the user to Upstox's OAuth2 authorization page.
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
    "https://brokerai.rudz.in/api/oauth/upstox/callback"

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
  })

  return NextResponse.redirect(
    `${UPSTOX_CONFIG.authUrl}?${params.toString()}`
  )
}
