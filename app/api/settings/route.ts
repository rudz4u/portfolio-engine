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
  return NextResponse.json({
    openai_key_set: Boolean(prefs.openai_key),
    anthropic_key_set: Boolean(prefs.anthropic_key),
    gemini_key_set: Boolean(prefs.gemini_key),
    brevo_key_set: Boolean(prefs.brevo_key),
    preferred_llm: prefs.preferred_llm || "auto",
    sandbox_mode: prefs.sandbox_mode !== "false",
    email_digest: prefs.email_digest === "true",
    notification_email: prefs.notification_email || "",
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
  const allowed = ["openai_key", "anthropic_key", "gemini_key", "brevo_key", "preferred_llm", "sandbox_mode", "email_digest", "notification_email"]

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
