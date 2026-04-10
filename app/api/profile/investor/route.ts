import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  INVESTOR_TYPES,
  RISK_TOLERANCE_LEVELS,
  RISK_CAPACITY_LEVELS,
  EXPERIENCE_LEVELS,
  DECISION_STYLES,
  REBALANCE_FREQUENCIES,
  BUDGET_RANGES,
  INVESTMENT_GOALS,
  type InvestorType,
  type RiskTolerance,
  type RiskCapacity,
  type ExperienceLevel,
  type DecisionStyle,
  type RebalanceFrequency,
  type AnnualBudget,
  type InvestmentGoal,
  type InvestmentHorizon,
} from "@/lib/types/investor-profile"

export const dynamic = "force-dynamic"

// ── GET: Fetch current user's investor profile ────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("investor_profiles")
    .select("*, strategy_presets(*)")
    .eq("user_id", user.id)
    .single()

  if (error && error.code === "PGRST116") {
    // No profile yet
    return NextResponse.json({ profile: null })
  }
  if (error) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}

// ── POST: Create investor profile (onboarding) ───────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const validated = validateProfilePayload(body)
  if (validated.error) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("investor_profiles")
    .upsert(
      { user_id: user.id, ...validated.data, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("*, strategy_presets(*)")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}

// ── PATCH: Update investor profile (settings) ─────────────────────────────

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Check existing profile
  const { data: existing } = await supabase
    .from("investor_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: "No investor profile exists. Create one first." }, { status: 404 })
  }

  const body = await request.json()
  const validated = validateProfilePatch(body)
  if (validated.error) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("investor_profiles")
    .update({ ...validated.data, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("*, strategy_presets(*)")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}

// ── Validation helpers ────────────────────────────────────────────────────

function validateProfilePayload(body: Record<string, unknown>): { data?: Record<string, unknown>; error?: string } {
  const {
    investor_type, investment_horizon, risk_tolerance, risk_capacity,
    max_portfolio_drawdown_pct, max_single_stock_allocation_pct,
    preferred_sectors, avoided_sectors, investment_goals,
    annual_investment_budget, experience_level, decision_style,
    rebalance_frequency, active_strategy_preset_id, custom_overrides,
  } = body

  // Required fields
  if (!investor_type || !INVESTOR_TYPES.includes(investor_type as InvestorType)) {
    return { error: `investor_type must be one of: ${INVESTOR_TYPES.join(", ")}` }
  }
  if (!risk_tolerance || !RISK_TOLERANCE_LEVELS.includes(risk_tolerance as RiskTolerance)) {
    return { error: `risk_tolerance must be one of: ${RISK_TOLERANCE_LEVELS.join(", ")}` }
  }
  if (!risk_capacity || !RISK_CAPACITY_LEVELS.includes(risk_capacity as RiskCapacity)) {
    return { error: `risk_capacity must be one of: ${RISK_CAPACITY_LEVELS.join(", ")}` }
  }

  // Investment horizon
  const horizon = investment_horizon as InvestmentHorizon | undefined
  if (!horizon || typeof horizon.default_months !== "number" || typeof horizon.min_months !== "number" || typeof horizon.max_months !== "number") {
    return { error: "investment_horizon must have default_months, min_months, and max_months (all numbers)" }
  }
  if (horizon.min_months < 0 || horizon.max_months > 240 || horizon.default_months < horizon.min_months || horizon.default_months > horizon.max_months) {
    return { error: "investment_horizon values must be: 0 ≤ min ≤ default ≤ max ≤ 240" }
  }

  // Numeric bounds
  const drawdown = typeof max_portfolio_drawdown_pct === "number" ? max_portfolio_drawdown_pct : 15
  if (drawdown < 5 || drawdown > 50) return { error: "max_portfolio_drawdown_pct must be 5–50" }

  const allocation = typeof max_single_stock_allocation_pct === "number" ? max_single_stock_allocation_pct : 10
  if (allocation < 2 || allocation > 25) return { error: "max_single_stock_allocation_pct must be 2–25" }

  // Arrays
  const prefSectors = Array.isArray(preferred_sectors) ? preferred_sectors.filter((s): s is string => typeof s === "string") : []
  const avoidSectors = Array.isArray(avoided_sectors) ? avoided_sectors.filter((s): s is string => typeof s === "string") : []
  const goals = Array.isArray(investment_goals)
    ? investment_goals.filter((g): g is InvestmentGoal => INVESTMENT_GOALS.includes(g as InvestmentGoal))
    : []

  // Optional enums
  const expLevel = experience_level && EXPERIENCE_LEVELS.includes(experience_level as ExperienceLevel)
    ? experience_level as ExperienceLevel : "beginner"
  const decStyle = decision_style && DECISION_STYLES.includes(decision_style as DecisionStyle)
    ? decision_style as DecisionStyle : "hybrid"
  const rebalance = rebalance_frequency && REBALANCE_FREQUENCIES.includes(rebalance_frequency as RebalanceFrequency)
    ? rebalance_frequency as RebalanceFrequency : "quarterly"
  const budget = annual_investment_budget && BUDGET_RANGES.includes(annual_investment_budget as AnnualBudget)
    ? annual_investment_budget as AnnualBudget : null

  const data: Record<string, unknown> = {
    investor_type,
    investment_horizon: horizon,
    risk_tolerance,
    risk_capacity,
    max_portfolio_drawdown_pct: drawdown,
    max_single_stock_allocation_pct: allocation,
    preferred_sectors: prefSectors,
    avoided_sectors: avoidSectors,
    investment_goals: goals,
    annual_investment_budget: budget,
    experience_level: expLevel,
    decision_style: decStyle,
    rebalance_frequency: rebalance,
  }

  if (active_strategy_preset_id && typeof active_strategy_preset_id === "string") {
    data.active_strategy_preset_id = active_strategy_preset_id
  }
  if (custom_overrides && typeof custom_overrides === "object") {
    data.custom_overrides = custom_overrides
  }

  return { data }
}

function validateProfilePatch(body: Record<string, unknown>): { data?: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {}

  if (body.investor_type !== undefined) {
    if (!INVESTOR_TYPES.includes(body.investor_type as InvestorType)) {
      return { error: `investor_type must be one of: ${INVESTOR_TYPES.join(", ")}` }
    }
    data.investor_type = body.investor_type
  }

  if (body.investment_horizon !== undefined) {
    const h = body.investment_horizon as InvestmentHorizon
    if (typeof h.default_months !== "number" || typeof h.min_months !== "number" || typeof h.max_months !== "number") {
      return { error: "investment_horizon must have default_months, min_months, and max_months" }
    }
    if (h.min_months < 0 || h.max_months > 240 || h.default_months < h.min_months || h.default_months > h.max_months) {
      return { error: "investment_horizon values must be: 0 ≤ min ≤ default ≤ max ≤ 240" }
    }
    data.investment_horizon = h
  }

  if (body.risk_tolerance !== undefined) {
    if (!RISK_TOLERANCE_LEVELS.includes(body.risk_tolerance as RiskTolerance)) {
      return { error: `risk_tolerance must be one of: ${RISK_TOLERANCE_LEVELS.join(", ")}` }
    }
    data.risk_tolerance = body.risk_tolerance
  }

  if (body.risk_capacity !== undefined) {
    if (!RISK_CAPACITY_LEVELS.includes(body.risk_capacity as RiskCapacity)) {
      return { error: `risk_capacity must be one of: ${RISK_CAPACITY_LEVELS.join(", ")}` }
    }
    data.risk_capacity = body.risk_capacity
  }

  if (body.max_portfolio_drawdown_pct !== undefined) {
    const v = body.max_portfolio_drawdown_pct as number
    if (typeof v !== "number" || v < 5 || v > 50) return { error: "max_portfolio_drawdown_pct must be 5–50" }
    data.max_portfolio_drawdown_pct = v
  }

  if (body.max_single_stock_allocation_pct !== undefined) {
    const v = body.max_single_stock_allocation_pct as number
    if (typeof v !== "number" || v < 2 || v > 25) return { error: "max_single_stock_allocation_pct must be 2–25" }
    data.max_single_stock_allocation_pct = v
  }

  if (body.preferred_sectors !== undefined) {
    data.preferred_sectors = Array.isArray(body.preferred_sectors)
      ? body.preferred_sectors.filter((s): s is string => typeof s === "string") : []
  }

  if (body.avoided_sectors !== undefined) {
    data.avoided_sectors = Array.isArray(body.avoided_sectors)
      ? body.avoided_sectors.filter((s): s is string => typeof s === "string") : []
  }

  if (body.investment_goals !== undefined) {
    data.investment_goals = Array.isArray(body.investment_goals)
      ? body.investment_goals.filter((g): g is string => INVESTMENT_GOALS.includes(g as InvestmentGoal)) : []
  }

  if (body.annual_investment_budget !== undefined) {
    if (body.annual_investment_budget === null) {
      data.annual_investment_budget = null
    } else if (BUDGET_RANGES.includes(body.annual_investment_budget as AnnualBudget)) {
      data.annual_investment_budget = body.annual_investment_budget
    }
  }

  if (body.experience_level !== undefined) {
    if (EXPERIENCE_LEVELS.includes(body.experience_level as ExperienceLevel)) {
      data.experience_level = body.experience_level
    }
  }

  if (body.decision_style !== undefined) {
    if (DECISION_STYLES.includes(body.decision_style as DecisionStyle)) {
      data.decision_style = body.decision_style
    }
  }

  if (body.rebalance_frequency !== undefined) {
    if (REBALANCE_FREQUENCIES.includes(body.rebalance_frequency as RebalanceFrequency)) {
      data.rebalance_frequency = body.rebalance_frequency
    }
  }

  if (body.active_strategy_preset_id !== undefined) {
    data.active_strategy_preset_id = body.active_strategy_preset_id === null ? null : String(body.active_strategy_preset_id)
  }

  if (body.custom_overrides !== undefined) {
    data.custom_overrides = body.custom_overrides === null ? null : body.custom_overrides
  }

  if (Object.keys(data).length === 0) {
    return { error: "No valid fields to update" }
  }

  return { data }
}
