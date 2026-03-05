import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"

/**
 * GET /api/debug/upstox
 * Probes Upstox token endpoint with a deliberately invalid code.
 * This tells us whether Upstox rejects our CLIENT CREDENTIALS (before code check)
 * or whether it rejects the CODE (meaning credentials are accepted).
 *
 * Protected — requires a valid Supabase session.
 * DELETE THIS FILE once the OAuth issue is resolved.
 */
export const dynamic = "force-dynamic"

function mask(value: string): string {
  if (!value) return "(empty)"
  if (value.length <= 6) return `${"*".repeat(value.length)} (${value.length} chars)`
  return `${value.slice(0, 3)}...${"*".repeat(value.length - 6)}...${value.slice(-3)} (${value.length} chars)`
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const redirectUri = (
    UPSTOX_CONFIG.redirectUri ||
    "https://investbuddyai.com/api/oauth/upstox/callback"
  ).replace(/\/$/, "")

  // Probe Upstox with a deliberately invalid code.
  // If credentials are wrong → Upstox rejects with "UDAPI100056 Invalid credentials" BEFORE checking the code.
  // If credentials are right → Upstox rejects with a code/expiry error (UDAPI100055 or similar).
  let probeResult: Record<string, unknown> = {}
  try {
    const probeRes = await fetch(UPSTOX_CONFIG.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code: "DEBUG_INVALID_CODE",
        client_id: UPSTOX_CONFIG.clientId,
        client_secret: UPSTOX_CONFIG.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    })
    const probeBody = await probeRes.json()
    probeResult = {
      http_status: probeRes.status,
      response_body: probeBody,
      interpretation:
        probeBody?.errors?.[0]?.errorCode === "UDAPI100056" ||
        probeBody?.message === "Invalid Credentials" ||
        probeBody?.error === "invalid_client"
          ? "CLIENT CREDENTIALS REJECTED ← wrong client_id or client_secret"
          : "CLIENT CREDENTIALS ACCEPTED ← code was wrong/expired (expected for a fake code). OAuth config is correct.",
    }
  } catch (e) {
    probeResult = { error: String(e) }
  }

  return NextResponse.json({
    note: "DELETE this endpoint once credentials are fixed",
    runtime_env: {
      UPSTOX_CLIENT_ID: {
        value: UPSTOX_CONFIG.clientId || "(empty)",
        length: UPSTOX_CONFIG.clientId.length,
      },
      UPSTOX_CLIENT_SECRET: {
        masked: mask(UPSTOX_CONFIG.clientSecret),
        length: UPSTOX_CONFIG.clientSecret.length,
        is_empty: !UPSTOX_CONFIG.clientSecret,
      },
      UPSTOX_REDIRECT_URI: {
        value: redirectUri,
        length: redirectUri.length,
      },
      UPSTOX_TOKEN_URL: UPSTOX_CONFIG.tokenUrl,
    },
    upstox_probe: probeResult,
  })
}
