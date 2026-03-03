import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  readWatchlists,
  ensureDefaultList,
  DEFAULT_LIST_ID,
  MAX_ITEMS,
  WatchlistItem,
} from "@/lib/watchlistModel"

// ─── Prefs helpers (same as parent route) ────────────────────────────────────

async function loadPrefs(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", userId)
    .single()
  return {
    rowExists: !!data,
    prefs:     (data?.preferences as Record<string, unknown>) || {},
  }
}

async function savePrefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rowExists: boolean,
  prefs: Record<string, unknown>
) {
  if (rowExists) {
    await supabase.from("user_settings").update({ preferences: prefs }).eq("user_id", userId)
  } else {
    await supabase.from("user_settings").insert({ user_id: userId, preferences: prefs })
  }
}

// ─── GET /api/watchlists/[id]/items ──────────────────────────────────────────
// Returns items + their live portfolio data for a specific watchlist.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prefs }  = await loadPrefs(supabase, user.id)
  const store       = ensureDefaultList(readWatchlists(prefs))
  const list        = store.find((l) => l.id === id)
  if (!list) return NextResponse.json({ error: "Watchlist not found" }, { status: 404 })

  const instrumentKeys = list.items.map((i) => i.instrument_key)

  // Fetch portfolio holding data for watched symbols (if any are in portfolio)
  let holdings: Record<string, unknown>[] = []
  if (instrumentKeys.length > 0) {
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (portfolio) {
      const { data } = await supabase
        .from("holdings")
        .select("id, instrument_key, company_name, trading_symbol, quantity, avg_price, ltp, invested_amount, unrealized_pl, segment, raw")
        .eq("portfolio_id", portfolio.id)
        .in("instrument_key", instrumentKeys)
      holdings = (data ?? []) as Record<string, unknown>[]
    }
  }

  // Fetch instrument metadata as a fallback for trading_symbol / company_name
  // (covers watchlist items not in the user's portfolio, or items stored with ISIN)
  let instruments: Record<string, unknown>[] = []
  if (instrumentKeys.length > 0) {
    const { data: instData } = await supabase
      .from("instruments")
      .select("instrument_key, trading_symbol, name, exchange")
      .in("instrument_key", instrumentKeys)
    instruments = (instData ?? []) as Record<string, unknown>[]
  }

  return NextResponse.json({ list, holdings, instruments })
}

// ─── POST /api/watchlists/[id]/items ── { instrument_key, trading_symbol, company_name, exchange }
// Adds an item to the watchlist.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body           = await request.json()
  const instrument_key: string = body.instrument_key
  if (!instrument_key) return NextResponse.json({ error: "instrument_key required" }, { status: 400 })

  const { rowExists, prefs } = await loadPrefs(supabase, user.id)
  let store = ensureDefaultList(readWatchlists(prefs))

  const list = store.find((l) => l.id === id)
  if (!list) return NextResponse.json({ error: "Watchlist not found" }, { status: 404 })

  if (list.items.some((i) => i.instrument_key === instrument_key))
    return NextResponse.json({ list, message: "Already in watchlist" })

  if (list.items.length >= MAX_ITEMS)
    return NextResponse.json({ error: `Watchlist limit is ${MAX_ITEMS} symbols` }, { status: 400 })

  // Resolve display info: prefer from body, else strip from instrument_key
  const stripped      = instrument_key.includes("|") ? instrument_key.split("|")[1] : instrument_key
  const tradingSymbol = (body.trading_symbol as string) || stripped
  const companyName   = (body.company_name   as string) || tradingSymbol
  const exchange      = (body.exchange        as string) || (instrument_key.includes("_") ? instrument_key.split("_")[0] : "NSE")

  const newItem: WatchlistItem = {
    instrument_key,
    trading_symbol: tradingSymbol,
    company_name:   companyName,
    exchange,
    added_at: new Date().toISOString(),
  }

  list.items.push(newItem)
  store = store.map((l) => (l.id === id ? list : l))
  prefs.watchlists = store
  delete (prefs as Record<string, unknown>).watchlist_symbols
  await savePrefs(supabase, user.id, rowExists, prefs)

  return NextResponse.json({ list, item: newItem })
}

// ─── DELETE /api/watchlists/[id]/items?instrument_key=... ────────────────────
// Removes an item from the watchlist.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const instrument_key = request.nextUrl.searchParams.get("instrument_key")
  if (!instrument_key) return NextResponse.json({ error: "instrument_key required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { rowExists, prefs } = await loadPrefs(supabase, user.id)
  let store = ensureDefaultList(readWatchlists(prefs))

  const list = store.find((l) => l.id === id)
  if (!list) return NextResponse.json({ error: "Watchlist not found" }, { status: 404 })

  list.items = list.items.filter((i) => i.instrument_key !== instrument_key)
  store = store.map((l) => (l.id === id ? list : l))
  prefs.watchlists = store
  delete (prefs as Record<string, unknown>).watchlist_symbols
  await savePrefs(supabase, user.id, rowExists, prefs)

  return NextResponse.json({ list })
}
