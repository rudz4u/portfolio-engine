import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { scoreHoldings, portfolioSummary, type HoldingInput } from "@/lib/quant/scoring"
import { validateWeights, DEFAULT_WEIGHTS } from "@/lib/quant/scoring-defaults"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get user's portfolio + holdings with instrument data
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)

  if (!portfolios || portfolios.length === 0) {
    return NextResponse.json({ scored: [], summary: portfolioSummary([]) })
  }

  const portfolioId = portfolios[0].id

  const { data: holdings, error } = await supabase
    .from("holdings")
    .select(`
      instrument_key,
      trading_symbol,
      company_name,
      quantity,
      avg_price,
      invested_amount,
      ltp,
      unrealized_pl,
      segment,
      raw
    `)
    .eq("portfolio_id", portfolioId)

  if (error || !holdings) {
    return NextResponse.json({ error: "Failed to fetch holdings" }, { status: 500 })
  }

  // Map to HoldingInput — join advisory_consensus for today's advisory scores
  // Fetch today's consensus for all symbols in this portfolio
  const todaySymbols = holdings.map((h) => (h.trading_symbol as string) || h.instrument_key)
  const today = new Date().toISOString().slice(0, 10)

  // Fetch user's custom scoring weights (and advisory consensus) in parallel
  const [{ data: consensusRows }, { data: userSettings }] = await Promise.all([
    supabase
      .from("advisory_consensus")
      .select("trading_symbol, advisory_score")
      .in("trading_symbol", todaySymbols)
      .eq("consensus_date", today),
    supabase
      .from("user_settings")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  const prefs = (userSettings?.preferences as Record<string, unknown> | null) ?? {}
  const userWeights = validateWeights(prefs.scoring_weights) ?? DEFAULT_WEIGHTS

  const advisoryMap = new Map<string, number>(
    (consensusRows ?? []).map((r) => [r.trading_symbol as string, r.advisory_score as number])
  )

  // Map to HoldingInput
  const inputs: HoldingInput[] = holdings.map((h) => {
    const raw = (h.raw as Record<string, number>) || {}
    // trading_symbol + company_name are stored directly on holdings (migration 005)
    const symbol = (h.trading_symbol as string) || h.instrument_key
    const name   = (h.company_name   as string) || symbol
    return {
      instrument_key: h.instrument_key,
      trading_symbol: symbol,
      name,
      quantity: Number(h.quantity) || 0,
      avg_price: Number(h.avg_price) || 0,
      ltp: Number(h.ltp) || Number(h.avg_price) || 0,
      unrealized_pl: Number(h.unrealized_pl) || 0,
      invested_amount: Number(h.invested_amount) || 0,
      day_change: raw.day_change,
      day_change_percentage: raw.day_change_percentage,
      segment: (h.segment as string) || "Others",
      advisory_score: advisoryMap.get(symbol),  // undefined → scoring engine uses fallback 12
    }
  })

  const scored = scoreHoldings(inputs, userWeights)
  const summary = portfolioSummary(scored)

  // Persist latest scores to analysis_reports (upsert per instrument)
  const reports = scored.map((s) => ({
    user_id: user.id,
    instrument_key: s.instrument_key,
    report: {
      score: s.score,
      signal: s.signal,
      signal_reason: s.signal_reason,
      pnl_pct: s.pnl_pct,
      weight_pct: s.weight_pct,
      momentum_score: s.momentum_score,
      valuation_score: s.valuation_score,
      position_score: s.position_score,
      advisory_score: s.advisory_score,
      computed_at: new Date().toISOString(),
    },
  }))

  // Rate-limit write-back: only persist if no report was written in the last hour.
  // This prevents the table from growing by |holdings| rows on every page load
  // while still keeping analysis_reports current within a 1-hour window.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recentReport } = await supabase
    .from("analysis_reports")
    .select("created_at")
    .eq("user_id", user.id)
    .gt("created_at", cutoff)
    .limit(1)
    .maybeSingle()

  if (!recentReport) {
    await supabase.from("analysis_reports").insert(reports)
  }

  return NextResponse.json({ scored, summary })
}
