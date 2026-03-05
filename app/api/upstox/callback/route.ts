import { NextRequest, NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"
import { createClient } from "@/lib/supabase/server"

// Legacy callback path kept for backward-compatibility with any Upstox developer-portal
// URIs that still point to /api/upstox/callback instead of /api/oauth/upstox/callback.
// Both paths save the token identically (into user_settings.preferences JSONB).
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  const baseUrl = new URL(request.url).origin

  if (error || !code) {
    return NextResponse.redirect(
      `${baseUrl}/settings?error=upstox_auth_failed&message=${encodeURIComponent(
        error || "No authorisation code returned"
      )}`
    )
  }

  // ── 1. Exchange authorisation code for access token ───────────────────────
  let accessToken: string
  try {
    const res = await fetch(UPSTOX_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: UPSTOX_CONFIG.clientId,
        client_secret: UPSTOX_CONFIG.clientSecret,
        redirect_uri: UPSTOX_CONFIG.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    })

    const tokenData = await res.json()

    if (!res.ok || !tokenData.access_token) {
      console.error("[upstox/callback] Token exchange failed:", tokenData)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=token_exchange_failed&message=${encodeURIComponent(
          tokenData.message || "Token exchange failed"
        )}`
      )
    }

    accessToken = tokenData.access_token
  } catch (err) {
    console.error("[upstox/callback] Token fetch threw:", err)
    return NextResponse.redirect(`${baseUrl}/settings?error=token_fetch_error`)
  }

  // ── 2. Detect logged-in user and save token to preferences JSONB ──────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Session not found — ask the user to sign in again and reconnect from Settings.
    console.warn("[upstox/callback] No active session at callback; redirecting to sign-in")
    return NextResponse.redirect(
      `${baseUrl}/signin?error=session_expired&message=${encodeURIComponent(
        "Your session expired. Please sign in again and reconnect Upstox from Settings."
      )}`
    )
  }

  // Read existing preferences so we can merge (not overwrite) the token.
  const { data: existing } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  const prefs: Record<string, string> =
    ((existing?.preferences as Record<string, string>) ?? {})
  prefs.upstox_access_token = accessToken

  const { error: saveError } = await supabase.from("user_settings").upsert(
    { user_id: user.id, preferences: prefs, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  )

  if (saveError) {
    console.error("[upstox/callback] Failed to save token:", saveError)
    return NextResponse.redirect(
      `${baseUrl}/settings?error=save_token_failed&message=${encodeURIComponent(
        saveError.message
      )}`
    )
  }

  console.log(`[upstox/callback] Token saved for user ${user.id}`)
  return NextResponse.redirect(
    `${baseUrl}/settings?success=upstox_connected&sync=1`
  )
}
