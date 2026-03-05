import { NextRequest, NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { parseOAuthState } from "../authorize/route"

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

  const redirectUri =
    UPSTOX_CONFIG.redirectUri ||
    "https://investbuddyai.com/api/oauth/upstox/callback"
  const baseUrl = new URL(redirectUri).origin

  if (error || !code) {
    console.error("[OAuth callback] Upstox returned error:", error)
    return NextResponse.redirect(
      `${baseUrl}/settings?error=upstox_auth_failed&message=${encodeURIComponent(
        error || "No authorisation code returned"
      )}`
    )
  }

  // ── 1. Exchange code for access token ────────────────────────────────────
  let accessToken: string
  try {
    const tokenRes = await fetch(UPSTOX_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: UPSTOX_CONFIG.clientId,
        client_secret: UPSTOX_CONFIG.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[OAuth callback] Token exchange failed:", tokenData)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=token_exchange_failed&message=${encodeURIComponent(
          tokenData.message || "Token exchange failed"
        )}`
      )
    }

    accessToken = tokenData.access_token
  } catch (err) {
    console.error("[OAuth callback] Token fetch threw:", err)
    return NextResponse.redirect(`${baseUrl}/settings?error=token_fetch_error`)
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


  const redirectUri =
    UPSTOX_CONFIG.redirectUri ||
    "https://investbuddyai.com/api/oauth/upstox/callback"
  const baseUrl = new URL(redirectUri).origin

  if (error || !code) {
    console.error("[OAuth callback] Upstox returned error:", error)
    return NextResponse.redirect(
      `${baseUrl}/settings?error=upstox_auth_failed&message=${encodeURIComponent(
        error || "No authorisation code returned"
      )}`
    )
  }

  // ── CSRF: validate state cookie ───────────────────────────────────────────
  const stateCookie = request.cookies.get("upstox_oauth_state")?.value
  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    console.error(
      "[OAuth callback] State mismatch — possible CSRF or stale flow",
      { stateParam, stateCookie }
    )
    return NextResponse.redirect(
      `${baseUrl}/settings?error=state_mismatch&message=${encodeURIComponent(
        "OAuth session expired or state mismatch. Please try connecting again."
      )}`
    )
  }

  // ── 1. Exchange code for access token ────────────────────────────────────
  let accessToken: string
  try {
    const tokenRes = await fetch(UPSTOX_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: UPSTOX_CONFIG.clientId,
        client_secret: UPSTOX_CONFIG.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[OAuth callback] Token exchange failed:", tokenData)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=token_exchange_failed&message=${encodeURIComponent(
          tokenData.message || "Token exchange failed"
        )}`
      )
    }

    accessToken = tokenData.access_token
  } catch (err) {
    console.error("[OAuth callback] Token fetch threw:", err)
    return NextResponse.redirect(`${baseUrl}/settings?error=token_fetch_error`)
  }

  // ── 2. Fetch Upstox user profile (email + name) ──────────────────────────
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

  // ── Helper: save token into user_settings.preferences JSONB ──────────────
  async function saveToken(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: Awaited<ReturnType<typeof createClient>>,
    userId: string
  ) {
    const { data: existing } = await client
      .from("user_settings")
      .select("preferences")
      .eq("user_id", userId)
      .single()

    const prefs: Record<string, string> =
      ((existing?.preferences as Record<string, string>) ?? {})
    prefs.upstox_access_token = accessToken

    return client.from("user_settings").upsert(
      { user_id: userId, preferences: prefs, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
  }

  // Clear the one-time state cookie regardless of outcome.
  function clearStateCookie(response: NextResponse) {
    response.cookies.set("upstox_oauth_state", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    })
    return response
  }

  // ── 3A. Logged-in user → connect flow ────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { error: saveError } = await saveToken(supabase, user.id)
    if (saveError) {
      console.error("[OAuth callback] Failed to save token for logged-in user:", saveError)
      return clearStateCookie(
        NextResponse.redirect(
          `${baseUrl}/settings?error=save_token_failed&message=${encodeURIComponent(
            saveError.message || "Could not save the Upstox token. Please try again."
          )}`
        )
      )
    }
    console.log(`[OAuth callback] Token saved for logged-in user ${user.id}`)
    return clearStateCookie(
      NextResponse.redirect(`${baseUrl}/settings?success=upstox_connected&sync=1`)
    )
  }

  // ── 3B. Not logged in → auto sign-in / sign-up via magic link ────────────
  if (!upstoxEmail) {
    console.error("[OAuth callback] No email from Upstox profile — cannot auto sign-in")
    return clearStateCookie(
      NextResponse.redirect(
        `${baseUrl}/signin?error=no_email&message=${encodeURIComponent(
          "Upstox did not share your email. Please sign in or sign up manually, then connect Upstox from Settings."
        )}`
      )
    )
  }

  try {
    const adminClient = await createAdminClient()

    // generateLink creates the Supabase user if they don't exist yet,
    // and returns the user object (with .id) + a one-time action_link URL.
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
      return clearStateCookie(
        NextResponse.redirect(
          `${baseUrl}/signin?error=link_failed&message=${encodeURIComponent(
            "Could not create a sign-in link. Please sign in or sign up manually."
          )}`
        )
      )
    }

    const targetUserId = linkData.user.id

    // Save the Upstox token for this user (created or already existing)
    const { error: saveError } = await saveToken(adminClient as Awaited<ReturnType<typeof createClient>>, targetUserId)
    if (saveError) {
      console.error("[OAuth callback] Failed to pre-save token:", saveError)
      // Non-fatal: user can reconnect from Settings after sign-in
    }

    // Redirect directly to the magic link — this signs the user in and
    // lands them on /settings?success=upstox_connected&sync=1
    const actionLink = linkData.properties.action_link
    console.log(`[OAuth callback] Magic-link sign-in generated for ${upstoxEmail} (user ${targetUserId})`)
    return clearStateCookie(NextResponse.redirect(actionLink))
  } catch (err) {
    console.error("[OAuth callback] Admin flow threw:", err)
    return clearStateCookie(
      NextResponse.redirect(
        `${baseUrl}/signin?error=admin_error&message=${encodeURIComponent(
          "Sign-in failed. Please try again or use email sign-in."
        )}`
      )
    )
  }
}
