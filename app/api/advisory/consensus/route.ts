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
    return NextResponse.json({ consensus: [], sourceBreakdown: {}, date: dateParam })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data, error }, { data: recs }] = await Promise.all([
    supabase
      .from("advisory_consensus")
      .select("*")
      .eq("consensus_date", dateParam)
      .in("trading_symbol", symbolFilter)
      .order("weighted_score", { ascending: false }),
    supabase
      .from("advisory_recommendations")
      .select("trading_symbol, signal, target_price, advisory_sources(name, tier, website_url)")
      .in("trading_symbol", symbolFilter)
      .gte("scraped_at", sevenDaysAgo)
      .order("scraped_at", { ascending: false }),
  ])

  if (error) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  // Build per-symbol source breakdown (deduplicated by source name — keep most recent signal)
  type SourceEntry = { source_name: string; signal: string; target_price: number | null; tier: number; website_url?: string | null }
  const sourceBreakdown: Record<string, SourceEntry[]> = {}
  for (const rec of recs ?? []) {
    const sym = rec.trading_symbol as string
    // advisory_sources is a foreign-key join returning a single object (Supabase infers array, cast via unknown)
    const src = (rec.advisory_sources as unknown) as { name: string; tier: number; website_url?: string | null } | null
    if (!src?.name) continue
    if (!sourceBreakdown[sym]) sourceBreakdown[sym] = []
    if (!sourceBreakdown[sym].some((s) => s.source_name === src.name)) {
      sourceBreakdown[sym].push({
        source_name: src.name,
        signal: rec.signal as string,
        target_price: (rec.target_price as number | null) ?? null,
        tier: src.tier ?? 0,
        website_url: src.website_url ?? null,
      })
    }
  }

  return NextResponse.json({ consensus: data ?? [], sourceBreakdown, date: dateParam })
}
