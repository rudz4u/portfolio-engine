import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/portfolio/snapshots?days=30
 * Returns the last N daily portfolio value snapshots for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const days = Math.min(Number(request.nextUrl.searchParams.get("days") || "90"), 365)

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!portfolio) return NextResponse.json({ snapshots: [] })

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data: snapshots, error } = await supabase
    .from("portfolio_snapshots")
    .select("snapshot_date, total_invested, total_value, total_pnl, pnl_pct, holdings_count")
    .eq("portfolio_id", portfolio.id)
    .gte("snapshot_date", sinceDate)
    .order("snapshot_date", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ snapshots: snapshots ?? [] })
}
