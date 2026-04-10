/**
 * Investor Profile & Strategy Preset types
 *
 * Defines the data model for granular investor profiling, used throughout
 * the scoring engine, onboarding wizard, AI assistant, and settings UI.
 */

// ── Investor Type ──────────────────────────────────────────────────────────

export const INVESTOR_TYPES = [
  "short_term_trader",
  "swing_trader",
  "medium_term",
  "long_term",
  "sector_specialist",
  "value_investor",
  "growth_investor",
  "income_investor",
] as const

export type InvestorType = (typeof INVESTOR_TYPES)[number]

export const INVESTOR_TYPE_LABELS: Record<InvestorType, string> = {
  short_term_trader: "Short-term Trader",
  swing_trader: "Swing Trader",
  medium_term: "Medium-term Investor",
  long_term: "Long-term Investor",
  sector_specialist: "Sector Specialist",
  value_investor: "Value Investor",
  growth_investor: "Growth Investor",
  income_investor: "Income / Dividend Investor",
}

export const INVESTOR_TYPE_DESCRIPTIONS: Record<InvestorType, string> = {
  short_term_trader: "Trade frequently, hold positions days to weeks. Focus on momentum and technical setups.",
  swing_trader: "Capture medium swings over 1–3 months. Balance technicals with fundamentals.",
  medium_term: "Hold 6–18 months. Focus on growth catalysts and sector momentum.",
  long_term: "Hold 2+ years. Build wealth through quality companies and compounding.",
  sector_specialist: "Deep expertise in specific sectors. Concentrate on high-conviction industry bets.",
  value_investor: "Buy undervalued stocks below intrinsic value. Patient for price discovery.",
  growth_investor: "Target high-growth companies with strong earnings momentum.",
  income_investor: "Focus on dividend yield and regular income from investments.",
}

export const INVESTOR_TYPE_ICONS: Record<InvestorType, string> = {
  short_term_trader: "⚡",
  swing_trader: "🌊",
  medium_term: "📈",
  long_term: "🏔️",
  sector_specialist: "🎯",
  value_investor: "💎",
  growth_investor: "🚀",
  income_investor: "💰",
}

// ── Risk ───────────────────────────────────────────────────────────────────

export const RISK_TOLERANCE_LEVELS = [
  "very_conservative",
  "conservative",
  "moderate",
  "aggressive",
  "very_aggressive",
] as const

export type RiskTolerance = (typeof RISK_TOLERANCE_LEVELS)[number]

export const RISK_TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  very_conservative: "Very Conservative",
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
  very_aggressive: "Very Aggressive",
}

export const RISK_CAPACITY_LEVELS = ["low", "medium", "high"] as const
export type RiskCapacity = (typeof RISK_CAPACITY_LEVELS)[number]

// ── Experience ─────────────────────────────────────────────────────────────

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]

// ── Decision Style ─────────────────────────────────────────────────────────

export const DECISION_STYLES = [
  "data_driven",
  "fundamental",
  "technical",
  "hybrid",
  "advisory_dependent",
] as const

export type DecisionStyle = (typeof DECISION_STYLES)[number]

export const DECISION_STYLE_LABELS: Record<DecisionStyle, string> = {
  data_driven: "Data-Driven / Quantitative",
  fundamental: "Fundamental Analysis",
  technical: "Technical Analysis",
  hybrid: "Hybrid (Fundamental + Technical)",
  advisory_dependent: "Follows Advisory / Expert Tips",
}

// ── Rebalance Frequency ────────────────────────────────────────────────────

export const REBALANCE_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "manual",
] as const

export type RebalanceFrequency = (typeof REBALANCE_FREQUENCIES)[number]

// ── Budget ─────────────────────────────────────────────────────────────────

export const BUDGET_RANGES = [
  "under_1L",
  "1L_5L",
  "5L_15L",
  "15L_50L",
  "above_50L",
] as const

export type AnnualBudget = (typeof BUDGET_RANGES)[number]

