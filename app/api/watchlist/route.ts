/**
 * /api/watchlist — Legacy compatibility shim for portfolio-table bookmark toggle.
 * Delegates to the new multi-watchlist data model, operating on the "default" list.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  readWatchlists, ensureDefaultList, DEFAULT_LIST_ID, MAX_ITEMS, WatchlistItem,
} from "@/lib/watchlistModel"

async function loadPrefs(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("user_settings").select("preferences").eq("user_id", userId).single()
  return { rowExists: !!data, prefs: (data?.preferences as Record<string, unknown>) || {} }
}
async function savePrefs(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, rowExists: boolean, prefs: Record<string, unknown>) {
  if (rowExists) await supabase.from("user_settings").update({ preferences: prefs }).eq("user_id", userId)
  else           await supabase.from("user_settings").insert({ user_id: userId, preferences: prefs })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prefs }  = await loadPrefs(supabase, user.id)
  const store       = ensureDefaultList(readWatchlists(prefs))
  const defaultList = store.find((l) => l.id === DEFAULT_LIST_ID) ?? store[0]
  const symbols     = defaultList?.items.map((i) => i.instrument_key) ?? []

  if (symbols.length === 0) return NextResponse.json({ symbols: [], holdings: [] })

  const { data: portfolio } = await supabase.from("portfolios").select("id").eq("user_id", user.id).single()
  let holdings: Record<string, unknown>[] = []
  if (portfolio) {
    const { data } = await supabase.from("holdings")
      .select("id, instrument_key, company_name, trading_symbol, quantity, avg_price, ltp, invested_amount, unrealized_pl, segment, raw")
      .eq("portfolio_id", portfolio.id).in("instrument_key", symbols)
    holdings = (data ?? []) as Record<string, unknown>[]
  }
  return NextResponse.json({ symbols, holdings })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body           = await request.json()
  const instrument_key = body.instrument_key as string
  if (!instrument_key) return NextResponse.json({ error: "instrument_key required" }, { status: 400 })

  const { rowExists, prefs } = await loadPrefs(supabase, user.id)
  const store = ensureDefaultList(readWatchlists(prefs))
  const list  = store.find((l) => l.id === DEFAULT_LIST_ID) ?? store[0]

  if (list.items.some((i) => i.instrument_key === instrument_key))
    return NextResponse.json({ symbols: list.items.map((i) => i.instrument_key) })
  if (list.items.length >= MAX_ITEMS)
    return NextResponse.json({ error: `Watchlist limit is ${MAX_ITEMS} symbols` }, { status: 400 })

  // Try to resolve display names from portfolio holdings if not in body
  const { data: portfolio } = await supabase.from("portfolios").select("id").eq("user_id", user.id).single()
  let tradingSymbol = (body.trading_symbol as string) || ""
  let companyName   = (body.company_name   as string) || ""
  const exchange    = (body.exchange        as string) || (instrument_key.includes("_") ? instrument_key.split("_")[0] : "NSE")

  if (portfolio && (!tradingSymbol || !companyName)) {
    const { data: h } = await supabase.from("holdings")
      .select("trading_symbol, company_name, raw").eq("portfolio_id", portfolio.id).eq("instrument_key", instrument_key).single()
    if (h) {
      const raw = (h.raw as Record<string, unknown>) || {}
      tradingSymbol = tradingSymbol || h.trading_symbol || (raw.trading_symbol as string) || ""
      companyName   = companyName   || h.company_name   || (raw.company_name   as string) || ""
    }
  }
  if (!tradingSymbol) tradingSymbol = instrument_key.includes("|") ? instrument_key.split("|")[1] : instrument_key
  if (!companyName)   companyName   = tradingSymbol

  const newItem: WatchlistItem = { instrument_key, trading_symbol: tradingSymbol, company_name: companyName, exchange, added_at: new Date().toISOString() }
  list.items.push(newItem)
  prefs.watchlists = store
  delete (prefs as Record<string, unknown>).watchlist_symbols
  await savePrefs(supabase, user.id, rowExists, prefs)
  return NextResponse.json({ symbols: list.items.map((i) => i.instrument_key) })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const instrument_key = request.nextUrl.searchParams.get("instrument_key")
  if (!instrument_key) return NextResponse.json({ error: "instrument_key required" }, { status: 400 })

  const { rowExists, prefs } = await loadPrefs(supabase, user.id)
  const store = ensureDefaultList(readWatchlists(prefs))
  const list  = store.find((l) => l.id === DEFAULT_LIST_ID) ?? store[0]

  list.items = list.items.filter((i) => i.instrument_key !== instrument_key)
  prefs.watchlists = store
  delete (prefs as Record<string, unknown>).watchlist_symbols
  await savePrefs(supabase, user.id, rowExists, prefs)
  return NextResponse.json({ symbols: list.items.map((i) => i.instrument_key) })
}
