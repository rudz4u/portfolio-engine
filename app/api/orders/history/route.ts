import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)

  // Date range params
  const fromParam = searchParams.get("from")   // ISO date string  e.g. "2025-01-01"
  const toParam   = searchParams.get("to")     // ISO date string  e.g. "2025-12-31"

  let query = supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (fromParam) {
    query = query.gte("created_at", new Date(fromParam).toISOString())
  }
  if (toParam) {
    // Add 1 day so "to" is inclusive of the selected end date
    const toDate = new Date(toParam)
    toDate.setDate(toDate.getDate() + 1)
    query = query.lt("created_at", toDate.toISOString())
  }

  const { data: orders, error } = await query

  if (error) {
    return NextResponse.json(
      { status: "error", message: "Failed to fetch orders: " + error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    status: "success",
    data: orders ?? [],
    count: (orders ?? []).length,
  })
}
