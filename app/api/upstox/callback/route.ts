import { NextRequest, NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  const baseUrl = new URL(request.url).origin

  if (error || !code) {
    return NextResponse.redirect(
      `${baseUrl}/settings?error=upstox_auth_failed&message=${encodeURIComponent(error || "No code returned")}`
    )
  }

  // Exchange code for access token
  const body = new URLSearchParams({
    code,
    client_id: UPSTOX_CONFIG.clientId,
    client_secret: UPSTOX_CONFIG.clientSecret,
    redirect_uri: UPSTOX_CONFIG.redirectUri,
    grant_type: "authorization_code",
  })

  try {
    const res = await fetch(UPSTOX_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })

    const tokenData = await res.json()

    if (!res.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=token_exchange_failed&message=${encodeURIComponent(tokenData.message || "Token exchange failed")}`
      )
    }

    // Save token to user_settings
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/signin`)
    }

    // Upsert user_settings with the new token
    const { error: settingsError } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        upstox_access_token: tokenData.access_token,
        upstox_token_expiry: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        upstox_connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

    if (settingsError) {
      console.error("Failed to save Upstox token:", settingsError)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=save_token_failed`
      )
    }

    return NextResponse.redirect(`${baseUrl}/settings?success=upstox_connected`)
  } catch (err) {
    console.error("Upstox callback error:", err)
    return NextResponse.redirect(
      `${baseUrl}/settings?error=callback_error`
    )
  }
}
