import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch all system presets + user's own custom presets
  const { data, error } = await supabase
    .from("strategy_presets")
    .select("*")
    .or(`is_system.eq.true,created_by.eq.${user.id}`)
    .order("is_system", { ascending: false })
    .order("name")

  if (error) {
    return NextResponse.json({ error: "Failed to fetch presets" }, { status: 500 })
  }

  return NextResponse.json({ presets: data ?? [] })
}
