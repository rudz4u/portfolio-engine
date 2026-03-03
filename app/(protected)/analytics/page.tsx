"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, PieChart as PieIcon, BarChart2, Activity, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectorCorrelationHeatmap } from "./sector-correlation"

/* ─── palette ──────────────────────────────────────────────── */
const COLORS = [
  "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#3b82f6", "#ec4899", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6", "#a855f7", "#e11d48",
]

/* ─── types ─────────────────────────────────────────────────── */
interface HoldingRow {
  segment: string | null
  invested_amount: number | null
  unrealized_pl: number | null
  ltp: number | null
  quantity: number | null
  instrument_key: string
  raw: Record<string, unknown> | null
}

interface SegmentAlloc {
  name: string
  invested: number
  pnl: number
  percent: number
}

interface HoldingPnL {
  symbol: string
  pl_value: number
  pl_pct: number
  invested: number
}

/* ─── formatters ─────────────────────────────────────────────── */
const fmtCr = (n: number) => {
  if (Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

/* ─── custom tooltip ──────────────────────────────────────────── */
function DarkTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur px-3 py-2 shadow-xl text-xs space-y-1">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color || "#8b5cf6" }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{fmtCr(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function PctTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? 0
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className={v >= 0 ? "text-emerald-400" : "text-red-400"}>
        {v >= 0 ? "+" : ""}{v.toFixed(2)}%
      </p>
    </div>
  )
}

