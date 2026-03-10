/**
 * Composite Scoring Engine
 * Computes a 0–100 score for each holding based on available data.
 *
 * Score components:
 *  - Momentum  (0–30) — P&L%, day change, RSI proxy, MACD proxy
 *  - Valuation (0–25) — LTP vs avg cost gap
 *  - Position  (0–20) — portfolio weight sizing quality
 *  - Advisory  (0–25) — weighted consensus from SEBI advisors (fallback: 12)
 *
 * Returns actionable signals: BUY / HOLD / SELL / WATCH
 */

import { rsiSignal } from "./indicators"
import { ScoringWeights, DEFAULT_WEIGHTS } from "./scoring-defaults"

export type Signal = "BUY" | "HOLD" | "SELL" | "WATCH"
export type TechnicalSignal = "oversold" | "neutral" | "overbought"

export interface HoldingInput {
  instrument_key: string
  trading_symbol?: string
  name?: string
  quantity: number
  avg_price: number
  ltp: number
  unrealized_pl: number
  invested_amount: number
  day_change?: number
  day_change_percentage?: number
  segment?: string
  /** Pre-computed advisory score (0–25) from advisory_consensus table. Defaults to 12 (neutral). */
  advisory_score?: number
}

/** Real technical indicator data from candle analysis (optional enhancement) */
export interface RealTechnicalData {
  rsi: number | null
  rsiSignal: "oversold" | "neutral" | "overbought"
  macdTrend: "bullish" | "bearish" | "neutral"
  /** Number of bullish patterns detected recently */
  bullishPatterns: number
  /** Number of bearish patterns detected recently */
  bearishPatterns: number
}

export interface ScoredHolding extends HoldingInput {
  score: number             // 0–100
  signal: Signal
  signal_reason: string
  pnl_pct: number
  weight_pct: number        // % of total portfolio value
  momentum_score: number    // 0–30
  valuation_score: number   // 0–25   (avg vs ltp gap)
  position_score: number    // 0–20   (sizing quality)
  advisory_score: number    // 0–25   (SEBI advisor consensus; 12 = neutral/no data)
  // Technical indicator approximations (estimated from single-point data)
  rsi_approx: number        // 0–100 estimated RSI (uses pnl_pct as proxy for medium-term momentum)
  technical_signal: TechnicalSignal  // oversold / neutral / overbought
  macd_trend: "bullish" | "bearish" | "neutral"  // trend direction proxy
}

/**
 * @param holdings    — Portfolio holdings to score
 * @param weights     — Optional custom scoring weights
 * @param technicals  — Optional map of instrument_key → real technical data from candle analysis.
 *                       When provided, real RSI/MACD/patterns are used instead of P&L approximations.
 */
