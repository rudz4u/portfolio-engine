import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { UPSTOX_CONFIG } from "@/lib/upstox"

/**
 * GET /api/debug/upstox
 * Returns the Upstox configuration as seen at RUNTIME inside the serverless function.
 * Protected — requires a valid Supabase session.
 *
 * DELETE THIS FILE once the OAuth credentials issue is resolved.
 */
export const dynamic = "force-dynamic"

function mask(value: string): string {
  if (!value) return "(empty)"
  if (value.length <= 6) return `${"*".repeat(value.length)} (${value.length} chars)`
  return `${value.slice(0, 3)}...${"*".repeat(value.length - 6)}...${value.slice(-3)} (${value.length} chars)`
}

export async function GET() {
  // Auth check — only a logged-in user can call this
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  return NextResponse.json({
    note: "DELETE this endpoint once credentials are fixed",
    runtime_env: {
      UPSTOX_CLIENT_ID: {
        value: UPSTOX_CONFIG.clientId || "(empty — env var missing)",
        length: UPSTOX_CONFIG.clientId.length,
      },
      UPSTOX_CLIENT_SECRET: {
        masked: mask(UPSTOX_CONFIG.clientSecret),
        length: UPSTOX_CONFIG.clientSecret.length,
        is_empty: !UPSTOX_CONFIG.clientSecret,
      },
      UPSTOX_REDIRECT_URI: {
        value: UPSTOX_CONFIG.redirectUri || "(empty — will use hardcoded fallback)",
        length: UPSTOX_CONFIG.redirectUri.length,
      },
      UPSTOX_TOKEN_URL: UPSTOX_CONFIG.tokenUrl,
      UPSTOX_AUTH_URL: UPSTOX_CONFIG.authUrl,
      UPSTOX_SANDBOX: process.env.UPSTOX_SANDBOX ?? "(not set)",
    },
  })
}
