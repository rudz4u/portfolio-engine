/**
 * Signal Explanation Engine
 *
 * Generates plain-English, compliance-safe explanations for why a holding
 * received its quant signal, personalised to the investor's profile.
 *
 * Output is analytical / observational language only — no investment advice.
 */

import type { ScoredHolding } from "@/lib/quant/scoring"
import type { InvestorProfile, StrategyPreset } from "@/lib/types/investor-profile"
import { INVESTOR_TYPE_LABELS } from "@/lib/types/investor-profile"

// ── Helpers ───────────────────────────────────────────────────────────────

function dominant(
  momentum: number,
  valuation: number,
  position: number,
  advisory: number
): string {
  const map: [number, string][] = [
    [momentum,  "momentum"],
    [valuation, "valuation"],
    [position,  "position sizing"],
    [advisory,  "advisory consensus"],
  ]
  return map.sort((a, b) => b[0] - a[0])[0][1]
}

// ── Core explainer ─────────────────────────────────────────────────────────

export function explainSignal(
  holding: ScoredHolding,
  profile?: InvestorProfile | null,
  preset?: StrategyPreset | null,
): string {
  const { trading_symbol, score, signal, pnl_pct, weight_pct,
          momentum_score, valuation_score, position_score, advisory_score,
          technical_signal, macd_trend, profile_alignment } = holding

  const sym   = trading_symbol ?? "this holding"
  const dom   = dominant(momentum_score, valuation_score, position_score, advisory_score)
  const pnlStr = `${pnl_pct >= 0 ? "+" : ""}${pnl_pct.toFixed(1)}%`

  // Base sentence — performance + score
  const base = `**${sym}** scores **${score}/100** with a ${pnlStr} unrealised P&L.`

  // Component context
  let comp = ""
  if (dom === "momentum") {
    comp = macd_trend === "bullish"
      ? `Momentum (${momentum_score}/30) is the strongest contributor — MACD trend is bullish and intraday movement is positive.`
      : `Momentum (${momentum_score}/30) is the dominant driver; ${technical_signal === "oversold" ? "the stock is oversold — a technical bounce may be near." : "the current trend is neutral to bearish."}`
  } else if (dom === "valuation") {
    const gap = ((holding.ltp - holding.avg_price) / Math.max(1, holding.avg_price)) * 100
    comp = gap < 0
      ? `Valuation (${valuation_score}/25) leads — the stock is trading **${Math.abs(gap).toFixed(0)}% below** your average cost, indicating a potential discount zone.`
      : `Valuation (${valuation_score}/25) leads — current price is **${gap.toFixed(0)}% above** your cost basis.`
  } else if (dom === "position sizing") {
    comp = weight_pct > 12
      ? `Position sizing (${position_score}/20) is the main concern — this holding represents **${weight_pct.toFixed(1)}% of the portfolio**, which may be over-concentrated.`
      : `Position sizing (${position_score}/20) is well-calibrated — the holding is appropriately weighted at ${weight_pct.toFixed(1)}%.`
  } else {
    comp = advisory_score > 18
      ? `Advisory consensus (${advisory_score}/25) is strong — SEBI-registered advisors have a bullish view on this stock.`
      : advisory_score < 8
      ? `Advisory consensus (${advisory_score}/25) is weak — advisors have flagged a cautious view.`
      : `Advisory consensus (${advisory_score}/25) is neutral.`
  }

  // Profile-specific context
  let profileCtx = ""
  if (profile) {
    const typeLabel = INVESTOR_TYPE_LABELS[profile.investor_type]
    const seg = holding.segment ?? ""
    const isPreferred = profile.preferred_sectors.includes(seg)
    const isAvoided   = profile.avoided_sectors.includes(seg)

    if (isPreferred) {
      profileCtx = `As a **${typeLabel}**, this stock aligns with your preferred **${seg}** sector focus.`
    } else if (isAvoided) {
      profileCtx = `Note: **${seg}** is in your avoided sectors. This holding falls outside your stated preferences.`
    } else {
      profileCtx = `As a **${typeLabel}**, ${
        signal === "BUY"  ? "this holding's profile is broadly consistent with your investment style." :
        signal === "SELL" ? "the quant model's concern here is particularly relevant given your risk parameters." :
        "the mixed signals warrant monitoring against your investment goals."
      }`
    }

    // Drawdown warning for conservative profiles
    if (pnl_pct < -profile.max_portfolio_drawdown_pct &&
        ["very_conservative", "conservative"].includes(profile.risk_tolerance)) {
      profileCtx += ` The **${Math.abs(pnl_pct).toFixed(0)}% drawdown** exceeds your stated maximum drawdown tolerance of ${profile.max_portfolio_drawdown_pct}%.`
    }
  }

  // Alignment note
  const alignNote = profile_alignment !== undefined
    ? `Profile alignment: **${profile_alignment}/100**.`
    : ""

  return [base, comp, profileCtx, alignNote].filter(Boolean).join(" ")
}

/**
 * Batch-explain all scored holdings and attach `signal_explanation` to each.
 */
export function attachExplanations(
  scored: ScoredHolding[],
  profile?: InvestorProfile | null,
  preset?: StrategyPreset | null,
): ScoredHolding[] {
  return scored.map((h) => ({
    ...h,
    signal_explanation: explainSignal(h, profile, preset),
  }))
}
