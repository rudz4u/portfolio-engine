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

  try {
    // Get total count of instruments
    const { count, error } = await supabase
      .from("instruments")
      .select("*", { count: "exact", head: true })

    if (error) {
      console.error("Error fetching instrument count:", error)
      return NextResponse.json(
        { count: 0, error: "Failed to fetch count", last_seeded: null }
      )
    }

    // Try to get the last seeded timestamp from audit logs or a special record
    // For now, we'll just return the count
    // If you have a metadata table, you can query it here
    let lastSeeded: string | null = null
    
    // Optional: If you store seeding metadata in a table, query it here
    // const { data: metaData } = await supabase
    //   .from("instruments_metadata")
    //   .select("last_seeded")
    //   .single()
    // if (metaData?.last_seeded) {
    //   lastSeeded = metaData.last_seeded
    // }

    return NextResponse.json({
      count: count || 0,
      last_seeded: lastSeeded,
    })
  } catch (error) {
    console.error("Error in instruments/count:", error)
    return NextResponse.json(
      { error: "Internal server error", count: 0, last_seeded: null },
      { status: 500 }
    )
  }
}
