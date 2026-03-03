import { NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"

export async function GET() {
  const { clientId, redirectUri, authUrl } = UPSTOX_CONFIG

  if (!clientId) {
    return NextResponse.json(
      { error: "UPSTOX_CLIENT_ID not configured" },
      { status: 400 }
    )
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: "portfolio_connect",
  })

  return NextResponse.redirect(`${authUrl}?${params.toString()}`)
}
