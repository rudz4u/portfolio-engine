import { NextRequest, NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { parseOAuthState } from "@/lib/upstox-oauth-state"

/**
 * GET /api/oauth/upstox/callback
 * Upstox redirects here after the user grants access.
 *
 * CSRF protection: the `state` param carries an HMAC-signed user ID created
 * in the authorize handler.  We verify it server-side — no browser cookie needed.
 * This avoids the Netlify edge-CDN issue where Set-Cookie on 302 redirects
 * can be stripped before reaching the browser.
 *
 * Flows:
 *  A) state carries a valid userId  →  admin-client saves token directly
 *  B) state missing / "anon"        →  fall back to cookie session (getUser)
 *  C) no session + have Upstox email → magic-link sign-in / sign-up
 */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")
  const stateParam = searchParams.get("state")

  // Normalize redirect URI — trailing slash causes a mismatch on Upstox token exchange
  const redirectUri = (
    UPSTOX_CONFIG.redirectUri ||
    "https://investbuddyai.com/api/oauth/upstox/callback"
  ).replace(/\/$/, "")
  const baseUrl = new URL(redirectUri).origin

  if (error || !code) {
    console.error("[OAuth callback] Upstox returned error:", error)
    return NextResponse.redirect(
      `${baseUrl}/settings?error=upstox_auth_failed&message=${encodeURIComponent(
        error || "No authorisation code returned"
      )}`
    )
  }

  // Guard: catch misconfigured env vars early and surface them clearly
  if (!UPSTOX_CONFIG.clientId || !UPSTOX_CONFIG.clientSecret) {
    console.error("[OAuth callback] Missing Upstox credentials:", {
      hasClientId: !!UPSTOX_CONFIG.clientId,
      hasClientSecret: !!UPSTOX_CONFIG.clientSecret,
    })
    return NextResponse.redirect(
      `${baseUrl}/settings?error=misconfigured&message=${encodeURIComponent(
        "Upstox app credentials are not configured on the server. Contact the admin."
      )}`
    )
  }

  // ── 1. Exchange code for access token ────────────────────────────────────
  let accessToken: string
  try {
    const secret = UPSTOX_CONFIG.clientSecret
    const tokenBody = new URLSearchParams({
      code,
      client_id: UPSTOX_CONFIG.clientId,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString()

    // Diagnostic log — surface everything needed to debug token-exchange failures.
    // secret_preview is safe to log (first+last 3 chars only).
    console.log("[OAuth callback] Token exchange →", {
      tokenUrl: UPSTOX_CONFIG.tokenUrl,
      client_id: UPSTOX_CONFIG.clientId,
      redirect_uri: redirectUri,
      redirect_uri_len: redirectUri.length,
      secret_len: secret.length,
      secret_preview: secret.length > 0
        ? `${secret.slice(0, 3)}...${secret.slice(-3)}`
        : "(EMPTY — env var missing!)",
      code_len: code.length,
      code_preview: code.slice(0, 4),
    })

    const tokenRes = await fetch(UPSTOX_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenBody,
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      // Upstox v2 error format: { status, errors: [{ errorCode, message }] }
      const upstoxMsg =
        tokenData.errors?.[0]?.message ||
        tokenData.message ||
        tokenData.error_description ||
        tokenData.error ||
        `HTTP ${tokenRes.status}`

      // Stringify so nested objects (errorCode, propertyPath, etc.) are visible in logs
      console.error("[OAuth callback] Token exchange failed:", {
        httpStatus: tokenRes.status,
        upstoxMsg,
        tokenData: JSON.stringify(tokenData),
      })

      return NextResponse.redirect(
        `${baseUrl}/settings?error=token_exchange_failed&message=${encodeURIComponent(upstoxMsg)}`
      )
    }

    accessToken = tokenData.access_token
  } catch (err) {
    console.error("[OAuth callback] Token fetch threw:", err)
    return NextResponse.redirect(
      `${baseUrl}/settings?error=token_fetch_error&message=${encodeURIComponent(
        err instanceof Error ? err.message : String(err)
      )}`
    )
  }

  // ── Helper: save token into user_settings.preferences JSONB ──────────────
  // Always uses the admin client so it works regardless of RLS / session state.
  async function saveTokenAdmin(userId: string): Promise<string | null> {
    const admin = await createAdminClient()
    const { data: existing } = await admin
      .from("user_settings")
      .select("preferences")
      .eq("user_id", userId)
      .single()

    const prefs: Record<string, string> =
      ((existing?.preferences as Record<string, string>) ?? {})
    prefs.upstox_access_token = accessToken

    const { error: saveError } = await admin.from("user_settings").upsert(
      { user_id: userId, preferences: prefs, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    return saveError?.message ?? null
  }

  // ── 2A. Verify HMAC state → get userId without touching cookies/session ───
  const stateUserId = stateParam ? parseOAuthState(stateParam) : null

  if (stateUserId && stateUserId !== "anon") {
    // Happy path: we know exactly who this is — save and redirect.
    const saveErr = await saveTokenAdmin(stateUserId)
    if (saveErr) {
      console.error("[OAuth callback] saveTokenAdmin failed for state user:", saveErr)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=save_token_failed&message=${encodeURIComponent(
          saveErr || "Could not save the Upstox token. Please try again."
        )}`
      )
    }
    console.log(`[OAuth callback] Token saved via state for user ${stateUserId}`)
    return NextResponse.redirect(`${baseUrl}/settings?success=upstox_connected&sync=1`)
  }

  // ── 2B. Fallback: try Supabase cookie session (older authorize path, etc.) ─
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const saveErr = await saveTokenAdmin(user.id)
    if (saveErr) {
      console.error("[OAuth callback] saveTokenAdmin failed for session user:", saveErr)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=save_token_failed&message=${encodeURIComponent(
          saveErr || "Could not save the Upstox token. Please try again."
        )}`
      )
    }
    console.log(`[OAuth callback] Token saved via session for user ${user.id}`)
    return NextResponse.redirect(`${baseUrl}/settings?success=upstox_connected&sync=1`)
  }

  // ── 2C. No session and no valid state → try Upstox profile email ─────────
  let upstoxEmail: string | null = null
  let upstoxName: string | null = null
  try {
    const profileRes = await fetch("https://api.upstox.com/v2/user/profile", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    })
    if (profileRes.ok) {
      const profileData = await profileRes.json()
      upstoxEmail = profileData.data?.email ?? null
      upstoxName = profileData.data?.user_name ?? profileData.data?.name ?? null
    } else {
      console.warn("[OAuth callback] Upstox profile fetch status:", profileRes.status)
    }
  } catch (e) {
    console.error("[OAuth callback] Upstox profile fetch threw:", e)
  }

  if (!upstoxEmail) {
    console.error("[OAuth callback] No userId, no session, no Upstox email — cannot complete")
    return NextResponse.redirect(
      `${baseUrl}/signin?error=no_identity&message=${encodeURIComponent(
        "Could not identify your account. Please sign in and connect Upstox from Settings."
      )}`
    )
  }

  // ── 2D. Magic-link sign-in / sign-up for unrecognised email ──────────────
  try {
    const adminClient = await createAdminClient()

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: upstoxEmail,
      options: {
        data: { full_name: upstoxName ?? upstoxEmail },
        redirectTo: `${baseUrl}/settings?success=upstox_connected&sync=1`,
      },
    })

    if (linkError || !linkData) {
      console.error("[OAuth callback] generateLink failed:", linkError)
      return NextResponse.redirect(
        `${baseUrl}/signin?error=link_failed&message=${encodeURIComponent(
          "Could not create a sign-in link. Please sign in or sign up manually."
        )}`
      )
    }

    const targetUserId = linkData.user.id
    const saveErr = await saveTokenAdmin(targetUserId)
    if (saveErr) {
      console.error("[OAuth callback] Failed to pre-save token for magic-link user:", saveErr)
      // Non-fatal: user can reconnect from Settings after sign-in
    }

    const actionLink = linkData.properties.action_link
    console.log(`[OAuth callback] Magic-link sign-in for ${upstoxEmail} (user ${targetUserId})`)
    return NextResponse.redirect(actionLink)
  } catch (err) {
    console.error("[OAuth callback] Admin flow threw:", err)
    return NextResponse.redirect(
      `${baseUrl}/signin?error=admin_error&message=${encodeURIComponent(
        "Sign-in failed. Please try again or use email sign-in."
      )}`
    )
  }
}
