/**
 * GET /api/advisory/consensus
 *
 * Returns today's advisory consensus for the calling user's portfolio + watchlist symbols.
 * Also accepts an optional ?symbols=RELIANCE,INFY query param to fetch specific symbols.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get("symbols")
  const dateParam = searchParams.get("date") || new Date().toISOString().slice(0, 10)

  let symbolFilter: string[] = []

  if (symbolsParam) {
    symbolFilter = symbolsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  } else {
    // Default: all symbols from user's portfolio + watchlists
    const [holdingsRes, watchlistRes] = await Promise.all([
      supabase
        .from("holdings")
        .select("trading_symbol, portfolios!inner(user_id)")
        .eq("portfolios.user_id", user.id),
      supabase
        .from("watchlist_items")
        .select("trading_symbol, watchlists!inner(user_id)")
        .eq("watchlists.user_id", user.id),
    ])

    const symbols = new Set<string>()
    for (const h of holdingsRes.data ?? []) {
      if (h.trading_symbol) symbols.add(h.trading_symbol.toUpperCase())
    }
    for (const w of watchlistRes.data ?? []) {
      if (w.trading_symbol) symbols.add(w.trading_symbol.toUpperCase())
    }
    symbolFilter = Array.from(symbols)
  }

  if (symbolFilter.length === 0) {
    return NextResponse.json({ consensus: [], date: dateParam })
  }

  const query = supabase
    .from("advisory_consensus")
    .select("*")
    .eq("consensus_date", dateParam)
    .in("trading_symbol", symbolFilter)
    .order("weighted_score", { ascending: false })

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  return NextResponse.json({ consensus: data ?? [], date: dateParam })
}
