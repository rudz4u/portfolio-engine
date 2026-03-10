"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CandlestickChart } from "@/components/candlestick-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Activity, TrendingUp, TrendingDown, Search, RefreshCw,
  BarChart2, ArrowUpRight, ArrowDownRight, Minus, Bot,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TIMEFRAME_PRESETS } from "@/lib/candles/types"
import type {
  CandleData,
  PatternSignal,
  TechnicalIndicators,
  TimeframePreset,
} from "@/lib/candles/types"
import Link from "next/link"

/* ── types ─────────────────────────────────────────────────────────── */
interface StockOption {
  instrument_key: string
  trading_symbol: string
  company_name: string
  source: "portfolio" | "watchlist"
}

interface AnalysisResult {
  candles: CandleData[]
  indicators: TechnicalIndicators
  patterns: PatternSignal[]
  overallSignal: "bullish" | "bearish" | "neutral"
  signalSummary: string
  smaArrays?: { sma20?: number[]; sma50?: number[]; sma200?: number[] }
  bollingerArray?: { upper: number; middle: number; lower: number }[]
}

/* ── helpers ─────────────────────────────────────────────────────────── */
const fmtNum = (n: number, decimals = 2) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

/* ── page ────────────────────────────────────────────────────────────── */
export default function TechnicalAnalysisPage() {
  const searchParams = useSearchParams()
  const [stocks, setStocks] = useState<StockOption[]>([])
  const [selected, setSelected] = useState<StockOption | null>(null)
  const [timeframe, setTimeframe] = useState<TimeframePreset>(TIMEFRAME_PRESETS[2]) // 1D default
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStocks, setLoadingStocks] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  /* ── Load user's stocks ──────────────────────────────────────────── */
  useEffect(() => {
    async function loadStocks() {
      setLoadingStocks(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingStocks(false); return }

      // Fetch from portfolio holdings
      const { data: portfolios } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)

      const allStocks: StockOption[] = []

      if (portfolios?.length) {
        const { data: holdings } = await supabase
          .from("holdings")
          .select("instrument_key, raw")
          .eq("portfolio_id", portfolios[0].id)

        if (holdings) {
          for (const h of holdings) {
            const raw = h.raw as Record<string, unknown> | null
            const symbol = (raw?.trading_symbol as string) || h.instrument_key.split("|").pop() || h.instrument_key
            allStocks.push({
              instrument_key: h.instrument_key,
              trading_symbol: symbol,
              company_name: (raw?.company_name as string) || symbol,
              source: "portfolio",
            })
          }
        }
      }

      // Fetch from watchlists
      const { data: watchlistItems } = await supabase
        .from("watchlist_items")
        .select("instrument_key, trading_symbol, company_name, watchlist_id!inner(user_id)")
        .eq("watchlist_id.user_id", user.id)

      if (watchlistItems) {
        const seen = new Set(allStocks.map((s) => s.instrument_key))
        for (const w of watchlistItems) {
          if (!seen.has(w.instrument_key)) {
            allStocks.push({
              instrument_key: w.instrument_key,
              trading_symbol: w.trading_symbol,
              company_name: w.company_name || w.trading_symbol,
              source: "watchlist",
            })
          }
        }
      }

      allStocks.sort((a, b) => a.trading_symbol.localeCompare(b.trading_symbol))
      setStocks(allStocks)

      // Check if a stock was specified via URL query param
      const stockParam = searchParams.get("stock")
      if (stockParam && !selected) {
        const match = allStocks.find((s) => s.instrument_key === stockParam)
        if (match) {
          setSelected(match)
          setLoadingStocks(false)
          return
        }
      }

      if (allStocks.length > 0 && !selected) setSelected(allStocks[0])
      setLoadingStocks(false)
    }
    loadStocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Fetch analysis for selected stock ───────────────────────────── */
  const fetchAnalysis = useCallback(async () => {
    if (!selected) return
    setLoading(true)
    setError(null)

    try {
      const encodedKey = encodeURIComponent(selected.instrument_key)
      const to = new Date().toISOString().split("T")[0]
      const from = new Date(Date.now() - timeframe.lookbackDays * 86400000)
        .toISOString()
        .split("T")[0]

      // Fetch candle data
      const candleRes = await fetch(
        `/api/candles/${encodedKey}?unit=${timeframe.unit}&interval=${timeframe.interval}&from=${from}&to=${to}`,
      )
      if (!candleRes.ok) throw new Error("Failed to fetch candle data")
      const candleJson = await candleRes.json()
      if (candleJson.status !== "success") throw new Error(candleJson.message || "Candle API error")

      // Fetch technical analysis
      const techRes = await fetch(
        `/api/analysis/technicals?symbols=${encodeURIComponent(selected.trading_symbol)}&timeframe=${timeframe.label}`,
      )
      const techJson = techRes.ok ? await techRes.json() : null
      const tech = techJson?.status === "success" ? techJson.data.analyses?.[0] : null

      setAnalysis({
        candles: candleJson.data.candles,
        indicators: tech?.indicators ?? emptyIndicators(),
        patterns: tech?.patterns ?? [],
        overallSignal: tech?.overallSignal ?? "neutral",
        signalSummary: tech?.signalSummary ?? "Insufficient data",
        smaArrays: tech?.smaArrays,
        bollingerArray: tech?.bollingerArray,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
      setAnalysis(null)
    } finally {
      setLoading(false)
    }
  }, [selected, timeframe])

  useEffect(() => {
    if (selected) fetchAnalysis()
  }, [selected, timeframe, fetchAnalysis])

  /* ── Filtered stock list ────────────────────────────────────────── */
  const filteredStocks = searchQuery
    ? stocks.filter(
        (s) =>
          s.trading_symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.company_name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : stocks

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Technical Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered candlestick patterns &amp; real-time indicator analysis
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAnalysis}
          disabled={loading || !selected}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* ── Stock picker sidebar ────────────────────────────────── */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Select Stock</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-border bg-background/50 pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto space-y-0.5 pt-0">
            {loadingStocks ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))
            ) : filteredStocks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {stocks.length === 0
                  ? "Import holdings or add watchlist items first"
                  : "No matching stocks"}
              </p>
            ) : (
              filteredStocks.map((stock) => (
                <button
                  key={stock.instrument_key}
                  onClick={() => setSelected(stock)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                    selected?.instrument_key === stock.instrument_key
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-foreground/80 hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{stock.trading_symbol}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 shrink-0",
                        stock.source === "portfolio"
                          ? "border-primary/30 text-primary/70"
                          : "border-amber-500/30 text-amber-500/70",
                      )}
                    >
                      {stock.source === "portfolio" ? "PORT" : "WL"}
                    </Badge>
                  </div>
                  {stock.company_name !== stock.trading_symbol && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {stock.company_name}
                    </p>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── Main analysis area ──────────────────────────────────── */}
        <div className="space-y-6">
          {/* Stock header */}
          {selected && (
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{selected.trading_symbol}</h2>
              {analysis && !loading && (
                <SignalBadge signal={analysis.overallSignal} />
              )}
              <Link
                href={`/assistant?prompt=Analyze+${selected.trading_symbol}+technical+indicators`}
                className="ml-auto"
              >
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Bot className="h-3.5 w-3.5" />
                  Ask AI
                </Button>
              </Link>
            </div>
          )}

          {/* Chart */}
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-[480px] w-full rounded-lg" />
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAnalysis}
                  className="mt-3"
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : analysis ? (
            <>
              <Card>
                <CardContent className="p-4">
                  <CandlestickChart
                    candles={analysis.candles}
                    patterns={analysis.patterns}
                    indicators={analysis.indicators}
                    smaArrays={analysis.smaArrays}
                    bollingerArray={analysis.bollingerArray}
                    timeframe={timeframe.label}
                    onTimeframeChange={setTimeframe}
                  />
                </CardContent>
              </Card>

              {/* Signal summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-primary" />
                    Signal Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysis.signalSummary}
                  </p>
                </CardContent>
              </Card>

              {/* Indicator cards grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <IndicatorCard
                  label="RSI (14)"
                  value={analysis.indicators.rsi !== null ? fmtNum(analysis.indicators.rsi, 1) : "—"}
                  signal={analysis.indicators.rsiSignal}
                  detail={
                    analysis.indicators.rsiSignal === "overbought"
                      ? "Above 70 — extended"
                      : analysis.indicators.rsiSignal === "oversold"
                        ? "Below 30 — oversold"
                        : "30–70 range"
                  }
                />
                <IndicatorCard
                  label="MACD"
                  value={
                    analysis.indicators.macd
                      ? `${analysis.indicators.macd.histogram > 0 ? "+" : ""}${fmtNum(analysis.indicators.macd.histogram)}`
                      : "—"
                  }
                  signal={analysis.indicators.macdTrend}
                  detail={
                    analysis.indicators.macdTrend === "bullish"
                      ? "Positive histogram"
                      : analysis.indicators.macdTrend === "bearish"
                        ? "Negative histogram"
                        : "Flat"
                  }
                />
                <IndicatorCard
                  label="Bollinger"
                  value={analysis.indicators.bollingerPosition}
                  signal={
                    analysis.indicators.bollingerPosition === "below"
                      ? "oversold"
                      : analysis.indicators.bollingerPosition === "above"
                        ? "overbought"
                        : "neutral"
                  }
                  detail={
                    analysis.indicators.bollingerBands
                      ? `${fmtNum(analysis.indicators.bollingerBands.lower)} – ${fmtNum(analysis.indicators.bollingerBands.upper)}`
                      : "—"
                  }
                />
                <IndicatorCard
                  label="Volume"
                  value={analysis.indicators.volumeTrend}
                  signal={analysis.indicators.volumeTrend === "high" ? "bullish" : "neutral"}
                  detail={
                    analysis.indicators.avgVolume20
                      ? `Avg 20d: ${(analysis.indicators.avgVolume20 / 1000).toFixed(0)}K`
                      : "—"
                  }
                />
              </div>

              {/* Moving averages */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Key Levels</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {analysis.indicators.sma20 !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs">SMA 20</p>
                        <p className="font-mono font-medium">₹{fmtNum(analysis.indicators.sma20)}</p>
                      </div>
                    )}
                    {analysis.indicators.sma50 !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs">SMA 50</p>
                        <p className="font-mono font-medium">₹{fmtNum(analysis.indicators.sma50)}</p>
                      </div>
                    )}
                    {analysis.indicators.sma200 !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs">SMA 200</p>
                        <p className="font-mono font-medium">₹{fmtNum(analysis.indicators.sma200)}</p>
                      </div>
                    )}
                    {analysis.indicators.atr !== null && (
                      <div>
                        <p className="text-muted-foreground text-xs">ATR (14)</p>
                        <p className="font-mono font-medium">₹{fmtNum(analysis.indicators.atr)}</p>
                      </div>
                    )}
                    {analysis.indicators.bollingerBands && (
                      <>
                        <div>
                          <p className="text-muted-foreground text-xs">Bollinger Upper</p>
                          <p className="font-mono font-medium">₹{fmtNum(analysis.indicators.bollingerBands.upper)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Bollinger Lower</p>
                          <p className="font-mono font-medium">₹{fmtNum(analysis.indicators.bollingerBands.lower)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Detected patterns detail */}
              {analysis.patterns.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Detected Patterns ({analysis.patterns.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysis.patterns.map((p, i) => (
                        <div
                          key={`${p.name}-${i}`}
                          className="flex items-start gap-3 rounded-lg border border-border/30 p-3"
                        >
                          <div
                            className={cn(
                              "mt-0.5 h-8 w-8 rounded-md flex items-center justify-center shrink-0 text-sm font-bold",
                              p.direction === "bullish"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : p.direction === "bearish"
                                  ? "bg-rose-500/10 text-rose-400"
                                  : "bg-amber-500/10 text-amber-400",
                            )}
                          >
                            {p.direction === "bullish" ? "▲" : p.direction === "bearish" ? "▼" : "◆"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{p.name}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {Math.round(p.confidence * 100)}%
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  p.category === "reversal"
                                    ? "border-purple-500/30 text-purple-400"
                                    : "border-sky-500/30 text-sky-400",
                                )}
                              >
                                {p.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {p.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Disclaimer */}
              <p className="text-[10px] text-muted-foreground/60 text-center px-4">
                Technical observations are for educational purposes only. Not investment advice.
                Past patterns do not guarantee future performance. Always consult a SEBI-registered advisor.
              </p>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a stock to view technical analysis</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function SignalBadge({ signal }: { signal: "bullish" | "bearish" | "neutral" }) {
  const config = {
    bullish: { label: "Bullish", icon: ArrowUpRight, className: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" },
    bearish: { label: "Bearish", icon: ArrowDownRight, className: "bg-rose-500/10 text-rose-400 ring-rose-500/20" },
    neutral: { label: "Neutral", icon: Minus, className: "bg-amber-500/10 text-amber-400 ring-amber-500/20" },
  }
  const c = config[signal]
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1", c.className)}>
      <c.icon className="h-3 w-3" />
      {c.label}
    </span>
  )
}

function IndicatorCard({
  label,
  value,
  signal,
  detail,
}: {
  label: string
  value: string
  signal: "bullish" | "bearish" | "neutral" | "overbought" | "oversold"
  detail: string
}) {
  const signalColor =
    signal === "bullish" || signal === "oversold"
      ? "text-emerald-400"
      : signal === "bearish" || signal === "overbought"
        ? "text-rose-400"
        : "text-muted-foreground"

  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn("text-lg font-mono font-bold mt-1", signalColor)}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{detail}</p>
      </CardContent>
    </Card>
  )
}

function emptyIndicators(): TechnicalIndicators {
  return {
    rsi: null,
    rsiSignal: "neutral",
    macd: null,
    macdTrend: "neutral",
    bollingerBands: null,
    bollingerPosition: "within",
    sma20: null,
    sma50: null,
    sma200: null,
    atr: null,
    volumeTrend: "normal",
    avgVolume20: null,
  }
}
