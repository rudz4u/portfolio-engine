/**
 * GET /api/advisory/sources
 *
 * Returns all active advisory sources with their latest track record stats.
 * Readable by any authenticated user.
 */

import { NextResponse } from "next/server"
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

  // Fetch sources with their most recent 30-day track record
  const { data: sources, error } = await supabase
    .from("advisory_sources")
    .select("*")
    .eq("active", true)
    .order("tier", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  // Fetch 30d track records for all sources in one query
  const sourceIds = (sources ?? []).map((s) => s.id)
  const { data: trackRecords } = await supabase
    .from("advisory_track_records")
    .select("source_id, period_days, accuracy_pct, track_record_multiplier, total_calls, hit_target, evaluated_at")
    .in("source_id", sourceIds)
    .eq("period_days", 30)

  const trMap = new Map(
    (trackRecords ?? []).map((tr) => [tr.source_id, tr])
  )

  const enriched = (sources ?? []).map((s) => ({
    ...s,
    track_record: trMap.get(s.id) ?? null,
  }))

  return NextResponse.json({ sources: enriched })
}
