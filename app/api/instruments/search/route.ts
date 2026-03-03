import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/instruments/search?q=RELIANCE&limit=10&exchange=NSE
 *
 * Searches the instruments table by trading_symbol or name prefix.
 * Falls back to searching the user's own holdings if the instruments
 * table is still empty (pre-seed state).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q       = (request.nextUrl.searchParams.get("q") || "").trim()
  const limit   = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "12"), 30)
  const exchange = request.nextUrl.searchParams.get("exchange") || ""  // NSE | BSE | ""

  if (q.length < 1) return NextResponse.json({ results: [] })

  const upper = q.toUpperCase()

  // ── 1. Search instruments table (primary) ─────────────────────────────────
  let query = supabase
    .from("instruments")
    .select("instrument_key, trading_symbol, name, exchange, isin, segment, short_name")
    .or(`trading_symbol.ilike.${upper}%,name.ilike.%${q}%`)
    .order("trading_symbol", { ascending: true })
    .limit(limit)

  if (exchange) {
    query = query.eq("exchange", exchange.toUpperCase())
  } else {
    // Default: equity only (NSE + BSE), exclude derivatives
    query = query.in("exchange", ["NSE", "BSE"])
  }

  const { data: instrRows, error } = await query

  if (!error && instrRows && instrRows.length > 0) {
    return NextResponse.json({
      results: instrRows.map((r) => ({
        instrument_key: r.instrument_key,
        trading_symbol: r.trading_symbol || r.instrument_key,
        company_name:   r.name || r.short_name || r.trading_symbol,
        exchange:       r.exchange,
        isin:           r.isin,
        segment:        r.segment,
      })),
      source: "instruments_table",
    })
  }

  // ── 2. Fallback: search user's own holdings (pre-seed or no match) ─────────
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!portfolio) return NextResponse.json({ results: [], source: "empty" })

  const { data: holdings } = await supabase
    .from("holdings")
    .select("instrument_key, trading_symbol, company_name, segment, raw")
    .eq("portfolio_id", portfolio.id)
    .or(`trading_symbol.ilike.${upper}%,company_name.ilike.%${q}%`)
    .limit(limit)

  const results = (holdings ?? []).map((h) => {
    const raw          = (h.raw as Record<string, unknown>) || {}
    const tradingSym   = h.trading_symbol || (raw.trading_symbol as string) || (raw.tradingsymbol as string) || h.instrument_key
    const companyName  = h.company_name   || (raw.company_name  as string) || tradingSym
    const exch         = (raw.exchange as string) || (h.instrument_key?.split("|")[0]?.split("_")[0]) || "NSE"
    return {
      instrument_key: h.instrument_key,
      trading_symbol: tradingSym,
      company_name:   companyName,
      exchange:       exch,
      isin:           (raw.isin as string) || null,
      segment:        h.segment || (raw.instrument_type as string) || null,
    }
  })

  return NextResponse.json({ results, source: "holdings_fallback" })
}
