import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { scoreHoldings, portfolioSummary, type HoldingInput } from "@/lib/quant/scoring"

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
    }
  })

  const scored = scoreHoldings(inputs)
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
      computed_at: new Date().toISOString(),
    },
  }))

  // Insert all (no upsert — just append; page queries latest per instrument)
  await supabase.from("analysis_reports").insert(reports)

  return NextResponse.json({ scored, summary })
}
