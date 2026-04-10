import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { scoreHoldings } from "@/lib/quant/scoring"
import type { InvestorProfile, StrategyPreset } from "@/lib/types/investor-profile"

export const dynamic = "force-dynamic"

interface HealthIssue {
  type: "concentration" | "sector_mismatch" | "drawdown" | "avoided_sector"
  severity: "high" | "medium" | "low"
  message: string
}

interface HealthSuggestion {
  message: string
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Fetch investor profile ───────────────────────────────────────────────
  const { data: profileRow } = await supabase
    .from("investor_profiles")
    .select("*, strategy_presets(*)")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profileRow) {
    return NextResponse.json({
      profile_present: false,
      alignment_score: null,
      issues: [],
      suggestions: [{ message: "Set up your investor profile to get personalised health checks." }],
    })
  }

  const investorProfile = profileRow as InvestorProfile
  const activePreset = (profileRow.strategy_presets as StrategyPreset | null) ?? undefined

  // ── Fetch holdings ───────────────────────────────────────────────────────
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)

  if (!portfolios || portfolios.length === 0) {
    return NextResponse.json({
      profile_present: true,
      alignment_score: 0,
      issues: [],
      suggestions: [{ message: "Sync your holdings first to run a health check." }],
    })
  }

  const { data: holdingsRows } = await supabase
    .from("holdings")
    .select("instrument_key, quantity, avg_price, ltp, unrealized_pl, invested_amount, segment, raw")
    .eq("portfolio_id", portfolios[0].id)

  if (!holdingsRows || holdingsRows.length === 0) {
    return NextResponse.json({
      profile_present: true,
      alignment_score: 0,
      issues: [],
      suggestions: [{ message: "No holdings found. Sync your portfolio and try again." }],
    })
  }

  const inputs = holdingsRows.map((h) => ({
    instrument_key: h.instrument_key as string,
    trading_symbol: (h.raw as Record<string, string>)?.trading_symbol ?? (h.instrument_key as string),
    name: (h.raw as Record<string, string>)?.company_name ?? (h.instrument_key as string),
    quantity: Number(h.quantity) || 0,
    avg_price: Number(h.avg_price) || 0,
    ltp: Number(h.ltp) || Number(h.avg_price) || 0,
    unrealized_pl: Number(h.unrealized_pl) || 0,
    invested_amount: Number(h.invested_amount) || 0,
    segment: (h.segment as string) ?? "Others",
  }))

  const scored = scoreHoldings(inputs, undefined, undefined, investorProfile, activePreset)

  // ── Compute metrics ──────────────────────────────────────────────────────
  const totalInvested = inputs.reduce((s, h) => s + h.invested_amount, 0)
  const totalPnL = inputs.reduce((s, h) => s + h.unrealized_pl, 0)
  const drawdownPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  const maxAlloc = investorProfile.max_single_stock_allocation_pct ?? 10
  const maxDrawdown = investorProfile.max_portfolio_drawdown_pct ?? 20
  const preferred = investorProfile.preferred_sectors ?? []
  const avoided = investorProfile.avoided_sectors ?? []

  const issues: HealthIssue[] = []
  const suggestions: HealthSuggestion[] = []

  // ── Concentration check ──────────────────────────────────────────────────
  for (const h of inputs) {
    if (totalInvested === 0) break
    const allocationPct = (h.invested_amount / totalInvested) * 100
    if (allocationPct > maxAlloc * 1.5) {
      issues.push({
        type: "concentration",
        severity: "high",
        message: `${h.trading_symbol} is ${allocationPct.toFixed(1)}% of portfolio — well above your ${maxAlloc}% limit.`,
      })
    } else if (allocationPct > maxAlloc) {
      issues.push({
        type: "concentration",
        severity: "medium",
        message: `${h.trading_symbol} is ${allocationPct.toFixed(1)}% of portfolio — above your ${maxAlloc}% limit.`,
      })
    }
  }

  // ── Sector mismatch check ────────────────────────────────────────────────
  if (preferred.length > 0) {
    const preferredInvested = inputs
      .filter((h) => preferred.includes(h.segment))
      .reduce((s, h) => s + h.invested_amount, 0)
    const preferredPct = totalInvested > 0 ? (preferredInvested / totalInvested) * 100 : 0
    if (preferredPct < 30 && preferred.length > 0) {
      suggestions.push({
        message: `Only ${preferredPct.toFixed(0)}% of your portfolio is in your preferred sectors (${preferred.join(", ")}). Consider increasing allocation.`,
      })
    }
  }

  // ── Avoided sector check ─────────────────────────────────────────────────
  if (avoided.length > 0) {
    const avoidedHoldings = inputs.filter((h) => avoided.includes(h.segment))
    for (const h of avoidedHoldings) {
      issues.push({
        type: "avoided_sector",
        severity: "low",
        message: `${h.trading_symbol} (${h.segment}) is in a sector you prefer to avoid.`,
      })
    }
  }

  // ── Drawdown check ───────────────────────────────────────────────────────
  if (drawdownPct < -maxDrawdown) {
    issues.push({
      type: "drawdown",
      severity: "high",
      message: `Portfolio is down ${Math.abs(drawdownPct).toFixed(1)}%, exceeding your ${maxDrawdown}% drawdown limit. Review your risk exposure.`,
    })
  } else if (drawdownPct < -(maxDrawdown * 0.7)) {
    issues.push({
      type: "drawdown",
      severity: "medium",
      message: `Portfolio is down ${Math.abs(drawdownPct).toFixed(1)}%, approaching your ${maxDrawdown}% drawdown limit.`,
    })
  }

  // ── Generate generic suggestions ─────────────────────────────────────────
  const highConcentration = issues.filter((i) => i.type === "concentration").length
  if (highConcentration > 2) {
    suggestions.push({
      message: `${highConcentration} stocks exceed your concentration limit. Diversify across more positions.`,
    })
  }
  if (issues.length === 0) {
    suggestions.push({ message: "Portfolio health is within your profile parameters. Keep monitoring." })
  }

  // ── Compute alignment score ──────────────────────────────────────────────
  const avgProfileAlignment =
    scored.filter((s) => s.profile_alignment !== undefined).reduce((sum, s) => sum + (s.profile_alignment ?? 0), 0) /
      (scored.filter((s) => s.profile_alignment !== undefined).length || 1)

  const issueDeductions = issues.reduce((sum, i) => sum + (i.severity === "high" ? 15 : i.severity === "medium" ? 8 : 3), 0)
  const alignmentScore = Math.max(0, Math.round((avgProfileAlignment > 0 ? avgProfileAlignment : 60) - issueDeductions))

  return NextResponse.json({
    profile_present: true,
    alignment_score: alignmentScore,
    drawdown_pct: Number(drawdownPct.toFixed(2)),
    total_holdings: inputs.length,
    issues,
    suggestions,
  })
}