export const BUDGET_LABELS: Record<AnnualBudget, string> = {
  under_1L: "Under ₹1 Lakh",
  "1L_5L": "₹1–5 Lakhs",
  "5L_15L": "₹5–15 Lakhs",
  "15L_50L": "₹15–50 Lakhs",
  above_50L: "Above ₹50 Lakhs",
}

// ── Investment Goals ───────────────────────────────────────────────────────

export const INVESTMENT_GOALS = [
  "wealth_building",
  "regular_income",
  "capital_preservation",
  "retirement",
  "tax_optimization",
  "learning",
] as const

export type InvestmentGoal = (typeof INVESTMENT_GOALS)[number]

export const INVESTMENT_GOAL_LABELS: Record<InvestmentGoal, string> = {
  wealth_building: "Wealth Building",
  regular_income: "Regular Income",
  capital_preservation: "Capital Preservation",
  retirement: "Retirement Planning",
  tax_optimization: "Tax Optimization",
  learning: "Learning & Exploration",
}

// ── Investment Horizon ─────────────────────────────────────────────────────

export interface InvestmentHorizon {
  default_months: number  // Primary holding period
  min_months: number      // Shortest acceptable hold
  max_months: number      // Longest typical hold
}

// ── Full Investor Profile ──────────────────────────────────────────────────

export interface InvestorProfile {
  id: string
  user_id: string
  investor_type: InvestorType
  investment_horizon: InvestmentHorizon
  risk_tolerance: RiskTolerance
  risk_capacity: RiskCapacity
  max_portfolio_drawdown_pct: number    // 5–50%
  max_single_stock_allocation_pct: number // 2–25%
  preferred_sectors: string[]
  avoided_sectors: string[]
  investment_goals: InvestmentGoal[]
  annual_investment_budget: AnnualBudget | null
  experience_level: ExperienceLevel
  decision_style: DecisionStyle
  rebalance_frequency: RebalanceFrequency
  active_strategy_preset_id: string | null
  custom_overrides: StrategyOverrides | null
  created_at: string
  updated_at: string
}

// ── Strategy Preset ────────────────────────────────────────────────────────

export interface SignalThresholds {
  strong_buy_min: number   // score >= this → STRONG_BUY (default 80)
  buy_min: number          // score >= this → BUY         (default 65)
  hold_min: number         // score >= this → HOLD        (default 45)
  sell_max: number         // score < this  → SELL        (default 35)
  strong_sell_max: number  // score < this  → STRONG_SELL (default 20)
}

export interface StrategyPreset {
  id: string
  name: string
  description: string
  investor_types: InvestorType[]
  scoring_weights: {
    momentum: number
    valuation: number
    position: number
    advisory: number
  }
  signal_thresholds: SignalThresholds
  horizon_filter_months: number | null
  volatility_tolerance: number  // ATR multiplier (e.g. 1.0 = baseline, 0.5 = conservative, 2.0 = aggressive)
  is_system: boolean
  created_at: string
}

// Partial overrides a user can apply on top of a preset
export interface StrategyOverrides {
  scoring_weights?: Partial<StrategyPreset["scoring_weights"]>
  signal_thresholds?: Partial<SignalThresholds>
}

// ── Per-Stock Holding Override ──────────────────────────────────────────────

export const HOLDING_GOALS = [
  "growth",
  "income",
  "swing_trade",
  "short_term_trade",
  "value_hold",
  "sector_bet",
  "speculative",
  "learning",
] as const

export type HoldingGoal = (typeof HOLDING_GOALS)[number]

export const HOLDING_GOAL_LABELS: Record<HoldingGoal, string> = {
  growth: "Growth",
  income: "Income / Dividend",
  swing_trade: "Swing Trade",
  short_term_trade: "Short-term Trade",
  value_hold: "Long-term Value Hold",
  sector_bet: "Sector Bet",
  speculative: "Speculative",
  learning: "Learning / Paper",
}

export interface HoldingOverride {
  id: string
  user_id: string
  instrument_key: string
  trading_symbol: string

