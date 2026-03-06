"use client"

import { useEffect, useState, useCallback } from "react"
import { TrendingUp, TrendingDown, RefreshCw, BarChart2, ExternalLink, Newspaper, ChevronDown, ChevronUp, Zap } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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
  advisory_score: number
  rsi_approx: number
  technical_signal: "oversold" | "neutral" | "overbought"
  macd_trend: "bullish" | "bearish" | "neutral"
  segment: string
}

type ConsensusSignal = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"

interface AdvisoryConsensus {
  trading_symbol: string
  buy_count: number
  sell_count: number
  hold_count: number
  neutral_count: number
  total_sources: number
  weighted_score: number
  advisory_score: number
  consensus_signal: ConsensusSignal
}

interface SourceSignal {
  source_name: string
  signal: string
  target_price: number | null
  tier: number
  website_url?: string | null
}

interface Summary {
  avgScore: number
  bySignal: { BUY: number; HOLD: number; SELL: number; WATCH: number }
  total: number
}

const CONSENSUS_STYLES: Record<ConsensusSignal, string> = {
  STRONG_BUY: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  BUY:        "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  HOLD:       "bg-blue-400/15 text-blue-400 border-blue-400/30",
  SELL:       "bg-red-400/10 text-red-300 border-red-400/20",
  STRONG_SELL:"bg-red-400/15 text-red-400 border-red-400/30",
}