export function scoreHoldings(
  holdings: HoldingInput[],
  weights?: ScoringWeights,
  technicals?: Map<string, RealTechnicalData>,
): ScoredHolding[] {
  const w = weights ?? DEFAULT_WEIGHTS
  const totalInvested = holdings.reduce((s, h) => s + (h.invested_amount || 0), 0)
  const totalValue = holdings.reduce((s, h) => s + (h.ltp * h.quantity || 0), 0)

  return holdings
    .map((h) => {
      const currentValue = h.ltp * h.quantity
      const pnl_pct = h.invested_amount > 0
        ? ((currentValue - h.invested_amount) / h.invested_amount) * 100
        : 0
      const weight_pct = totalValue > 0 ? (currentValue / totalValue) * 100 : 0

      // ── Technical data — prefer real candle-derived values, fall back to approximations ──
      const real = technicals?.get(h.instrument_key)

      const rsi_approx = real?.rsi != null
        ? Math.round(real.rsi)
        : (
          pnl_pct > 40  ? 82 :
          pnl_pct > 25  ? 74 :
          pnl_pct > 12  ? 65 :
          pnl_pct > 4   ? 56 :
          pnl_pct > -4  ? 50 :
          pnl_pct > -12 ? 42 :
          pnl_pct > -25 ? 33 :
                          22
        )
      const technical_signal = real?.rsiSignal ?? rsiSignal(rsi_approx)

      const dayChgPct = h.day_change_percentage ?? 0
      const macd_trend: "bullish" | "bearish" | "neutral" = real?.macdTrend ??
        (dayChgPct > 0.3 && pnl_pct > 0  ? "bullish" :
        dayChgPct < -0.3 && pnl_pct < 0 ? "bearish" :
        "neutral")

      // ── Momentum score (0–30) ──────────────────────────────────
      let momentum_score = 15 // neutral base
      // PnL momentum
      if (pnl_pct > 15) momentum_score += 9
      else if (pnl_pct > 5) momentum_score += 5
      else if (pnl_pct < -15) momentum_score -= 9
      else if (pnl_pct < -5) momentum_score -= 5
      // Intraday
      if (dayChgPct > 2) momentum_score += 4
      else if (dayChgPct > 0.5) momentum_score += 2
      else if (dayChgPct < -2) momentum_score -= 4
      else if (dayChgPct < -0.5) momentum_score -= 2
      // RSI adjustment: oversold stocks get a bounce premium; overbought get caution
      if (technical_signal === "oversold") momentum_score += 3   // potential reversal
      else if (technical_signal === "overbought") momentum_score -= 3  // risk of pullback
      // MACD confirmation
      if (macd_trend === "bullish") momentum_score += 2
      else if (macd_trend === "bearish") momentum_score -= 2
      // Candlestick pattern confirmation (when real candle data available)
      if (real) {
        if (real.bullishPatterns > 0) momentum_score += Math.min(3, real.bullishPatterns)
        if (real.bearishPatterns > 0) momentum_score -= Math.min(3, real.bearishPatterns)
      }
      momentum_score = Math.max(0, Math.min(30, momentum_score))

      // ── Valuation score (0–25) ─────────────────────────────────
      // Compare LTP vs avg buy price — how far from break-even
      let valuation_score = 13 // neutral base
      const priceGapPct = h.avg_price > 0 ? ((h.ltp - h.avg_price) / h.avg_price) * 100 : 0
      if (priceGapPct > 20) valuation_score = 8    // expensive, caution
      else if (priceGapPct > 5) valuation_score = 14
      else if (priceGapPct >= -5) valuation_score = 18  // near cost basis — good entry zone
      else if (priceGapPct < -20) valuation_score = 23  // deep discount — potential buy
      else valuation_score = 16
      valuation_score = Math.max(0, Math.min(25, valuation_score))

      // ── Position score (0–20) ──────────────────────────────────
      // Reward appropriate sizing (2–8% of portfolio = ideal)
      let position_score = 10
      if (weight_pct >= 2 && weight_pct <= 8) position_score = 18
      else if (weight_pct >= 1 && weight_pct <= 12) position_score = 13
      else if (weight_pct > 12) position_score = 7    // over-concentrated
      else position_score = 8                          // under-represented

      // ── Advisory score (0–25) ──────────────────────────────────
      // Pre-computed weighted consensus from SEBI advisors.
      // Falls back to 12 (neutral) when no advisory data available —
      // this preserves existing score distribution until the cron populates data.
      const advisory_score = Math.max(0, Math.min(25, h.advisory_score ?? 12))

      // Weighted score — user-configurable component weights that sum to 100.
      // Each component is normalised to its default max before applying the weight.
      const score = Math.round(
        (momentum_score  / 30) * w.momentum  +
        (valuation_score / 25) * w.valuation +
        (position_score  / 20) * w.position  +
        (advisory_score  / 25) * w.advisory
      )

      // ── Signal ────────────────────────────────────────────────
      let signal: Signal
      let signal_reason: string

      if (score >= 70 && pnl_pct > -10) {
        signal = "BUY"
        signal_reason = pnl_pct < 0
          ? "Strong quant score — elevated momentum in a dip"
          : "Strong quant score — momentum elevated, position sized appropriately"
      } else if (score >= 50) {
        signal = "HOLD"
        signal_reason = "Moderate quant score — momentum balanced, monitor for trend change"
      } else if (score < 35 || pnl_pct < -20) {
        signal = "SELL"
        signal_reason = pnl_pct < -20
          ? "Significant drawdown detected — quant score weakened, review allocation"
          : "Low quant score — weak momentum, position may be oversized"
      } else {
        signal = "WATCH"
        signal_reason = "Mixed quant signals — monitor for directional confirmation"
      }

      return {
        ...h,
        score,
        signal,
        signal_reason,
        pnl_pct,
        weight_pct,
        momentum_score,
        valuation_score,
        position_score,
        advisory_score,
        rsi_approx,
        technical_signal,
        macd_trend,
      }
    })
    .sort((a, b) => b.score - a.score)
}

/** Summary stats for the scored portfolio */
export function portfolioSummary(scored: ScoredHolding[]) {
  const bySignal = { BUY: 0, HOLD: 0, SELL: 0, WATCH: 0 }
  let totalScore = 0
  for (const s of scored) {
    bySignal[s.signal]++
    totalScore += s.score
  }
  return {
    avgScore: scored.length ? Math.round(totalScore / scored.length) : 0,
    bySignal,
    total: scored.length,
  }
}
