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
import {
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ExternalLink,
  Target,
  Zap,
  Scale,
  BarChart2,
} from "lucide-react"
import Link from "next/link"

const SIGNAL_STYLES: Record<string, { badge: string; bg: string; text: string }> = {
  BUY:   { badge: "bg-green-100 text-green-800",  bg: "bg-green-50",  text: "text-green-700" },
  HOLD:  { badge: "bg-blue-100 text-blue-800",    bg: "bg-blue-50",   text: "text-blue-700" },
  SELL:  { badge: "bg-red-100 text-red-700",      bg: "bg-red-50",    text: "text-red-700" },
  WATCH: { badge: "bg-amber-100 text-amber-800",  bg: "bg-amber-50",  text: "text-amber-700" },
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
    const raw = (h.raw as Record<string, number>) || {}
    return {
      instrument_key: h.instrument_key,
      trading_symbol: h.instrument_key,
      name: (h.company_name as string) || h.instrument_key,
      quantity: Number(h.quantity) || 0,
      avg_price: Number(h.avg_price) || 0,
      ltp: Number(h.ltp) || Number(h.avg_price) || 0,
      unrealized_pl: Number(h.unrealized_pl) || 0,
      invested_amount: Number(h.invested_amount) || 0,
      day_change: raw.day_change,
      day_change_percentage: raw.day_change_percentage,
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
            <h1 className="text-2xl font-bold">{holding.instrument_key}</h1>
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
        <Link href="/sandbox">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Trade on Sandbox
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
            color: dayChg >= 0 ? "text-green-600" : "text-red-500",
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
            color: pnlPositive ? "text-green-600" : "text-red-500",
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
                ? "text-amber-600"
                : "text-green-600",
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
              { range: "70–100", signal: "BUY",   color: "bg-green-100 text-green-800" },
              { range: "50–69",  signal: "HOLD",  color: "bg-blue-100 text-blue-800" },
              { range: "35–49",  signal: "WATCH", color: "bg-amber-100 text-amber-800" },
              { range: "0–34",   signal: "SELL",  color: "bg-red-100 text-red-700" },
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
