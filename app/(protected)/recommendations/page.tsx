"use client"

import { useEffect, useState, useCallback } from "react"
import { TrendingUp, TrendingDown, RefreshCw, Info, BarChart2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface ScoredHolding {
  instrument_key: string
  trading_symbol: string
  name: string
  quantity: number
  avg_price: number
  ltp: number
  invested_amount: number
  unrealized_pl: number
  pnl_pct: number
  weight_pct: number
  score: number
  signal: "BUY" | "HOLD" | "SELL" | "WATCH"
  signal_reason: string
  momentum_score: number
  valuation_score: number
  position_score: number
  segment: string
}

interface Summary {
  avgScore: number
  bySignal: { BUY: number; HOLD: number; SELL: number; WATCH: number }
  total: number
}

const SIGNAL_STYLES: Record<string, string> = {
  BUY: "bg-green-100 text-green-800 border-green-200",
  HOLD: "bg-blue-100 text-blue-800 border-blue-200",
  SELL: "bg-red-100 text-red-800 border-red-200",
  WATCH: "bg-yellow-100 text-yellow-800 border-yellow-200",
}

const SIGNAL_FILTER_BUTTONS = ["All", "BUY", "HOLD", "SELL", "WATCH"] as const
type FilterType = (typeof SIGNAL_FILTER_BUTTONS)[number]

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right">{value}</span>
    </div>
  )
}

export default function RecommendationsPage() {
  const [data, setData] = useState<{ scored: ScoredHolding[]; summary: Summary } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>("All")
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/analysis/score")
      if (!res.ok) throw new Error("Failed to compute scores")
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch (err) {
      setError("Failed to load recommendations. Make sure you have holdings synced.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = data?.scored.filter((h) => filter === "All" || h.signal === filter) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recommendations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-powered signals computed from your portfolio data
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Computing..." : "Refresh"}
        </Button>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground">Portfolio Score</div>
              <div className="text-2xl font-bold mt-1">{data.summary.avgScore}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
            </CardContent>
          </Card>
          {(["BUY", "HOLD", "SELL", "WATCH"] as const).map((sig) => (
            <Card
              key={sig}
              className={`cursor-pointer transition-all ${filter === sig ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilter(filter === sig ? "All" : sig)}
            >
              <CardContent className="pt-4 pb-3 px-4">
                <div className="text-xs text-muted-foreground">{sig}</div>
                <div className="text-2xl font-bold mt-1">{data.summary.bySignal[sig]}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {SIGNAL_FILTER_BUTTONS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-sm rounded-full border transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
            {f !== "All" && data ? ` (${data.summary.bySignal[f]})` : ""}
          </button>
        ))}
        {lastRefresh && (
          <span className="ml-auto text-xs text-muted-foreground self-center">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Holdings grid */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              No holdings match this filter.
            </div>
          )}
          {filtered.map((h) => {
            const pnlPositive = h.unrealized_pl >= 0
            return (
              <div
                key={h.instrument_key}
                className="rounded-xl border bg-card p-4 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{h.trading_symbol}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${SIGNAL_STYLES[h.signal]}`}
                      >
                        {h.signal}
                      </span>
                      {h.segment && (
                        <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">
                          {h.segment}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{h.name}</p>
                    <p className="text-xs text-muted-foreground/80 mt-1 italic">
                      {h.signal_reason}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      {pnlPositive ? (
                        <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <span
                        className={`text-sm font-semibold ${pnlPositive ? "text-green-600" : "text-red-500"}`}
                      >
                        {pnlPositive ? "+" : ""}
                        {h.pnl_pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ₹{h.ltp?.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total Score</div>
                    <div className="text-lg font-bold">{h.score}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Momentum</div>
                    <ScoreBar value={h.momentum_score} max={40} color="bg-blue-500" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Valuation</div>
                    <ScoreBar value={h.valuation_score} max={30} color="bg-purple-500" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Sizing</div>
                    <ScoreBar value={h.position_score} max={30} color="bg-green-500" />
                  </div>
                </div>

                {/* Weight + qty */}
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{h.quantity} shares</span>
                  <span>Avg ₹{h.avg_price?.toFixed(2)}</span>
                  <span>Weight {h.weight_pct?.toFixed(1)}%</span>
                  <span>Invested ₹{(h.invested_amount / 1000).toFixed(1)}k</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