/* ─── page ───────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [rows, setRows] = useState<HoldingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: portfolios } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)

      if (!portfolios?.length) { setLoading(false); return }

      const { data } = await supabase
        .from("holdings")
        .select("segment, invested_amount, unrealized_pl, ltp, quantity, instrument_key, raw")
        .eq("portfolio_id", portfolios[0].id)

      setRows(data ?? [])
      setLoading(false)
    }
    load()
  }, [refreshKey])

  /* ── derived data ─────────────────────────────────────────── */
  const segmentAlloc = useMemo<SegmentAlloc[]>(() => {
    const map: Record<string, { invested: number; pnl: number }> = {}
    for (const r of rows) {
      const seg = r.segment || "Others"
      if (!map[seg]) map[seg] = { invested: 0, pnl: 0 }
      map[seg].invested += Number(r.invested_amount) || 0
      map[seg].pnl += Number(r.unrealized_pl) || 0
    }
    const totalInvested = Object.values(map).reduce((s, v) => s + v.invested, 0)
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        invested: v.invested,
        pnl: v.pnl,
        percent: totalInvested > 0 ? (v.invested / totalInvested) * 100 : 0,
      }))
      .sort((a, b) => b.invested - a.invested)
  }, [rows])

  const holdingPnL = useMemo<HoldingPnL[]>(() => {
    return rows.map((r) => {
      const raw = r.raw as Record<string, string> || {}
      const invested = Number(r.invested_amount) || 0
      const pl = Number(r.unrealized_pl) || 0
      return {
        symbol: raw.trading_symbol || r.instrument_key?.split("|").pop() || r.instrument_key,
        pl_value: pl,
        pl_pct: invested > 0 ? (pl / invested) * 100 : 0,
        invested,
      }
    })
  }, [rows])

  const top10Gainers = useMemo(
    () => holdingPnL.filter((h) => h.pl_value > 0).sort((a, b) => b.pl_value - a.pl_value).slice(0, 10),
    [holdingPnL]
  )
  const top10Losers = useMemo(
    () => holdingPnL.filter((h) => h.pl_value < 0).sort((a, b) => a.pl_value - b.pl_value).slice(0, 10),
    [holdingPnL]
  )
  const top20ByPct = useMemo(
    () =>
      holdingPnL
        .filter((h) => h.invested > 1000)
        .sort((a, b) => b.pl_pct - a.pl_pct)
        .slice(0, 10)
        .concat(
          holdingPnL
            .filter((h) => h.invested > 1000)
            .sort((a, b) => a.pl_pct - b.pl_pct)
            .slice(0, 5)
        )
        .filter((v, i, a) => a.findIndex((x) => x.symbol === v.symbol) === i),
    [holdingPnL]
  )

  const riskMetrics = useMemo(() => {
    if (holdingPnL.length === 0) return null
    const pcts = holdingPnL.map((h) => h.pl_pct)
    const n = pcts.length
    const mean = pcts.reduce((s, v) => s + v, 0) / n
    const variance = pcts.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    const stdDev = Math.sqrt(variance)
    const sharpeProxy = stdDev > 0 ? mean / stdDev : 0

    const totalInv = holdingPnL.reduce((s, h) => s + h.invested, 0)
    const hhi = totalInv > 0
      ? holdingPnL.reduce((s, h) => s + (h.invested / totalInv) ** 2, 0)
      : 0

    const winners = holdingPnL.filter((h) => h.pl_value > 0)
    const winRate = n > 0 ? (winners.length / n) * 100 : 0

    const best = holdingPnL.reduce((a, b) => b.pl_pct > a.pl_pct ? b : a, holdingPnL[0])
    const worst = holdingPnL.reduce((a, b) => b.pl_pct < a.pl_pct ? b : a, holdingPnL[0])

    return { sharpeProxy, hhi, winRate, winners: winners.length, total: n, best, worst, mean, stdDev }
  }, [holdingPnL])

  /* ── sector concentration (within-segment HHI) ────────── */
  const segmentConcentration = useMemo(() => {
    const map = new Map<string, { stocks: Array<{ symbol: string; invested: number }>; total: number }>()
    for (const r of rows) {
      const seg = r.segment ?? "Others"
      const raw = (r.raw as Record<string, string>) ?? {}
      const symbol =
        raw.trading_symbol ??
        r.instrument_key?.split("|").pop() ??
        r.instrument_key
      const invested = Number(r.invested_amount) || 0
      if (!map.has(seg)) map.set(seg, { stocks: [], total: 0 })
      const entry = map.get(seg)!
      entry.stocks.push({ symbol, invested })
      entry.total += invested
    }

    const portfolioTotal = rows.reduce(
      (s, r) => s + (Number(r.invested_amount) || 0),
      0,
    )

    return Array.from(map.entries())
      .map(([segment, data]) => {
        // HHI = 1 if one stock dominates; approaches 1/N for equal weights
        const withinHHI =
          data.total > 0
            ? data.stocks.reduce(
                (s, st) => s + (st.invested / data.total) ** 2,
                0,
              )
            : 0
        const topStock = [...data.stocks].sort((a, b) => b.invested - a.invested)[0]
        return {
          segment,
          count: data.stocks.length,
          invested: data.total,
          portfolioWeight:
            portfolioTotal > 0 ? (data.total / portfolioTotal) * 100 : 0,
          withinHHI,
          topStock: topStock?.symbol ?? "",
          topStockPct:
            data.total > 0 && topStock
              ? (topStock.invested / data.total) * 100
              : 0,
        }
      })
      .sort((a, b) => b.invested - a.invested)
  }, [rows])

  const totalInvested = rows.reduce((s, r) => s + (Number(r.invested_amount) || 0), 0)
  const totalPnL = rows.reduce((s, r) => s + (Number(r.unrealized_pl) || 0), 0)
  const currentValue = totalInvested + totalPnL
  const pnlPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

  /* ── kpi summary ─────────────────────────────────────────── */
  const kpis = [
    {
      label: "Total Invested",
      value: fmtCr(totalInvested),
      icon: <BarChart2 className="h-4 w-4" />,
      color: "text-foreground",
    },
    {
      label: "Current Value",
      value: fmtCr(currentValue),
      icon: <Activity className="h-4 w-4" />,
      color: currentValue >= totalInvested ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "Unrealised P&L",
      value: `${totalPnL >= 0 ? "+" : ""}${fmtCr(totalPnL)}`,
      icon: totalPnL >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
      color: totalPnL >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "Return",
      value: `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`,
      icon: <PieIcon className="h-4 w-4" />,
      color: pnlPct >= 0 ? "text-emerald-400" : "text-red-400",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Analytics</h1>
          <p className="text-muted-foreground mt-0.5">{rows.length} holdings across {segmentAlloc.length} segments</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))
          : kpis.map((k) => (
              <Card key={k.label} className="card-elevated">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    {k.icon}
                    <span className="text-xs">{k.label}</span>
                  </div>
                  <p className={`text-xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Two-column row: Segment donut + Segment P&L bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Segment Allocation donut */}
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" /> Segment Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-60 w-full rounded-lg" />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={segmentAlloc}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="invested"
                      nameKey="name"
                    >
                      {segmentAlloc.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as SegmentAlloc
                        return (
                          <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur px-3 py-2 shadow-xl text-xs">
                            <p className="font-semibold mb-1">{d.name}</p>
                            <p className="text-muted-foreground">Invested: <span className="text-foreground font-medium">{fmtCr(d.invested)}</span></p>
                            <p className="text-muted-foreground">Share: <span className="text-foreground font-medium">{d.percent.toFixed(1)}%</span></p>
                            <p className={d.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                              P&L: {d.pnl >= 0 ? "+" : ""}{fmtCr(d.pnl)}
                            </p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  {segmentAlloc.slice(0, 8).map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-muted-foreground flex-1">{s.name}</span>
                      <span className="font-medium tabular-nums">{s.percent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Segment P&L bar */}
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" /> P&amp;L by Segment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-60 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={segmentAlloc}
                  margin={{ top: 0, right: 10, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    type="number"
                    tickFormatter={fmtCr}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={85}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" />
                  <Bar dataKey="pnl" name="P&L" radius={[0, 4, 4, 0]}>
                    {segmentAlloc.map((s, i) => (
                      <Cell key={i} fill={s.pnl >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top gainers + losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top 10 gainers */}
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Top Gainers
              <Badge variant="secondary" className="ml-auto text-xs">{top10Gainers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : top10Gainers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No positive P&L holdings</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, top10Gainers.length * 28)}>
                <BarChart
                  layout="vertical"
                  data={top10Gainers}
                  margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    type="number"
                    tickFormatter={fmtCr}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    width={72}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="pl_value" name="P&L" fill="#10b981" fillOpacity={0.85} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 10 losers */}
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              Top Losers
              <Badge variant="secondary" className="ml-auto text-xs">{top10Losers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : top10Losers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No losing holdings</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, top10Losers.length * 28)}>
                <BarChart
                  layout="vertical"
                  data={top10Losers}
                  margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    type="number"
                    tickFormatter={fmtCr}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    width={72}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="pl_value" name="P&L" fill="#ef4444" fillOpacity={0.85} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>

      {/* P&L % leaderboard */}
      <Card className="card-elevated">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Return % — Best &amp; Worst Performers
            <span className="text-xs font-normal text-muted-foreground ml-1">(holdings &gt; ₹1K invested)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, top20ByPct.length * 30)}>
              <BarChart
                layout="vertical"
                data={top20ByPct}
                margin={{ top: 0, right: 50, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="symbol"
                  width={72}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<PctTooltip />} />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} />
                <Bar dataKey="pl_pct" name="Return %" radius={[0, 4, 4, 0]}>
                  {top20ByPct.map((h, i) => (
                    <Cell key={i} fill={h.pl_pct >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Segment table summary */}
      <Card className="card-elevated">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" /> Segment Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Segment</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Invested</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Allocation</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">P&amp;L</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentAlloc.map((s, i) => {
                    const returnPct = s.invested > 0 ? (s.pnl / s.invested) * 100 : 0
                    return (
                      <tr key={s.name} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          {s.name}
                        </td>
                        <td className="text-right py-2.5 tabular-nums">{fmtCr(s.invested)}</td>
                        <td className="text-right py-2.5 tabular-nums">{s.percent.toFixed(1)}%</td>
                        <td className={`text-right py-2.5 tabular-nums ${s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {s.pnl >= 0 ? "+" : ""}{fmtCr(s.pnl)}
                        </td>
                        <td className={`text-right py-2.5 tabular-nums font-medium ${returnPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/50 font-semibold">
                    <td className="py-2.5">Total</td>
                    <td className="text-right py-2.5 tabular-nums">{fmtCr(totalInvested)}</td>
                    <td className="text-right py-2.5">100%</td>
                    <td className={`text-right py-2.5 tabular-nums ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalPnL >= 0 ? "+" : ""}{fmtCr(totalPnL)}
                    </td>
                    <td className={`text-right py-2.5 tabular-nums ${pnlPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk & Concentration Metrics */}
      {/* Sector Concentration Card */}
      {!loading && segmentConcentration.length > 0 && (
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" /> Sector Concentration
              <span className="text-xs font-normal text-muted-foreground ml-1">
                (within-segment HHI — lower is more distributed)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Segment</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Stocks</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Weight</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">HHI</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Concentration</th>
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium pl-4">Top Holding</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentConcentration.map((s) => (
                    <tr
                      key={s.segment}
                      className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-2.5 font-medium">{s.segment}</td>
                      <td className="text-right py-2.5 tabular-nums">{s.count}</td>
                      <td className="text-right py-2.5 tabular-nums">
                        {s.portfolioWeight.toFixed(1)}%
                      </td>
                      <td className="text-right py-2.5 tabular-nums">
                        <span
                          className={`font-semibold ${
                            s.withinHHI > 0.5
                              ? "text-red-400"
                              : s.withinHHI > 0.25
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {s.withinHHI.toFixed(3)}
                        </span>
                      </td>
                      <td className="text-right py-2.5">
                        <Badge
                          variant="secondary"
                          className={`text-xs px-1.5 py-0 ${
                            s.withinHHI > 0.5
                              ? "bg-red-500/10 text-red-400"
                              : s.withinHHI > 0.25
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-emerald-500/10 text-emerald-400"
                          }`}
                        >
                          {s.withinHHI > 0.5
                            ? "Concentrated"
                            : s.withinHHI > 0.25
                            ? "Moderate"
                            : "Distributed"}
                        </Badge>
                      </td>
                      <td className="py-2.5 pl-4 text-muted-foreground text-xs">
                        {s.topStock}
                        <span className="ml-1 text-foreground font-medium">
                          ({s.topStockPct.toFixed(0)}%)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && riskMetrics && (
        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Risk &amp; Concentration Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">

              {/* Cross-sectional Sharpe proxy */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Cross-sect. Sharpe</p>
                <p className={`text-xl font-bold tabular-nums ${riskMetrics.sharpeProxy >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {riskMetrics.sharpeProxy.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  μ={riskMetrics.mean.toFixed(1)}% σ={riskMetrics.stdDev.toFixed(1)}%
                </p>
              </div>

              {/* HHI Concentration */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">HHI Concentration</p>
                <p className={`text-xl font-bold tabular-nums ${
                  riskMetrics.hhi < 0.1 ? "text-emerald-400"
                  : riskMetrics.hhi < 0.18 ? "text-amber-400"
                  : "text-red-400"
                }`}>
                  {riskMetrics.hhi.toFixed(3)}
                </p>
                <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${
                  riskMetrics.hhi < 0.1 ? "bg-emerald-500/10 text-emerald-400"
                  : riskMetrics.hhi < 0.18 ? "bg-amber-500/10 text-amber-400"
                  : "bg-red-500/10 text-red-400"
                }`}>
                  {riskMetrics.hhi < 0.1 ? "Well Diversified" : riskMetrics.hhi < 0.18 ? "Moderate" : "Concentrated"}
                </Badge>
              </div>

              {/* Win Rate */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className={`text-xl font-bold tabular-nums ${riskMetrics.winRate >= 50 ? "text-emerald-400" : "text-amber-400"}`}>
                  {riskMetrics.winRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {riskMetrics.winners}/{riskMetrics.total} positive
                </p>
              </div>

              {/* Best performer */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Best Return</p>
                <p className="text-xl font-bold tabular-nums text-emerald-400">
                  +{riskMetrics.best.pl_pct.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground truncate">{riskMetrics.best.symbol}</p>
              </div>

              {/* Worst performer */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Worst Return</p>
                <p className="text-xl font-bold tabular-nums text-red-400">
                  {riskMetrics.worst.pl_pct.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground truncate">{riskMetrics.worst.symbol}</p>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sector Correlation Matrix ──────────────────── */}
      {segmentAlloc.length >= 2 && (
        <SectorCorrelationHeatmap segments={segmentAlloc.map((s) => s.name)} />
      )}
    </div>
  )
}
