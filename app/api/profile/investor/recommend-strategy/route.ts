import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  type InvestorType,
  type RiskTolerance,
  type InvestmentGoal,
  type StrategyPreset,
  INVESTOR_TYPES,
} from "@/lib/types/investor-profile"

export const dynamic = "force-dynamic"

interface RecommendInput {
  investor_type: InvestorType
  risk_tolerance: RiskTolerance
  investment_goals: InvestmentGoal[]
  preferred_sectors: string[]
}

/**
 * POST /api/profile/investor/recommend-strategy
 *
 * Given a partial investor profile (from onboarding), returns the best-matching
 * system strategy preset using a deterministic rule-based scoring matrix.
 * No LLM dependency — pure decision logic.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body: RecommendInput = await request.json()

  if (!body.investor_type || !INVESTOR_TYPES.includes(body.investor_type)) {
    return NextResponse.json({ error: "investor_type is required" }, { status: 400 })
  }

  // Fetch all system presets
  const { data: presets, error } = await supabase
    .from("strategy_presets")
    .select("*")
    .eq("is_system", true)

  if (error || !presets?.length) {
    return NextResponse.json({ error: "No strategy presets available" }, { status: 500 })
  }

  // Score each preset against the input profile
  const scored = presets.map((preset) => {
    let score = 0
    const p = preset as StrategyPreset

    // 1. Investor type match (strongest signal — 40 pts)
    if (p.investor_types.includes(body.investor_type)) {
      score += 40
    }

    // 2. Risk alignment (30 pts)
    score += riskAlignmentScore(body.risk_tolerance, p)

    // 3. Goal alignment (20 pts)
    score += goalAlignmentScore(body.investment_goals, p)

    // 4. Sector fit bonus (10 pts)
    score += sectorFitScore(body.preferred_sectors, p)

    return { preset: p, score }
  })

  // Sort by score descending, pick the top match
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]

  const explanation = generateExplanation(body, best.preset)

  return NextResponse.json({
    recommended_preset: best.preset,
    match_score: best.score,
    explanation,
    alternatives: scored.slice(1, 3).map((s) => ({
      preset: s.preset,
      match_score: s.score,
    })),
  })
}

// ── Scoring functions ─────────────────────────────────────────────────────

function riskAlignmentScore(risk: RiskTolerance, preset: StrategyPreset): number {
  // Map risk tolerance to a numeric scale
  const riskScale: Record<RiskTolerance, number> = {
    very_conservative: 1,
    conservative: 2,
    moderate: 3,
    aggressive: 4,
    very_aggressive: 5,
  }

  const userRisk = riskScale[risk] ?? 3

  // Map volatility tolerance to approximate risk level
  const presetRisk = preset.volatility_tolerance <= 0.6 ? 1.5
    : preset.volatility_tolerance <= 0.8 ? 2
    : preset.volatility_tolerance <= 1.2 ? 3
    : preset.volatility_tolerance <= 1.6 ? 4
    : 5

  // Closer match = more points (max 30)
  const diff = Math.abs(userRisk - presetRisk)
  if (diff < 0.5) return 30
  if (diff < 1.0) return 25
  if (diff < 1.5) return 20
  if (diff < 2.0) return 12
  return 5
}

function goalAlignmentScore(goals: InvestmentGoal[], preset: StrategyPreset): number {
  if (!goals?.length) return 10 // neutral

  // Goal → preset name keyword mapping
  const goalPresetAffinities: Record<string, string[]> = {
    wealth_building: ["Growth", "Aggressive", "Balanced"],
    regular_income: ["Income", "Capital Preservation", "Dividends"],
    capital_preservation: ["Capital Preservation", "Income", "Value"],
    retirement: ["Long-term", "Value", "Capital Preservation"],
    tax_optimization: ["Long-term", "Value"],
    learning: ["Balanced", "Swing"],
  }

  let matches = 0
  for (const goal of goals) {
    const affinities = goalPresetAffinities[goal] ?? []
    if (affinities.some((kw) => preset.name.includes(kw))) {
      matches++
    }
  }

  // Max 20 pts, proportional to match ratio
  return Math.round((matches / Math.max(goals.length, 1)) * 20)
}

function sectorFitScore(sectors: string[], preset: StrategyPreset): number {
  if (!sectors?.length) return 5 // neutral

  // If user has many preferred sectors → Sector Rotation or Balanced fits better
  if (sectors.length >= 4 && preset.name.includes("Balanced")) return 10
  if (sectors.length <= 2 && preset.name.includes("Sector")) return 10
  if (sectors.length >= 3 && preset.name.includes("Sector")) return 8

  return 5
}

function generateExplanation(input: RecommendInput, preset: StrategyPreset): string {
  const typeLabel = input.investor_type.replace(/_/g, " ")
  const parts: string[] = []

  parts.push(`Based on your profile as a **${typeLabel}** with **${input.risk_tolerance.replace(/_/g, " ")}** risk tolerance, we recommend the **${preset.name}** strategy.`)

  if (preset.horizon_filter_months) {
    parts.push(`This strategy focuses on a ${preset.horizon_filter_months}-month advisory horizon, filtering out signals that don't match your timeframe.`)
  }

  const w = preset.scoring_weights as Record<string, number>
  const dominant = Object.entries(w).sort(([, a], [, b]) => b - a)[0]
  parts.push(`It emphasises **${dominant[0]}** (${dominant[1]}% weight) in the scoring algorithm.`)

  if (preset.volatility_tolerance < 0.8) {
    parts.push("It uses tighter volatility controls suitable for conservative portfolios.")
  } else if (preset.volatility_tolerance > 1.5) {
    parts.push("It allows higher volatility, giving room for momentum-driven opportunities.")
  }

  return parts.join(" ")
}
