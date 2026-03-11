import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  TrendingUp,
  TrendingDown,
  Briefcase,
  Activity,
  Layers,
  Target,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { PortfolioCharts } from "./portfolio-charts"
import type { SnapshotEntry } from "./portfolio-charts"
import { SyncBar } from "./sync-bar"
import { DashboardHero } from "./dashboard-hero"

// ── Health Score (0–100) ──────────────────────────────────────────────────
function computeHealthScore(
  pnlPct:       number,
  segCount:     number,
  holdingCount: number
): number {
  let score = 0
  // Returns component (max 40)
  if (pnlPct >= 20)      score += 40
  else if (pnlPct >= 10) score += 30
  else if (pnlPct >= 5)  score += 22
  else if (pnlPct >= 0)  score += 12
  // Diversification (max 30)
  if (segCount >= 4)      score += 30
  else if (segCount >= 3) score += 22
  else if (segCount >= 2) score += 14
  else                    score += 6
  // Breadth (max 30)
  if (holdingCount >= 20)      score += 30
  else if (holdingCount >= 10) score += 22
  else if (holdingCount >= 5)  score += 14
  else                         score += 6
  return Math.min(score, 100)
}

// ── Data fetching ─────────────────────────────────────────────────────────
async function getPortfolioSummary(userId: string) {
  const supabase = await createClient()

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .single()

  if (!portfolio) return null

  const { data: holdings } = await supabase
    .from("holdings")
    .select("*")
    .eq("portfolio_id", portfolio.id)
    .not("instrument_key", "eq", "Total")

  if (!holdings) return null

  const totalInvested = holdings.reduce((s, h) => s + (h.invested_amount || 0), 0)
  const totalPnL      = holdings.reduce((s, h) => s + (h.unrealized_pl   || 0), 0)
  const currentValue  = totalInvested + totalPnL
  const pnlPercent    = totalInvested > 0 ? totalPnL / totalInvested : 0

  // Segment allocation + P&L per segment
  const segments:   Record<string, number> = {}
  const segmentPnL: Record<string, { invested: number; pnl: number }> = {}
  holdings.forEach((h) => {
    if (h.segment) {
      segments[h.segment] = (segments[h.segment] || 0) + (h.invested_amount || 0)
      segmentPnL[h.segment] = segmentPnL[h.segment] || { invested: 0, pnl: 0 }
      segmentPnL[h.segment].invested += h.invested_amount || 0
      segmentPnL[h.segment].pnl     += h.unrealized_pl   || 0
    }
  })

  const segmentReturns = Object.entries(segmentPnL).map(([name, d]) => ({
    name,
    pct: d.invested > 0 ? (d.pnl / d.invested) * 100 : 0,
    pnl: d.pnl,
  }))
  const bestSegment  = [...segmentReturns].sort((a, b) => b.pct - a.pct)[0] ?? null
  const worstSegment = [...segmentReturns].sort((a, b) => a.pct - b.pct)[0] ?? null

  // Concentration
  const activeHoldings = holdings.filter((h) => h.quantity && h.quantity > 0)
  const sortedByValue  = [...activeHoldings].sort((a, b) => (b.invested_amount || 0) - (a.invested_amount || 0))
  const topHolding     = sortedByValue[0]
  const concentrationPct =
    topHolding && totalInvested > 0
      ? ((topHolding.invested_amount || 0) / totalInvested) * 100
      : 0
  const concentrationSymbol: string =
    ((topHolding?.raw as Record<string, unknown>)?.trading_symbol as string | undefined) ||
    topHolding?.instrument_key ||
    "—"

  const topGainers = [...activeHoldings]
    .filter((h) => h.unrealized_pl)
    .sort((a, b) => (b.unrealized_pl || 0) - (a.unrealized_pl || 0))
    .slice(0, 5)

  const topLosers = [...activeHoldings]
    .filter((h) => h.unrealized_pl)
    .sort((a, b) => (a.unrealized_pl || 0) - (b.unrealized_pl || 0))
    .slice(0, 5)

  const count        = activeHoldings.length
  const segCount     = Object.keys(segments).length
  const healthScore  = computeHealthScore(pnlPercent * 100, segCount, count)

  return {
    totalInvested, totalPnL, currentValue, pnlPercent,
    holdings, segments, topGainers, topLosers,
    count, segCount, healthScore,
    bestSegment, worstSegment,
    concentrationPct, concentrationSymbol,
  }
}

