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

  try {
    return NextResponse.json({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || null,
      phone: user.user_metadata?.phone || null,
      created_at: user.created_at,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }
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
  const { full_name, phone, privacy_consent, marketing_consent, data_retention } = body

  try {
    // Update auth user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: full_name || null,
        phone: phone || null,
      },
    })

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    // Update user settings for privacy preferences
    const { data: existing } = await supabase
      .from("user_settings")
      .select("preferences")
      .eq("user_id", user.id)
      .single()

    const current = ((existing?.preferences as Record<string, unknown>) || {}) as Record<string, unknown>
    const updated = {
      ...current,
      privacy_consent: privacy_consent !== false,
      marketing_consent: marketing_consent === true,
      data_retention: data_retention || "indefinite",
    }

    const { error: settingsError } = await supabase.from("user_settings").upsert(
      { user_id: user.id, preferences: updated, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )

    if (settingsError) {
      return NextResponse.json(
        { error: "Failed to save privacy settings" },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