const SIGNAL_STYLES: Record<string, string> = {
  BUY:  "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  HOLD: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  SELL: "bg-red-400/15 text-red-400 border-red-400/30",
  WATCH:"bg-amber-400/15 text-amber-400 border-amber-400/30",
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

function advisorLogoUrl(websiteUrl?: string | null): string | null {
  if (!websiteUrl) return null
  try {
    const domain = new URL(websiteUrl).hostname
    return `https://www.google.com/s2/favicons?sz=32&domain=${domain}`
  } catch {
    return null
  }
}

export default function RecommendationsPage() {
  const [data, setData] = useState<{ scored: ScoredHolding[]; summary: Summary } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>("All")
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [expandedResearch, setExpandedResearch] = useState<string | null>(null)
  const [researchData, setResearchData] = useState<Record<string, { answer: string | null; results: {title: string; url: string; snippet?: string}[] } | null>>({})
  const [researchLoading, setResearchLoading] = useState<string | null>(null)
  const [consensusMap, setConsensusMap] = useState<Record<string, AdvisoryConsensus>>({})
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, SourceSignal[]>>({})
  const [scanUsage, setScanUsage] = useState<{ remaining: number; used: number; max: number } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [scoreRes, consensusRes] = await Promise.all([
        fetch("/api/analysis/score"),
        fetch("/api/advisory/consensus"),
      ])
      if (!scoreRes.ok) throw new Error("Failed to compute scores")
      const json = await scoreRes.json()
      setData(json)
      setLastRefresh(new Date())
      if (consensusRes.ok) {
        const cjson = await consensusRes.json()
        const map: Record<string, AdvisoryConsensus> = {}
        for (const c of cjson.consensus ?? []) map[c.trading_symbol] = c
        setConsensusMap(map)
        setSourceBreakdown(cjson.sourceBreakdown ?? {})
      }
    } catch (err) {
      setError("Failed to load recommendations. Make sure you have holdings synced.")
    } finally {
      setLoading(false)
    }
  }, [])

  /** Load the daily scan trigger usage (how many of 4 have been used today) */
  const loadScanUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/advisory/trigger")
      if (res.ok) setScanUsage(await res.json())
    } catch { /* non-critical */ }
  }, [])

  /** Manually trigger the advisory scan pipeline */
  const triggerScan = useCallback(async () => {
    if (scanning || (scanUsage && scanUsage.remaining <= 0)) return
    setScanning(true)
    setScanMsg(null)
    try {
      const res = await fetch("/api/advisory/trigger", { method: "POST" })
      const json = await res.json()
      if (res.status === 429) {
        setScanMsg({ ok: false, text: "Daily limit of 4 manual scans reached." })
      } else if (!res.ok || !json.ok) {
        setScanMsg({ ok: false, text: json.error || "Scan failed." })
      } else {
        setScanMsg({
          ok: true,
          text: `Scan complete — ${json.scan?.recs_resolved ?? 0} recommendations resolved across ${json.scan?.sources_scraped ?? 0} sources.`,
        })
        setScanUsage({ remaining: json.remaining, used: json.used, max: json.max })
        // Reload scores to reflect new advisory data
        await load()
      }
    } catch {
      setScanMsg({ ok: false, text: "Network error during scan." })
    } finally {
      setScanning(false)
    }
  }, [scanning, scanUsage, load])

  const loadResearch = useCallback(async (symbol: string) => {
    if (expandedResearch === symbol) { setExpandedResearch(null); return }
    setExpandedResearch(symbol)
    if (researchData[symbol]) return // already cached
    setResearchLoading(symbol)
    try {
      const res = await fetch(`/api/research/news?symbol=${encodeURIComponent(symbol)}`)
      const json = await res.json()
      setResearchData((prev) => ({ ...prev, [symbol]: json }))
    } catch {
      setResearchData((prev) => ({ ...prev, [symbol]: null }))
    } finally {
      setResearchLoading(null)
    }
  }, [expandedResearch, researchData])

  useEffect(() => {
    load()
    loadScanUsage()
  }, [load, loadScanUsage])

  const filtered = data?.scored.filter((h) => filter === "All" || h.signal === filter) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recommendations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI-powered signals computed from your portfolio data
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Manual advisory scan trigger — max 4x per day */}
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={triggerScan}
              disabled={scanning || (scanUsage !== null && scanUsage.remaining <= 0)}
              title={scanUsage ? `${scanUsage.remaining} of ${scanUsage.max} manual scans remaining today` : "Scan advisory sources"}
            >
              <Zap className={`w-4 h-4 mr-2 ${scanning ? "animate-pulse text-amber-400" : "text-amber-400"}`} />
              {scanning ? "Scanning…" : "Scan Advisors"}
              {scanUsage !== null && (
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  scanUsage.remaining === 0
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-400/20 text-amber-400"
                }`}>
                  {scanUsage.remaining}/{scanUsage.max}
                </span>
              )}
            </Button>
            {/* Scan result feedback */}
            {scanMsg && (
              <span className={`text-[10px] max-w-[220px] text-right leading-tight ${
                scanMsg.ok ? "text-emerald-400" : "text-destructive"
              }`}>
                {scanMsg.text}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Computing…" : "Refresh"}
          </Button>
        </div>
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
          <Card className="card-elevated kpi-card">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground">Portfolio Score</div>
              <div className="text-2xl font-bold mt-1 gradient-text">{data.summary.avgScore}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
            </CardContent>
          </Card>
          {(["BUY", "HOLD", "SELL", "WATCH"] as const).map((sig) => (
            <Card
              key={sig}
              className={`card-elevated cursor-pointer transition-all ${filter === sig ? "ring-1 ring-primary glow-sm" : "hover:border-primary/30"}`}
              onClick={() => setFilter(filter === sig ? "All" : sig)}
            >
              <CardContent className="pt-4 pb-3 px-4">
                <div className={`text-xs font-medium ${SIGNAL_STYLES[sig].split(" ")[1]}`}>{sig}</div>
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

      {/* Advisory empty-state hint */}
      {!loading && !error && (data?.scored.length ?? 0) > 0 && Object.keys(sourceBreakdown).length === 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 flex items-start gap-3 text-sm">
          <span className="text-amber-400 text-lg leading-none mt-0.5">⚡</span>
          <div className="flex-1">
            <p className="font-medium text-amber-400">Advisor signals not yet loaded</p>
            <p className="text-muted-foreground mt-0.5">
              Run a scan to populate the per-advisor logo grid.{" "}
              <button
                onClick={triggerScan}
                disabled={scanning || (scanUsage?.remaining ?? 1) <= 0}
                className="underline hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {scanning ? "Scanning…" : "Scan now"}
              </button>
              {scanUsage && <span className="ml-1 opacity-60">({scanUsage.remaining} of {scanUsage.max} left today)</span>}
            </p>
          </div>
        </div>
      )}

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
                className="card-elevated rounded-xl p-4 hover:border-primary/25 transition-colors"
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
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span
                        className={`text-sm font-semibold ${pnlPositive ? "text-emerald-400" : "text-red-400"}`}
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
                <div className="mt-3 pt-3 border-t grid grid-cols-5 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Total Score</div>
                    <div className="text-lg font-bold">{h.score}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Momentum</div>
                    <ScoreBar value={h.momentum_score} max={30} color="bg-blue-500" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Valuation</div>
                    <ScoreBar value={h.valuation_score} max={25} color="bg-purple-500" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Sizing</div>
                    <ScoreBar value={h.position_score} max={20} color="bg-green-500" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Advisory</div>
                    <ScoreBar
                      value={h.advisory_score ?? 12}
                      max={25}
                      color={
                        (h.advisory_score ?? 12) >= 18 ? "bg-emerald-500" :
                        (h.advisory_score ?? 12) >= 12 ? "bg-amber-500" :
                        "bg-red-500"
                      }
                    />
                  </div>
                </div>

                {/* Technical indicator chips */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    h.technical_signal === "oversold"   ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
                    h.technical_signal === "overbought" ? "bg-red-400/10 text-red-400 border-red-400/30" :
                    "bg-muted text-muted-foreground border-border/50"
                  }`}>
                    RSI≈{h.rsi_approx}&nbsp;·&nbsp;{h.technical_signal}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    h.macd_trend === "bullish" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
                    h.macd_trend === "bearish" ? "bg-red-400/10 text-red-400 border-red-400/30" :
                    "bg-muted text-muted-foreground border-border/50"
                  }`}>
                    MACD {h.macd_trend}
                  </span>
                  {/* Advisory consensus badge */}
                  {consensusMap[h.trading_symbol] && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      CONSENSUS_STYLES[consensusMap[h.trading_symbol].consensus_signal]
                    }`}>
                      <BarChart2 className="w-2.5 h-2.5" />
                      {consensusMap[h.trading_symbol].consensus_signal.replace("_", "\u00A0")}&nbsp;·&nbsp;
                      {consensusMap[h.trading_symbol].total_sources} advisors
                    </span>
                  )}
                </div>

                {/* Advisory consensus breakdown (when data is available) */}
                {consensusMap[h.trading_symbol] && (() => {
                  const c = consensusMap[h.trading_symbol]
                  return (
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="text-emerald-400">▲ {c.buy_count} Buy</span>
                      <span>◆ {c.hold_count} Hold</span>
                      <span className="text-red-400">▼ {c.sell_count} Sell</span>
                      <span className="ml-1 opacity-60">Consensus {c.weighted_score.toFixed(0)}/100</span>
                    </div>
                  )
                })()}

                {/* Per-source advisor chips */}
                {sourceBreakdown[h.trading_symbol]?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sourceBreakdown[h.trading_symbol].map((s) => {
                      const logo = advisorLogoUrl(s.website_url)
                      return (
                        <span
                          key={s.source_name}
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border",
                            s.signal === "BUY" || s.signal === "STRONG_BUY"
                              ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30"
                              : s.signal === "SELL" || s.signal === "STRONG_SELL"
                              ? "bg-red-400/10 text-red-400 border-red-400/30"
                              : s.signal === "HOLD"
                              ? "bg-amber-400/10 text-amber-400 border-amber-400/30"
                              : "bg-muted text-muted-foreground border-border/50"
                          )}
                        >
                          {logo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={logo}
                              alt=""
                              width={12}
                              height={12}
                              className="w-3 h-3 rounded-sm object-contain shrink-0"
                            />
                          )}
                          <span className="truncate max-w-[80px]">{s.source_name}</span>
                          <span className="font-semibold">{s.signal}</span>
                          {s.target_price ? <span>₹{s.target_price.toLocaleString("en-IN")}</span> : null}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Weight + qty */}
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{h.quantity} shares</span>
                  <span>Avg ₹{h.avg_price?.toFixed(2)}</span>
                  <span>Weight {h.weight_pct?.toFixed(1)}%</span>
                  <span>Invested ₹{(h.invested_amount / 1000).toFixed(1)}k</span>
                  <button
                    onClick={() => loadResearch(h.trading_symbol)}
                    className="ml-auto flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
                  >
                    <Newspaper className="h-3.5 w-3.5" />
                    News
                    {expandedResearch === h.trading_symbol
                      ? <ChevronUp className="h-3 w-3" />
                      : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>

                {/* Research panel */}
                {expandedResearch === h.trading_symbol && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                    {researchLoading === h.trading_symbol ? (
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ) : researchData[h.trading_symbol] ? (
                      <>
                        {researchData[h.trading_symbol]!.answer && (
                          <p className="text-xs text-muted-foreground leading-relaxed italic">
                            {researchData[h.trading_symbol]!.answer}
                          </p>
                        )}
                        <div className="space-y-1">
                          {researchData[h.trading_symbol]!.results.map((r, i) => (
                            <a
                              key={i}
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 text-xs text-primary/80 hover:text-primary group"
                            >
                              <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="group-hover:underline line-clamp-1">{r.title}</span>
                            </a>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-destructive/70">Failed to load research.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
