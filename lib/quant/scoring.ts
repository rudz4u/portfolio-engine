/**
 * Composite Scoring Engine
 * Computes a 0–100 score for each holding based on available data:
 * - P&L % (momentum proxy)
 * - Day change % (short-term momentum)
 * - RSI approximation (estimated from price movement vs avg cost)
 * - MACD proxy (trend direction based on short vs long-term gain)
 * - Position size relative to portfolio
 *
 * Returns actionable signals: BUY / HOLD / SELL / WATCH
 */

import { rsiSignal } from "./indicators"

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
}

export interface ScoredHolding extends HoldingInput {
  score: number             // 0–100
  signal: Signal
  signal_reason: string
  pnl_pct: number
  weight_pct: number        // % of total portfolio value
  momentum_score: number    // 0–40
  valuation_score: number   // 0–30   (avg vs ltp gap)
  position_score: number    // 0–30   (sizing quality)
  // Technical indicator approximations (estimated from single-point data)
  rsi_approx: number        // 0–100 estimated RSI (uses pnl_pct as proxy for medium-term momentum)
  technical_signal: TechnicalSignal  // oversold / neutral / overbought
  macd_trend: "bullish" | "bearish" | "neutral"  // trend direction proxy
}

export function scoreHoldings(holdings: HoldingInput[]): ScoredHolding[] {
  const totalInvested = holdings.reduce((s, h) => s + (h.invested_amount || 0), 0)
  const totalValue = holdings.reduce((s, h) => s + (h.ltp * h.quantity || 0), 0)

  return holdings
    .map((h) => {
      const currentValue = h.ltp * h.quantity
      const pnl_pct = h.invested_amount > 0
        ? ((currentValue - h.invested_amount) / h.invested_amount) * 100
        : 0
      const weight_pct = totalValue > 0 ? (currentValue / totalValue) * 100 : 0

      // ── RSI approximation ──────────────────────────────────────
      // Estimated from pnl_pct (medium-term momentum proxy) + day_change
      // Thresholds tuned for typical Indian equity behaviour
      const rsi_approx = (
        pnl_pct > 40  ? 82 :
        pnl_pct > 25  ? 74 :
        pnl_pct > 12  ? 65 :
        pnl_pct > 4   ? 56 :
        pnl_pct > -4  ? 50 :
        pnl_pct > -12 ? 42 :
        pnl_pct > -25 ? 33 :
                        22
      )
      const technical_signal = rsiSignal(rsi_approx)

      // ── MACD trend proxy ───────────────────────────────────────
      // Short-term (day_change) vs medium-term (pnl_pct) direction
      const dayChgPct = h.day_change_percentage ?? 0
      const macd_trend: "bullish" | "bearish" | "neutral" =
        dayChgPct > 0.3 && pnl_pct > 0  ? "bullish" :
        dayChgPct < -0.3 && pnl_pct < 0 ? "bearish" :
        "neutral"

      // ── Momentum score (0–40) ──────────────────────────────────
      let momentum_score = 20 // neutral base
      // PnL momentum
      if (pnl_pct > 15) momentum_score += 12
      else if (pnl_pct > 5) momentum_score += 6
      else if (pnl_pct < -15) momentum_score -= 12
      else if (pnl_pct < -5) momentum_score -= 6
      // Intraday
      if (dayChgPct > 2) momentum_score += 5
      else if (dayChgPct > 0.5) momentum_score += 2
      else if (dayChgPct < -2) momentum_score -= 5
      else if (dayChgPct < -0.5) momentum_score -= 2
      // RSI adjustment: oversold stocks get a bounce premium; overbought get caution
      if (technical_signal === "oversold") momentum_score += 5   // potential reversal
      else if (technical_signal === "overbought") momentum_score -= 5  // risk of pullback
      // MACD confirmation
      if (macd_trend === "bullish") momentum_score += 3
      else if (macd_trend === "bearish") momentum_score -= 3
      momentum_score = Math.max(0, Math.min(40, momentum_score))

      // ── Valuation score (0–30) ─────────────────────────────────
      // Compare LTP vs avg buy price — how far from break-even
      let valuation_score = 15 // neutral base
      const priceGapPct = h.avg_price > 0 ? ((h.ltp - h.avg_price) / h.avg_price) * 100 : 0
      if (priceGapPct > 20) valuation_score = 10   // expensive, caution
      else if (priceGapPct > 5) valuation_score = 18
      else if (priceGapPct >= -5) valuation_score = 22  // near cost basis — good entry zone
      else if (priceGapPct < -20) valuation_score = 28  // deep discount — potential buy
      else valuation_score = 20
      valuation_score = Math.max(0, Math.min(30, valuation_score))

      // ── Position score (0–30) ──────────────────────────────────
      // Reward appropriate sizing (2–8% of portfolio = ideal)
      let position_score = 15
      if (weight_pct >= 2 && weight_pct <= 8) position_score = 28
      else if (weight_pct >= 1 && weight_pct <= 12) position_score = 20
      else if (weight_pct > 12) position_score = 10   // over-concentrated
      else position_score = 12                          // under-represented

      const score = Math.round(momentum_score + valuation_score + position_score)

      // ── Signal ────────────────────────────────────────────────
      let signal: Signal
      let signal_reason: string

      if (score >= 70 && pnl_pct > -10) {
        signal = "BUY"
        signal_reason = pnl_pct < 0
          ? "Dip with strong momentum — potential accumulation zone"
          : "Strong momentum + good sizing — consider adding"
      } else if (score >= 50) {
        signal = "HOLD"
        signal_reason = "Balanced risk-reward — maintain position"
      } else if (score < 35 || pnl_pct < -20) {
        signal = "SELL"
        signal_reason = pnl_pct < -20
          ? "Severe drawdown — review thesis or cut losses"
          : "Weak momentum + poor sizing — consider trimming"
      } else {
        signal = "WATCH"
        signal_reason = "Mixed signals — monitor for trend confirmation"
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
