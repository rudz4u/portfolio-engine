import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { scoreHoldings, portfolioSummary, type HoldingInput } from "@/lib/quant/scoring"
import { validateWeights, DEFAULT_WEIGHTS } from "@/lib/quant/scoring-defaults"
import { attachExplanations } from "@/lib/signals/explainer"
import { discoverOpportunities } from "@/lib/signals/discovery"
import { buildTechnicalsMap } from "@/lib/candles/build-technicals"
import type { InvestorProfile, StrategyPreset, HoldingOverride } from "@/lib/types/investor-profile"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── 1. Fetch investor profile + active preset ─────────────────────────────
  const { data: profileRow } = await supabase
    .from("investor_profiles")
    .select("*, strategy_presets(*)")
    .eq("user_id", user.id)
    .maybeSingle()

  const profile = (profileRow as InvestorProfile | null) ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preset  = (profileRow as any)?.strategy_presets as StrategyPreset | null ?? null

  // ── 2. Fetch user settings (custom weights fallback) ──────────────────────
  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle()
  const prefs = (settingsRow?.preferences as Record<string, unknown>) ?? {}
  const userWeights = validateWeights(prefs.scoring_weights) ?? DEFAULT_WEIGHTS

  // ── 3. Fetch portfolio holdings ───────────────────────────────────────────
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)

  let scoredHoldings: ReturnType<typeof scoreHoldings> = []
  const heldSymbols = new Set<string>()

  if (portfolios && portfolios.length > 0) {
    const { data: holdings } = await supabase
      .from("holdings")
      .select("instrument_key, trading_symbol, company_name, quantity, avg_price, ltp, unrealized_pl, invested_amount, segment, raw")
      .eq("portfolio_id", portfolios[0].id)

    if (holdings && holdings.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const symbols = holdings.map((h) => (h.trading_symbol as string) || h.instrument_key)
      symbols.forEach((s) => heldSymbols.add(s))

      const { data: consensusRows } = await supabase
        .from("advisory_consensus")
        .select("trading_symbol, advisory_score")
        .in("trading_symbol", symbols)
        .eq("consensus_date", today)

      const advisoryMap = new Map<string, number>(
        (consensusRows ?? []).map((r) => [r.trading_symbol as string, r.advisory_score as number])
      )

      // Fetch per-stock overrides
      const { data: overrideRows } = await supabase
        .from("holding_overrides")
        .select("*")
        .eq("user_id", user.id)
      const overridesMap = new Map<string, HoldingOverride>(
        (overrideRows ?? []).map((r) => [r.instrument_key as string, r as unknown as HoldingOverride])
      )

      const inputs: HoldingInput[] = holdings.map((h) => {
        const raw = (h.raw as Record<string, number>) || {}
        const sym  = (h.trading_symbol as string) || h.instrument_key
        return {
          instrument_key: h.instrument_key,
          trading_symbol: sym,
          name: (h.company_name as string) || sym,
          quantity: Number(h.quantity) || 0,
          avg_price: Number(h.avg_price) || 0,
          ltp: Number(h.ltp) || Number(h.avg_price) || 0,
          unrealized_pl: Number(h.unrealized_pl) || 0,
          invested_amount: Number(h.invested_amount) || 0,
          day_change_percentage: raw.day_change_percentage,
          segment: (h.segment as string) || "Others",
          advisory_score: advisoryMap.get(sym),
        }
      })

      // Build real technical indicators from candle data (falls back to approximations if no token)
      const technicalsMap = await buildTechnicalsMap(
        inputs.map((i) => i.instrument_key),
        new Map(inputs.map((i) => [i.instrument_key, i.trading_symbol ?? i.instrument_key])),
      )

      scoredHoldings = scoreHoldings(inputs, userWeights, technicalsMap, profile, preset, overridesMap)
    }
  }

  // Attach profile-aware explanations to each scored holding
  const scoredWithExplanations = attachExplanations(scoredHoldings, profile, preset)
  const summary = portfolioSummary(scoredWithExplanations)

  // ── 4. Opportunity discovery (not-yet-held stocks) ────────────────────────
  let opportunities: ReturnType<typeof discoverOpportunities> = []

  if (profile) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: allConsensus } = await supabase
      .from("advisory_consensus")
      .select("trading_symbol, consensus_signal, weighted_score, advisory_score, buy_count, sell_count, total_sources, segment")
      .eq("consensus_date", today)
      .in("consensus_signal", ["STRONG_BUY", "BUY"])
      .order("weighted_score", { ascending: false })
      .limit(200)

    if (allConsensus && allConsensus.length > 0) {
      opportunities = discoverOpportunities(
        allConsensus as Parameters<typeof discoverOpportunities>[0],
        heldSymbols,
        profile,
      )
    }
  }

  // ── 5. Segment the scored portfolio by actionability ──────────────────────
  const highlightedSignals = scoredWithExplanations.filter(
    (h) => h.signal === "BUY" || h.signal === "SELL"
  )
  const watchlist = scoredWithExplanations.filter((h) => h.signal === "WATCH")

  return NextResponse.json({
    profile_present: !!profile,
    investor_type: profile?.investor_type ?? null,
    summary,
    highlighted_signals: highlightedSignals,
    watchlist,
    all_scored: scoredWithExplanations,
    opportunities,
  })
}
