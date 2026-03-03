import { NextRequest, NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"

const VALID_SEGMENTS = [
  "Defence", "EV", "Technology", "Green Energy", "PSU", "BFSI",
  "Healthcare", "Pharma", "Infrastructure", "FMCG", "Auto",
  "Metals", "Energy", "IT", "Others",
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { segment } = body as { segment?: string }

  if (!segment || !VALID_SEGMENTS.includes(segment)) {
    return NextResponse.json(
      { error: `Invalid segment. Must be one of: ${VALID_SEGMENTS.join(", ")}` },
      { status: 400 }
    )
  }

  // Verify user owns this holding via portfolio
  const admin = await createAdminClient()

  const { data: holding } = await admin
    .from("holdings")
    .select("id, portfolio_id")
    .eq("id", id)
    .single()

  if (!holding) {
    return NextResponse.json({ error: "Holding not found" }, { status: 404 })
  }

  // Check portfolio belongs to user
  const { data: portfolio } = await admin
    .from("portfolios")
    .select("user_id")
    .eq("id", holding.portfolio_id)
    .single()

  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await admin
    .from("holdings")
    .update({ segment })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, segment })
}
