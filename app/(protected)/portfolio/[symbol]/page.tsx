import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { scoreHoldings, type ScoredHolding, type HoldingInput } from "@/lib/quant/scoring"
import { TrendingUp, TrendingDown, ChevronLeft, Target, Zap, Scale, BarChart2, Activity } from "lucide-react"
import Link from "next/link"

const SIGNAL_STYLES: Record<string, { badge: string; bg: string; text: string }> = {
  BUY:   { badge: "bg-emerald-400/15 text-emerald-400 border border-emerald-400/30",  bg: "bg-emerald-400/10 border border-emerald-400/25", text: "text-emerald-400" },
  HOLD:  { badge: "bg-blue-400/15 text-blue-400 border border-blue-400/30",           bg: "bg-blue-400/10 border border-blue-400/25",     text: "text-blue-400" },
  SELL:  { badge: "bg-red-400/15 text-red-400 border border-red-400/30",               bg: "bg-red-400/10 border border-red-400/25",       text: "text-red-400" },
  WATCH: { badge: "bg-amber-400/15 text-amber-400 border border-amber-400/30",        bg: "bg-amber-400/10 border border-amber-400/25",   text: "text-amber-400" },
}

function ScoreBar({
  label,
  value,
  max,
  icon,
  color,
}: {
  label: string
  value: number
  max: number
  icon: React.ReactNode
  color: string
}) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {label}
        </div>
        <span className="text-sm font-semibold">
          {value} <span className="text-muted-foreground font-normal">/ {max}</span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40
  const circ = 2 * Math.PI * radius
  const filled = (score / 100) * circ
  const color =
    score >= 70 ? "#10b981" : // green
    score >= 50 ? "#6366f1" : // indigo
    score >= 35 ? "#f59e0b" : // amber
    "#ef4444"                  // red

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={circ - filled}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold" style={{ color }}>{score}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">score</div>
      </div>
    </div>
  )
}

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>
}) {
  const { symbol } = await params
  const decodedSymbol = decodeURIComponent(symbol)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/signin")

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!portfolio) redirect("/portfolio")

  // Fetch all holdings (needed for correct weight_pct calculation)
  const { data: allHoldings } = await supabase
    .from("holdings")
    .select("instrument_key, quantity, avg_price, ltp, unrealized_pl, invested_amount, segment, raw, company_name")
    .eq("portfolio_id", portfolio.id)
    .not("instrument_key", "eq", "Total")

  if (!allHoldings || allHoldings.length === 0) redirect("/portfolio")

  const inputs: HoldingInput[] = allHoldings.map((h) => {
    const raw = (h.raw as Record<string, unknown>) || {}
    const tradingSymbol = (h.raw as Record<string, string>)?.trading_symbol || h.instrument_key
    return {
      instrument_key: h.instrument_key,
      trading_symbol: tradingSymbol,
      name: (h.company_name as string) || (raw.company_name as string) || tradingSymbol,
      quantity: Number(h.quantity) || 0,
      avg_price: Number(h.avg_price) || 0,
      ltp: Number(h.ltp) || Number(h.avg_price) || 0,
      unrealized_pl: Number(h.unrealized_pl) || 0,
      invested_amount: Number(h.invested_amount) || 0,
      day_change: raw.day_change as number,
      day_change_percentage: raw.day_change_percentage as number,
      segment: (h.segment as string) || "Others",
    }
  })

  const scored = scoreHoldings(inputs)
  const holding: ScoredHolding | undefined = scored.find(
    (s) => s.instrument_key === decodedSymbol
  )

  if (!holding) notFound()

  const signal = holding.signal
  const styles = SIGNAL_STYLES[signal]
  const pnlPositive = holding.unrealized_pl >= 0
  const dayChg = holding.day_change_percentage ?? 0

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <Link
        href="/portfolio"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Portfolio
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{holding.trading_symbol || holding.instrument_key}</h1>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badge}`}
            >
              {signal}
            </span>
            {holding.segment && holding.segment !== "Others" && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {holding.segment}
              </span>
            )}
          </div>
          {holding.name && holding.name !== holding.instrument_key && (
            <p className="text-muted-foreground mt-1">{holding.name}</p>
          )}
        </div>
        <Link href="/trade">
          <Button variant="outline" size="sm">
            <Activity className="h-4 w-4 mr-2" />
            Trade
          </Button>
        </Link>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          {
            label: "Quantity",
            value: `${holding.quantity} shares`,
            sub: null,
            color: "",
          },
          {
            label: "Avg Buy Price",
            value: `₹${holding.avg_price.toFixed(2)}`,
            sub: null,
            color: "",
          },
          {
            label: "Last Traded Price",
            value: `₹${holding.ltp.toFixed(2)}`,
            sub: dayChg !== 0 ? `${dayChg >= 0 ? "+" : ""}${dayChg.toFixed(2)}% today` : null,
            color: dayChg >= 0 ? "text-emerald-400" : "text-red-400",
          },
          {
            label: "Invested",
            value: formatCurrency(holding.invested_amount),
            sub: null,
            color: "",
          },
          {
            label: "Unrealized P&L",
            value: `${pnlPositive ? "+" : ""}${formatCurrency(holding.unrealized_pl)}`,
            sub: `${pnlPositive ? "+" : ""}${holding.pnl_pct.toFixed(2)}%`,
            color: pnlPositive ? "text-emerald-400" : "text-red-400",
          },
          {
            label: "Portfolio Weight",
            value: `${holding.weight_pct.toFixed(2)}%`,
            sub:
              holding.weight_pct > 12
                ? "Over-concentrated"
                : holding.weight_pct < 1
                ? "Under-represented"
                : "Well-sized",
            color:
              holding.weight_pct > 12 || holding.weight_pct < 1
                ? "text-amber-400"
                : "text-emerald-400",
          },
        ].map(({ label, value, sub, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
              {sub && <p className={`text-xs mt-0.5 ${color}`}>{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score + breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="h-4 w-4" />
            Composite Score
          </CardTitle>
          <CardDescription>
            Quant-driven score based on momentum, valuation, and position sizing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <ScoreRing score={holding.score} />

            <div className="flex-1 space-y-4 w-full">
              <ScoreBar
                label="Momentum"
                value={holding.momentum_score}
                max={40}
                icon={<Zap className="h-3.5 w-3.5 text-amber-500" />}
                color="bg-amber-400"
              />
              <ScoreBar
                label="Valuation"
                value={holding.valuation_score}
                max={30}
                icon={<Scale className="h-3.5 w-3.5 text-blue-500" />}
                color="bg-blue-400"
              />
              <ScoreBar
                label="Position Size"
                value={holding.position_score}
                max={30}
                icon={<Target className="h-3.5 w-3.5 text-purple-500" />}
                color="bg-purple-400"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-violet-400" />
            Technical Indicators
          </CardTitle>
          <CardDescription>
            Approximated from position P&amp;L and intraday momentum (updated on sync)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* RSI */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">RSI (approx.)</p>
              <p className={`text-2xl font-bold tabular-nums ${
                holding.technical_signal === "oversold"   ? "text-emerald-400" :
                holding.technical_signal === "overbought" ? "text-red-400" :
                "text-foreground"
              }`}>{holding.rsi_approx}</p>
              <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                holding.technical_signal === "oversold"   ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
                holding.technical_signal === "overbought" ? "bg-red-400/10 text-red-400 border-red-400/30" :
                "bg-muted text-muted-foreground border-border/50"
              }`}>
                {holding.technical_signal === "oversold" ? "Oversold — potential bounce" :
                 holding.technical_signal === "overbought" ? "Overbought — watch for pullback" :
                 "Neutral zone"}
              </span>
            </div>

            {/* MACD Trend */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">MACD Trend</p>
              <p className={`text-2xl font-bold capitalize ${
                holding.macd_trend === "bullish" ? "text-emerald-400" :
                holding.macd_trend === "bearish" ? "text-red-400" :
                "text-foreground"
              }`}>{holding.macd_trend}</p>
              <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                holding.macd_trend === "bullish" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
                holding.macd_trend === "bearish" ? "bg-red-400/10 text-red-400 border-red-400/30" :
                "bg-muted text-muted-foreground border-border/50"
              }`}>
                {holding.macd_trend === "bullish" ? "Short > medium momentum" :
                 holding.macd_trend === "bearish" ? "Short < medium momentum" :
                 "No clear trend"}
              </span>
            </div>

            {/* Position vs Portfolio */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Position Quality</p>
              <p className={`text-2xl font-bold ${
                holding.position_score >= 24 ? "text-emerald-400" :
                holding.position_score >= 16 ? "text-foreground" :
                "text-amber-400"
              }`}>{holding.position_score}/30</p>
              <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                holding.position_score >= 24 ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
                holding.position_score >= 16 ? "bg-muted text-muted-foreground border-border/50" :
                "bg-amber-400/10 text-amber-400 border-amber-400/30"
              }`}>
                {holding.position_score >= 24 ? "Well-sized position" :
                 holding.position_score >= 16 ? "Acceptable sizing" :
                 holding.weight_pct > 12 ? "Over-concentrated" : "Under-represented"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signal insight */}
      <div className={`rounded-lg border px-4 py-3 ${styles.bg}`}>
        <div className="flex items-start gap-3">
          {signal === "BUY" || signal === "HOLD" ? (
            <TrendingUp className={`h-5 w-5 mt-0.5 shrink-0 ${styles.text}`} />
          ) : (
            <TrendingDown className={`h-5 w-5 mt-0.5 shrink-0 ${styles.text}`} />
          )}
          <div>
            <p className={`font-semibold text-sm ${styles.text}`}>{signal} Signal</p>
            <p className={`text-sm mt-0.5 ${styles.text} opacity-90`}>{holding.signal_reason}</p>
          </div>
        </div>
      </div>

      {/* Score legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Score Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              { range: "70–100", signal: "BUY",   color: "bg-emerald-400/15 text-emerald-400" },
              { range: "50–69",  signal: "HOLD",  color: "bg-blue-400/15 text-blue-400" },
              { range: "35–49",  signal: "WATCH", color: "bg-amber-400/15 text-amber-400" },
              { range: "0–34",   signal: "SELL",  color: "bg-red-400/15 text-red-400" },
            ].map(({ range, signal, color }) => (
              <div key={signal} className={`rounded-md px-2 py-1.5 ${color}`}>
                <span className="font-semibold">{signal}</span>
                <span className="ml-1 opacity-70">{range}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