  /** Per-stock investment goal */
  goal: HoldingGoal | null
  goal_notes: string | null

  /** User's target sell price */
  target_price: number | null
  /** User's stop-loss trigger price */
  stop_loss_price: number | null
  /** Optional trailing stop-loss percentage */
  trailing_stop_pct: number | null

  /** Per-stock strategy preset override */
  strategy_preset_id: string | null
  /** Force HOLD or WATCH regardless of score */
  custom_signal_override: "force_hold" | "force_watch" | null

  /** Max portfolio allocation for this stock */
  max_allocation_pct: number | null
  risk_note: string | null

  /** Don't suggest SELL before this date */
  hold_until: string | null
  /** Minimum holding period override (months) */
  min_hold_months: number | null

  created_at: string
  updated_at: string
}

// ── Available Sectors (from instruments table segments) ─────────────────────

export const KNOWN_SECTORS = [
  "BFSI",
  "IT",
  "Pharma",
  "Auto",
  "FMCG",
  "Energy",
  "Green Energy",
  "Defence",
  "PSU",
  "Metals",
  "Cement",
  "Chemical",
  "Infrastructure",
  "Telecom",
  "Media",
  "Real Estate",
  "EV",
  "Technology",
  "Others",
] as const

// ── Onboarding payload (subset sent from wizard) ───────────────────────────

export interface OnboardingProfilePayload {
  investor_type: InvestorType
  investment_horizon: InvestmentHorizon
  risk_tolerance: RiskTolerance
  risk_capacity: RiskCapacity
  max_portfolio_drawdown_pct: number
  max_single_stock_allocation_pct: number
  preferred_sectors: string[]
  avoided_sectors: string[]
  investment_goals: InvestmentGoal[]
  experience_level: ExperienceLevel
  decision_style: DecisionStyle
}

// ── Defaults per investor type (used for pre-filling horizon/risk) ──────────

export const INVESTOR_TYPE_DEFAULTS: Record<InvestorType, {
  horizon: InvestmentHorizon
  risk_tolerance: RiskTolerance
  max_drawdown: number
  max_allocation: number
  rebalance: RebalanceFrequency
}> = {
  short_term_trader: {
    horizon: { default_months: 1, min_months: 0, max_months: 3 },
    risk_tolerance: "aggressive",
    max_drawdown: 15,
    max_allocation: 15,
    rebalance: "weekly",
  },
  swing_trader: {
    horizon: { default_months: 3, min_months: 1, max_months: 6 },
    risk_tolerance: "aggressive",
    max_drawdown: 20,
    max_allocation: 12,
    rebalance: "monthly",
  },
  medium_term: {
    horizon: { default_months: 12, min_months: 6, max_months: 24 },
    risk_tolerance: "moderate",
    max_drawdown: 15,
    max_allocation: 10,
    rebalance: "quarterly",
  },
  long_term: {
    horizon: { default_months: 60, min_months: 24, max_months: 120 },
    risk_tolerance: "moderate",
    max_drawdown: 25,
    max_allocation: 8,
    rebalance: "semi_annual",
  },
  sector_specialist: {
    horizon: { default_months: 12, min_months: 3, max_months: 36 },
    risk_tolerance: "aggressive",
    max_drawdown: 20,
    max_allocation: 20,
    rebalance: "monthly",
  },
  value_investor: {
    horizon: { default_months: 36, min_months: 12, max_months: 120 },
    risk_tolerance: "moderate",
    max_drawdown: 20,
    max_allocation: 10,
    rebalance: "quarterly",
  },
  growth_investor: {
    horizon: { default_months: 24, min_months: 12, max_months: 60 },
    risk_tolerance: "aggressive",
    max_drawdown: 25,
    max_allocation: 12,
    rebalance: "quarterly",
  },
  income_investor: {
    horizon: { default_months: 36, min_months: 12, max_months: 120 },
    risk_tolerance: "conservative",
    max_drawdown: 10,
    max_allocation: 8,
    rebalance: "semi_annual",
  },
}
