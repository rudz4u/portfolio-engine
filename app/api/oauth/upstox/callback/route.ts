import { NextRequest, NextResponse } from "next/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"
import { createClient, createAdminClient } from "@/lib/supabase/server"

/**
 * GET /api/oauth/upstox/callback
 * Upstox redirects here after the user grants access.
 * This handler supports two flows:
 *
 *  A) LOGGED-IN user (connect flow from /settings):
 *     Token is saved directly to user_settings and user is sent to /settings.
 *
 *  B) NOT LOGGED-IN user (sign-in / sign-up via Upstox):
 *     1. Fetch Upstox profile for email + name
 *     2. Use admin client to generate a magic-link for that email
 *        (Supabase creates the user if they don't exist yet)
 *     3. Save the Upstox token to user_settings under the new/existing user id
 *     4. Redirect to the magic-link action URL, which auto-signs the user in
 *        and lands them on /settings with sync=1
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

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

  // ── Helper: save token to user_settings using a given client ─────────────
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

  // ── 3A. Logged-in user → connect flow ────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { error: saveError } = await saveToken(supabase, user.id)
    if (saveError) {
      console.error("[OAuth callback] Failed to save token:", saveError)
      return NextResponse.redirect(`${baseUrl}/settings?error=save_token_failed`)
    }
    console.log(`[OAuth callback] Token saved for logged-in user ${user.id}`)
    return NextResponse.redirect(`${baseUrl}/settings?success=upstox_connected&sync=1`)
  }

  // ── 3B. Not logged in → auto sign-in / sign-up via magic link ────────────
  if (!upstoxEmail) {
    console.error("[OAuth callback] No email from Upstox profile — cannot auto sign-in")
    return NextResponse.redirect(
      `${baseUrl}/signin?error=no_email&message=${encodeURIComponent(
        "Upstox did not share your email. Please sign in or sign up manually, then connect Upstox from Settings."
      )}`
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
      return NextResponse.redirect(
        `${baseUrl}/signin?error=link_failed&message=${encodeURIComponent(
          "Could not create a sign-in link. Please sign in or sign up manually."
        )}`
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
