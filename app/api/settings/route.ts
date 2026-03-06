import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }

  // Return preferences but scrub actual key values (just return whether they're set)
  const prefs = (data?.preferences as Record<string, string> | null) || {}

  // Decode token expiry if present
  let upstoxTokenExpiresAt: string | null = null
  if (prefs.upstox_access_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(prefs.upstox_access_token.split(".")[1], "base64").toString()
      )
      if (payload.exp) {
        upstoxTokenExpiresAt = new Date(payload.exp * 1000).toISOString()
      }
    } catch {
      // malformed JWT, ignore
    }
  }

  // Check if the platform has any LLM keys configured via server-side env vars
  const platformLlmAvailable = Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.QWEN_API_KEY
  )

  return NextResponse.json({
    openai_key_set: Boolean(prefs.openai_key),
    anthropic_key_set: Boolean(prefs.anthropic_key),
    gemini_key_set: Boolean(prefs.gemini_key),
    deepseek_key_set: Boolean(prefs.deepseek_key),
    qwen_key_set: Boolean(prefs.qwen_key),
    tavily_key_set: Boolean(prefs.tavily_key),
    brevo_key_set: Boolean(prefs.brevo_key),
    upstox_token_set: Boolean(prefs.upstox_access_token),
    upstox_token_expires_at: upstoxTokenExpiresAt,
    platform_llm_available: platformLlmAvailable,
    preferred_llm: prefs.preferred_llm || "brokerai",
    ai_mode: prefs.ai_mode || "platform",  // "platform" | "byok"
    sandbox_mode: prefs.sandbox_mode !== "false",
    // Notifications
    notification_emails: prefs.notification_emails || "",  // comma-separated, up to 4
    notif_daily_digest:       prefs.notif_daily_digest !== "false",
    notif_order_placed:       prefs.notif_order_placed !== "false",
    notif_portfolio_alert:    prefs.notif_portfolio_alert === "true",
    notif_price_alert:        prefs.notif_price_alert === "true",
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const allowed = [
    "openai_key", "anthropic_key", "gemini_key", "deepseek_key", "qwen_key", "tavily_key", "brevo_key",
    "upstox_access_token", "preferred_llm", "ai_mode", "sandbox_mode",
    // notification fields
    "notification_emails",
    "notif_daily_digest", "notif_order_placed",
    "notif_portfolio_alert", "notif_price_alert",
  ]

  // Get existing preferences
  const { data: existing } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  const current = ((existing?.preferences as Record<string, string>) || {}) as Record<string, string>

  // Merge only allowed fields
  const updated: Record<string, string> = { ...current }
  for (const key of allowed) {
    if (body[key] !== undefined) {
      // Empty string = delete the key
      if (body[key] === "") {
        delete updated[key]
      } else {
        updated[key] = body[key]
      }
    }
  }

  const { error } = await supabase.from("user_settings").upsert(
    { user_id: user.id, preferences: updated, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  )

  if (error) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
