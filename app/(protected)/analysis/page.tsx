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
  BarChart2, ArrowUpRight, ArrowDownRight, Minus, Bot, Info,
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
  const [timeframe, setTimeframe] = useState<TimeframePreset>(TIMEFRAME_PRESETS[4]) // 1D default
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

      {/* Info Banner */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-primary/80 font-mono">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          Showing stocks from your <strong>Portfolio</strong> and <strong>Watchlists</strong>. Add more instruments via the Dashboard or Watchlist page.
        </span>
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

              {/* Signal summary with gauge */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-primary" />
                    Signal Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Signal strength gauge */}
                  <div className="flex items-center gap-6">
                    <SignalGauge signal={analysis.overallSignal} rsi={analysis.indicators.rsi} />
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                      {analysis.signalSummary}
                    </p>
                  </div>

                  {/* Price action micro-strip */}
                  {analysis.candles.length > 1 && (
                    <PriceActionStrip candles={analysis.candles} indicators={analysis.indicators} />
                  )}
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
                      {analysis.patterns.map((p, i) => {
                        const confPct = Math.round(p.confidence * 100)
                        const confColor =
                          p.direction === "bullish" ? "bg-emerald-500" : p.direction === "bearish" ? "bg-rose-500" : "bg-amber-500"
                        return (
                          <div
                            key={`${p.name}-${i}`}
                            className="flex items-start gap-3 rounded-lg border border-border/30 p-3 animate-in fade-in slide-in-from-bottom-2"
                            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both", animationDuration: "400ms" }}
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
                                {confPct >= 75 && (
                                  <span className={cn(
                                    "h-2 w-2 rounded-full animate-pulse",
                                    p.direction === "bullish" ? "bg-emerald-400" : "bg-rose-400",
                                  )} />
                                )}
                                <Badge variant="outline" className="text-[10px]">
                                  {confPct}%
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
                              {/* Confidence bar */}
                              <div className="mt-2 h-1 w-full rounded-full bg-muted/30 overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-700 ease-out", confColor)}
                                  style={{ width: `${confPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
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

/* ── Signal Gauge ────────────────────────────────────────────────────── */
function SignalGauge({
  signal,
  rsi,
}: {
  signal: "bullish" | "bearish" | "neutral"
  rsi: number | null
}) {
  // Map signal to angle on a semi-circular gauge: -90° (bearish) → 0° (neutral) → +90° (bullish)
  const angle =
    signal === "bullish" ? (rsi && rsi > 60 ? Math.min(90, (rsi - 50) * 2.25) : 45)
    : signal === "bearish" ? (rsi && rsi < 40 ? Math.max(-90, (rsi - 50) * 2.25) : -45)
    : 0
  const needleColor =
    signal === "bullish" ? "#10b981" : signal === "bearish" ? "#f43f5e" : "#eab308"

  return (
    <div className="relative shrink-0" style={{ width: 80, height: 48 }}>
      <svg viewBox="0 0 80 48" className="w-full h-full">
        {/* Background arc */}
        <path
          d="M 8 44 A 32 32 0 0 1 72 44"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Colored segments */}
        <path d="M 8 44 A 32 32 0 0 1 24 16" fill="none" stroke="rgba(244,63,94,0.3)" strokeWidth="6" strokeLinecap="round" />
        <path d="M 30 13 A 32 32 0 0 1 50 13" fill="none" stroke="rgba(234,179,8,0.3)" strokeWidth="6" strokeLinecap="round" />
        <path d="M 56 16 A 32 32 0 0 1 72 44" fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth="6" strokeLinecap="round" />
        {/* Needle */}
        <line
          x1="40"
          y1="44"
          x2={40 + 26 * Math.sin((angle * Math.PI) / 180)}
          y2={44 - 26 * Math.cos((angle * Math.PI) / 180)}
          stroke={needleColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        {/* Center dot */}
        <circle cx="40" cy="44" r="3" fill={needleColor} className="transition-colors duration-700" />
      </svg>
      <p className="absolute bottom-0 left-0 right-0 text-center text-[9px] font-mono font-bold uppercase tracking-wider"
         style={{ color: needleColor }}>
        {signal}
      </p>
    </div>
  )
}

/* ── Price Action Strip ─────────────────────────────────────────────── */
function PriceActionStrip({
  candles,
  indicators,
}: {
  candles: CandleData[]
  indicators: TechnicalIndicators
}) {
  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const changePct = prev ? ((last.close - prev.close) / prev.close) * 100 : 0
  const dayRange = last.high - last.low
  const positionInRange = dayRange > 0 ? ((last.close - last.low) / dayRange) * 100 : 50

  const smaDist20 = indicators.sma20 ? ((last.close - indicators.sma20) / indicators.sma20 * 100) : null
  const smaDist50 = indicators.sma50 ? ((last.close - indicators.sma50) / indicators.sma50 * 100) : null

  const trend =
    indicators.sma20 && indicators.sma50
      ? last.close > indicators.sma20 && indicators.sma20 > indicators.sma50
        ? "uptrend"
        : last.close < indicators.sma20 && indicators.sma20 < indicators.sma50
          ? "downtrend"
          : "sideways"
      : "—"

  const trendIcon =
    trend === "uptrend" ? <TrendingUp className="h-3 w-3 text-emerald-400" />
    : trend === "downtrend" ? <TrendingDown className="h-3 w-3 text-rose-400" />
    : <Minus className="h-3 w-3 text-amber-400" />

  const items = [
    { label: "Last Close", value: `₹${fmtNum(last.close)}`, color: changePct >= 0 ? "text-emerald-400" : "text-rose-400" },
    { label: "Change", value: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`, color: changePct >= 0 ? "text-emerald-400" : "text-rose-400" },
    { label: "Range Pos", value: `${positionInRange.toFixed(0)}%`, color: positionInRange > 60 ? "text-emerald-400" : positionInRange < 40 ? "text-rose-400" : "text-amber-400" },
    ...(smaDist20 !== null ? [{ label: "vs SMA20", value: `${smaDist20 >= 0 ? "+" : ""}${smaDist20.toFixed(2)}%`, color: smaDist20 >= 0 ? "text-emerald-400" : "text-rose-400" }] : []),
    ...(smaDist50 !== null ? [{ label: "vs SMA50", value: `${smaDist50 >= 0 ? "+" : ""}${smaDist50.toFixed(2)}%`, color: smaDist50 >= 0 ? "text-emerald-400" : "text-rose-400" }] : []),
  ]

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border/30 bg-muted/20 px-4 py-2.5">
      <div className="flex items-center gap-1.5 pr-4 border-r border-border/30">
        {trendIcon}
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {trend === "—" ? "N/A" : trend}
        </span>
      </div>
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
          <p className={cn("text-xs font-mono font-bold", item.color)}>{item.value}</p>
        </div>
      ))}
    </div>
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
