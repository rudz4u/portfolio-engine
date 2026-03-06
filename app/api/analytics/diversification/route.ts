/**
 * GET /api/analytics/diversification
 *
 * Returns the user's portfolio diversification data:
 *  - Actual segment breakdown from current holdings (segment column)
 *  - Target allocation from user's strategy_profile preference
 *  - HHI-based diversification score for both actual and target
 *  - Variance per segment (actual - target)
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const SEGMENT_MAP: Record<string, string> = {
  // NSE segment codes → display buckets
  EQ:  "large_cap",   // fallback — refined by market cap below
  BE:  "large_cap",
  SM:  "small_cap",
  ST:  "small_cap",
  MF:  "debt",
  GB:  "debt",
  GS:  "debt",
  GOLD: "gold",
}

/** Classify holding into a broad asset bucket by its segment field */
function classify(segment: string | null, tradingSymbol: string): string {
  if (!segment) return "large_cap"
  const s = segment.toUpperCase()
  if (s.includes("GOLD") || tradingSymbol?.includes("GOLD")) return "gold"
  if (s === "SM" || s === "ST" || s === "SME") return "small_cap"
  if (s === "MF" || s === "GB" || s === "GS" || s === "GSEC") return "debt"
  return SEGMENT_MAP[s] ?? "large_cap"
}

function hhiScore(alloc: Record<string, number>): number {
  const total = Object.values(alloc).reduce((s, v) => s + v, 0)
  if (!total) return 0
  const hhi = Object.values(alloc).reduce((s, v) => s + Math.pow((v / total) * 100, 2), 0)
  return Math.round(Math.max(0, 100 - hhi / 100))
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch latest portfolio holdings + user preferences in parallel
  const [{ data: portfolios }, { data: settings }] = await Promise.all([
    supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("user_settings")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  const prefs = (settings?.preferences as Record<string, unknown> | null) ?? {}
  const strategyProfile = prefs.strategy_profile as {
    strategy_text?: string
    segments?: Record<string, number>
  } | null

  if (!portfolios?.length) {
    return NextResponse.json({
      actual: {},
      target: strategyProfile?.segments ?? null,
      actual_score: 0,
      target_score: strategyProfile?.segments ? hhiScore(strategyProfile.segments) : null,
      variance: null,
      strategy_text: strategyProfile?.strategy_text ?? null,
    })
  }

  const { data: holdings } = await supabase
    .from("holdings")
    .select("segment, trading_symbol, invested_amount")
    .eq("portfolio_id", portfolios[0].id)

  // Aggregate invested_amount by asset bucket
  const buckets: Record<string, number> = {
    large_cap: 0, mid_cap: 0, small_cap: 0, debt: 0, gold: 0, international: 0,
  }
  let totalInvested = 0
  for (const h of holdings ?? []) {
    const bucket = classify(h.segment as string | null, h.trading_symbol as string)
    const amt = Number(h.invested_amount) || 0
    buckets[bucket] = (buckets[bucket] ?? 0) + amt
    totalInvested += amt
  }

  // Convert absolute amounts to percentages
  const actualPct: Record<string, number> = {}
  for (const [k, v] of Object.entries(buckets)) {
    actualPct[k] = totalInvested > 0 ? Math.round((v / totalInvested) * 100 * 10) / 10 : 0
  }

  const target = strategyProfile?.segments ?? null
  const variance: Record<string, number> | null = target
    ? Object.fromEntries(
        Object.keys(actualPct).map((k) => [k, Math.round(((actualPct[k] ?? 0) - (target[k] ?? 0)) * 10) / 10])
      )
    : null

  return NextResponse.json({
    actual: actualPct,
    target,
    actual_score: hhiScore(actualPct),
    target_score: target ? hhiScore(target) : null,
    variance,
    strategy_text: strategyProfile?.strategy_text ?? null,
  })
}
