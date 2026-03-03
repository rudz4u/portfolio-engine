import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Prefs = Record<string, unknown>

function getList(prefs: Prefs): string[] {
  const raw = prefs.watchlist_symbols
  if (!raw) return []
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === "string") {
    try { return JSON.parse(raw) } catch { return raw.split(",").filter(Boolean) }
  }
  return []
}

async function getPrefs(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<{ rowExists: boolean; prefs: Prefs }> {
  const { data } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", userId)
    .single()
  return { rowExists: !!data, prefs: (data?.preferences as Prefs) || {} }
}

async function savePrefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rowExists: boolean,
  prefs: Prefs
) {
  if (rowExists) {
    await supabase.from("user_settings").update({ preferences: prefs }).eq("user_id", userId)
  } else {
    await supabase.from("user_settings").insert({ user_id: userId, preferences: prefs })
  }
}

/**
 * GET /api/watchlist
 * Returns the user's watched instrument_keys plus holding data for each.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prefs } = await getPrefs(supabase, user.id)
  const symbols = getList(prefs)

  if (symbols.length === 0) return NextResponse.json({ symbols: [], holdings: [] })

  // Fetch holding data for watched symbols
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .single()

  let holdings: Record<string, unknown>[] = []
  if (portfolio) {
    const { data } = await supabase
      .from("holdings")
      .select("id, instrument_key, company_name, trading_symbol, quantity, avg_price, ltp, invested_amount, unrealized_pl, segment, raw")
      .eq("portfolio_id", portfolio.id)
      .in("instrument_key", symbols)
    holdings = (data ?? []) as Record<string, unknown>[]
  }

  return NextResponse.json({ symbols, holdings })
}

/**
 * POST /api/watchlist  { instrument_key: string }
 * Adds a symbol to the watchlist (max 30).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const key: string = body.instrument_key
  if (!key) return NextResponse.json({ error: "instrument_key required" }, { status: 400 })

  const { rowExists, prefs } = await getPrefs(supabase, user.id)
  const list = getList(prefs)

  if (!list.includes(key)) {
    if (list.length >= 30) return NextResponse.json({ error: "Watchlist limit is 30 symbols" }, { status: 400 })
    list.push(key)
    prefs.watchlist_symbols = list
    await savePrefs(supabase, user.id, rowExists, prefs)
  }

  return NextResponse.json({ symbols: list })
}

/**
 * DELETE /api/watchlist?instrument_key=...
 * Removes a symbol from the watchlist.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const key = request.nextUrl.searchParams.get("instrument_key")
  if (!key) return NextResponse.json({ error: "instrument_key required" }, { status: 400 })

  const { rowExists, prefs } = await getPrefs(supabase, user.id)
  const list = getList(prefs).filter((k) => k !== key)
  prefs.watchlist_symbols = list
  await savePrefs(supabase, user.id, rowExists, prefs)

  return NextResponse.json({ symbols: list })
}