async function getRecentOrders(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("orders")
    .select("id, instrument_key, side, quantity, price, status, meta, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5)
  return data ?? []
}

async function getPortfolioSnapshots(userId: string) {
  const supabase = await createClient()
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  if (!portfolio) return []
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const { data } = await supabase
    .from("portfolio_snapshots")
    .select("snapshot_date, total_invested, total_value, total_pnl, pnl_pct")
    .eq("portfolio_id", portfolio.id)
    .gte("snapshot_date", since.toISOString().slice(0, 10))
    .order("snapshot_date", { ascending: true })
  return data ?? []
}

// ── Segment gradient palette ──────────────────────────────────────────────
const SEG_GRADIENTS = [
  "from-violet-500 to-purple-400",
  "from-sky-500 to-blue-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-pink-400",
  "from-cyan-500 to-blue-400",
]

const ORDER_STATUS_STYLE: Record<string, string> = {
  PLACED:   "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  FAILED:   "bg-red-400/10    text-red-400    border-red-400/20",
  REJECTED: "bg-red-400/10    text-red-400    border-red-400/20",
  PENDING:  "bg-amber-400/10  text-amber-400  border-amber-400/20",
}

// ── Page ──────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const summary      = await getPortfolioSummary(user.id)
  const recentOrders = await getRecentOrders(user.id)
  const snapshots    = await getPortfolioSnapshots(user.id).catch(() => [])

  const { data: lastSyncRow } = await supabase
    .from("holdings")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single()
  const lastSynced = lastSyncRow?.updated_at ?? null
  const userName   = user.email?.split("@")[0] ?? "Investor"

  return (
    <div className="space-y-5">

      {/* ── Hero: greeting + health score + quick actions ─────────── */}
      <DashboardHero name={userName} score={summary?.healthScore ?? 0} />

      {/* ── Sync control ─────────────────────────────────────────── */}
      <div className="flex items-center justify-end">
        <SyncBar lastSynced={lastSynced} />
      </div>

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!summary ? (
        <Card className="card-elevated">
          <CardContent className="py-14 text-center space-y-2">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">No portfolio data yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Go to Settings → Connection to link your Upstox account and import your first holdings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── KPI Strip ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Invested */}
            <Card className="kpi-card card-elevated transition-all duration-300 hover:glow-sm">
              <CardContent className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Briefcase className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                    INVESTED
                  </span>
                </div>
                <div className="text-xl font-bold tabular-nums tracking-tight">
                  {formatCurrency(summary.totalInvested)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{summary.count} active stocks</p>
              </CardContent>
            </Card>

            {/* Current Value */}
            <Card className={`kpi-card card-elevated transition-all duration-300 hover:glow-sm ${summary.totalPnL >= 0 ? "kpi-card-green" : "kpi-card-red"}`}>
              <CardContent className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-9 w-9 rounded-xl border flex items-center justify-center ${summary.totalPnL >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                    <Activity className={`h-4 w-4 ${summary.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`} />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                    CURRENT
                  </span>
                </div>
                <div className={`text-xl font-bold tabular-nums tracking-tight ${summary.totalPnL >= 0 ? "gradient-text-success" : "text-red-400"}`}>
                  {formatCurrency(summary.currentValue)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Market value</p>
              </CardContent>
            </Card>

            {/* Unrealised P&L */}
            <Card className={`kpi-card card-elevated transition-all duration-300 hover:glow-sm ${summary.totalPnL >= 0 ? "kpi-card-green" : "kpi-card-red"}`}>
              <CardContent className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`h-9 w-9 rounded-xl border flex items-center justify-center ${summary.totalPnL >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                    {summary.totalPnL >= 0
                      ? <ArrowUpRight   className="h-4 w-4 text-emerald-400" />
                      : <ArrowDownRight  className="h-4 w-4 text-red-400" />}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                    P&amp;L
                  </span>
                </div>
                <div className={`text-xl font-bold tabular-nums ${summary.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {summary.totalPnL >= 0 ? "+" : ""}{formatCurrency(summary.totalPnL)}
                </div>
                <p className={`text-xs font-semibold mt-0.5 ${summary.pnlPercent >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
                  {summary.pnlPercent >= 0 ? "▲ " : "▼ "}
                  {Math.abs(summary.pnlPercent * 100).toFixed(2)}% overall
                </p>
              </CardContent>
            </Card>

            {/* Diversification */}
            <Card className="kpi-card card-elevated transition-all duration-300 hover:glow-sm">
              <CardContent className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-sky-400" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                    SPREAD
                  </span>
                </div>
                <div className="text-xl font-bold tabular-nums">{summary.segCount}</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {summary.segCount >= 3 ? "Well diversified" : summary.segCount === 2 ? "Moderate spread" : "Concentrated"}
                  {" · "}{summary.count} stocks
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Insights Strip ───────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* Best segment */}
            {summary.bestSegment ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/60">
                    Best Segment
                  </p>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {summary.bestSegment.name}
                  </p>
                  <p className="text-xs text-emerald-400 font-semibold">
                    {summary.bestSegment.pct >= 0 ? "+" : ""}{summary.bestSegment.pct.toFixed(1)}% return
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-violet-500/15 bg-violet-500/[0.06] px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-violet-400/60">Net P&amp;L</p>
                  <p className="text-sm font-semibold">{formatCurrency(Math.abs(summary.totalPnL))}</p>
                  <p className="text-xs text-muted-foreground">unrealised</p>
                </div>
              </div>
            )}

            {/* Concentration */}
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
              summary.concentrationPct > 20
                ? "border-amber-500/20 bg-amber-500/[0.06]"
                : "border-sky-500/15 bg-sky-500/[0.06]"
            }`}>
              <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
                summary.concentrationPct > 20
                  ? "bg-amber-500/15 border-amber-500/20"
                  : "bg-sky-500/15 border-sky-500/20"
              }`}>
                {summary.concentrationPct > 20
                  ? <AlertTriangle className="h-4 w-4 text-amber-400" />
                  : <ShieldCheck   className="h-4 w-4 text-sky-400" />
                }
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] font-mono uppercase tracking-widest ${
                  summary.concentrationPct > 20 ? "text-amber-400/60" : "text-sky-400/60"
                }`}>
                  Top Holding
                </p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {summary.concentrationSymbol}
                </p>
                <p className={`text-xs font-semibold ${
                  summary.concentrationPct > 20 ? "text-amber-400" : "text-sky-400"
                }`}>
                  {summary.concentrationPct.toFixed(1)}% of portfolio
                  {summary.concentrationPct > 20 ? " · High" : ""}
                </p>
              </div>
            </div>

            {/* Worst segment (or net P&L fallback) */}
            {summary.worstSegment && summary.worstSegment.name !== summary.bestSegment?.name ? (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-red-400/60">
                    Weak Segment
                  </p>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {summary.worstSegment.name}
                  </p>
                  <p className="text-xs text-red-400 font-semibold">
                    {summary.worstSegment.pct.toFixed(1)}% return
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-violet-500/15 bg-violet-500/[0.06] px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Target className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-violet-400/60">
                    Net Return
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(Math.abs(summary.totalPnL))}
                  </p>
                  <p className={`text-xs font-semibold ${summary.pnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {summary.pnlPercent >= 0 ? "Unrealised gain" : "Unrealised loss"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Portfolio Charts (area + donut + bar) ─────────────── */}
          <Suspense
            fallback={
              <div className="grid lg:grid-cols-2 gap-5">
                <div className="h-[300px] rounded-xl bg-muted/40 animate-pulse" />
                <div className="h-[300px] rounded-xl bg-muted/40 animate-pulse" />
              </div>
            }
          >
            <PortfolioCharts
              segments={summary.segments}
              totalInvested={summary.totalInvested}
              topGainers={summary.topGainers}
              topLosers={summary.topLosers}
              snapshots={snapshots as SnapshotEntry[]}
            />
          </Suspense>

          {/* ── Movers + Allocation ───────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Top Gainers */}
            <Card className="card-elevated">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                  </div>
                  Top Gainers
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                  {summary.topGainers.map((h) => {
                    const inv    = (h as Record<string, unknown>).invested_amount as number | null
                    const pnlPct = inv && inv > 0 ? ((h.unrealized_pl || 0) / inv) * 100 : 0
                    const sym    = ((h.raw as Record<string, unknown>)?.trading_symbol as string) || h.instrument_key
                    return (
                      <div key={h.instrument_key} className="flex items-center gap-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{sym}</p>
                          <div className="mt-1 h-1 rounded-full overflow-hidden bg-emerald-500/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                              style={{ width: `${Math.min(Math.abs(pnlPct) * 2, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-emerald-400">
                            +{formatCurrency(h.unrealized_pl || 0)}
                          </p>
                          <p className="text-[10px] text-emerald-400/60">+{pnlPct.toFixed(1)}%</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Top Losers */}
            <Card className="card-elevated">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  </div>
                  Top Losers
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                  {summary.topLosers.map((h) => {
                    const inv    = (h as Record<string, unknown>).invested_amount as number | null
                    const pnlPct = inv && inv > 0 ? ((h.unrealized_pl || 0) / inv) * 100 : 0
                    const sym    = ((h.raw as Record<string, unknown>)?.trading_symbol as string) || h.instrument_key
                    return (
                      <div key={h.instrument_key} className="flex items-center gap-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{sym}</p>
                          <div className="mt-1 h-1 rounded-full overflow-hidden bg-red-500/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400"
                              style={{ width: `${Math.min(Math.abs(pnlPct) * 2, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-red-400">
                            {formatCurrency(h.unrealized_pl || 0)}
                          </p>
                          <p className="text-[10px] text-red-400/60">{pnlPct.toFixed(1)}%</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Segment Allocation */}
            <Card className="card-elevated">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Layers className="h-3 w-3 text-violet-400" />
                  </div>
                  Allocation
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-3">
                  {Object.entries(summary.segments)
                    .sort(([, a], [, b]) => b - a)
                    .map(([seg, amount], i) => {
                      const pct = (amount / summary.totalInvested) * 100
                      return (
                        <div key={seg}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-foreground">{seg}</span>
                            <span className="text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${SEG_GRADIENTS[i % SEG_GRADIENTS.length]} transition-all duration-700`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── Recent Activity ───────────────────────────────────────── */}
      <Card className="card-elevated">
        <CardHeader className="pb-3 px-5 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Activity className="h-3 w-3 text-primary" />
              </div>
              Recent Activity
            </CardTitle>
            <p className="text-xs text-muted-foreground">Last 5 orders</p>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {recentOrders.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <div className="h-10 w-10 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto">
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No orders yet.</p>
              <p className="text-xs text-muted-foreground">Head to Trade to place your first order.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentOrders.map((order) => {
                const sym   = (order.meta as Record<string, string>)?.trading_symbol || order.instrument_key
                const isBuy = order.side === "BUY"
                const total = order.price && order.quantity
                  ? Number(order.price) * Number(order.quantity)
                  : null
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold border ${
                        isBuy
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/10    text-red-400    border-red-500/20"
                      }`}>
                        {order.side[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{sym}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {order.quantity} shares
                          {order.price ? ` @ ₹${Number(order.price).toFixed(2)}` : ""}
                          {total ? ` · ₹${total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        ORDER_STATUS_STYLE[order.status] ?? "bg-muted/50 text-muted-foreground border-transparent"
                      }`}>
                        {order.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
