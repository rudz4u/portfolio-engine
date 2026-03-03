import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Briefcase, Activity } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { PortfolioCharts } from "./portfolio-charts"
import { SyncBar } from "./sync-bar"

async function getPortfolioSummary(userId: string) {
  const supabase = await createClient()

  // Get the user's portfolio
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .single()

  if (!portfolio) return null

  // Get holdings
  const { data: holdings } = await supabase
    .from("holdings")
    .select("*")
    .eq("portfolio_id", portfolio.id)
    .not("instrument_key", "eq", "Total")

  if (!holdings) return null

  const totalInvested = holdings.reduce((s, h) => s + (h.invested_amount || 0), 0)
  const totalPnL = holdings.reduce((s, h) => s + (h.unrealized_pl || 0), 0)
  const currentValue = totalInvested + totalPnL

  // Segment breakdown
  const segments: Record<string, number> = {}
  holdings.forEach((h) => {
    if (h.segment) {
      segments[h.segment] = (segments[h.segment] || 0) + (h.invested_amount || 0)
    }
  })

  const topGainers = [...holdings]
    .filter((h) => h.unrealized_pl && h.quantity)
    .sort((a, b) => (b.unrealized_pl || 0) - (a.unrealized_pl || 0))
    .slice(0, 5)

  const topLosers = [...holdings]
    .filter((h) => h.unrealized_pl && h.quantity)
    .sort((a, b) => (a.unrealized_pl || 0) - (b.unrealized_pl || 0))
    .slice(0, 5)

  return {
    totalInvested,
    totalPnL,
    currentValue,
    pnlPercent: totalInvested > 0 ? totalPnL / totalInvested : 0,
    holdings,
    segments,
    topGainers,
    topLosers,
    count: holdings.filter((h) => h.quantity && h.quantity > 0).length,
  }
}

async function getRecentOrders(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("orders")
    .select("id, instrument_key, side, quantity, price, status, external_order_id, meta, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5)
  return data ?? []
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/signin")

  const summary = await getPortfolioSummary(user.id)
  const recentOrders = await getRecentOrders(user.id)

  // Last sync time: most recent updated_at across holdings
  const { data: lastSyncRow } = await supabase
    .from("holdings")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single()
  const lastSynced = lastSyncRow?.updated_at ?? null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome back,{" "}
            <span className="text-foreground font-medium">{user.email?.split("@")[0]}</span>
          </p>
        </div>
        <SyncBar lastSynced={lastSynced} />
      </div>

      {!summary ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No portfolio data found.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Go to Settings to connect your Upstox account and sync holdings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Invested */}
            <Card className="kpi-card card-elevated">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3" />
                  Total Invested
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold tabular-nums">
                  {formatCurrency(summary.totalInvested)}
                </div>
              </CardContent>
            </Card>

            {/* Current Value */}
            <Card className="kpi-card card-elevated">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />
                  Current Value
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold tabular-nums gradient-text">
                  {formatCurrency(summary.currentValue)}
                </div>
              </CardContent>
            </Card>

            {/* P&L */}
            <Card
              className={`kpi-card card-elevated ${
                summary.totalPnL >= 0 ? "kpi-card-green" : "kpi-card-red"
              }`}
            >
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs flex items-center gap-1.5">
                  {summary.totalPnL >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  )}
                  Total P&amp;L
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div
                  className={`text-xl font-bold tabular-nums flex items-center gap-1 ${
                    summary.totalPnL >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatCurrency(Math.abs(summary.totalPnL))}
                </div>
                <p
                  className={`text-xs mt-0.5 font-medium ${
                    summary.pnlPercent >= 0 ? "text-emerald-400/80" : "text-red-400/80"
                  }`}
                >
                  {summary.pnlPercent >= 0 ? "+" : ""}
                  {(summary.pnlPercent * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            {/* Holdings */}
            <Card className="kpi-card card-elevated">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3" />
                  Holdings
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-xl font-bold tabular-nums">{summary.count}</div>
                <p className="text-xs text-muted-foreground mt-0.5">active stocks</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Segment allocation */}
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  Segment Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(summary.segments)
                    .sort(([, a], [, b]) => b - a)
                    .map(([seg, amount]) => {
                      const pct = (amount / summary.totalInvested) * 100
                      return (
                        <div key={seg}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-medium text-foreground">{seg}</span>
                            <span className="text-muted-foreground">
                              {formatCurrency(amount)}{" "}
                              <span className="text-foreground/60">({pct.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Top movers */}
            <div className="space-y-4">
              <Card className="card-elevated">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    Top Gainers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.topGainers.map((h) => (
                      <div
                        key={h.instrument_key}
                        className="flex justify-between items-center text-xs py-1"
                      >
                        <span className="font-medium text-foreground">
                          {((h.raw as Record<string, unknown>)?.trading_symbol as string) || h.instrument_key}
                        </span>
                        <Badge variant="success" className="text-[10px]">
                          +{formatCurrency(h.unrealized_pl || 0)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                    Top Losers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.topLosers.map((h) => (
                      <div
                        key={h.instrument_key}
                        className="flex justify-between items-center text-xs py-1"
                      >
                        <span className="font-medium text-foreground">
                          {((h.raw as Record<string, unknown>)?.trading_symbol as string) || h.instrument_key}
                        </span>
                        <Badge variant="destructive" className="text-[10px]">
                          {formatCurrency(h.unrealized_pl || 0)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Portfolio Charts */}
          <Suspense
            fallback={
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="h-[300px] rounded-xl bg-muted animate-pulse" />
                <div className="h-[300px] rounded-xl bg-muted animate-pulse" />
              </div>
            }
          >
            <PortfolioCharts
              segments={summary.segments}
              totalInvested={summary.totalInvested}
              topGainers={summary.topGainers}
              topLosers={summary.topLosers}
            />
          </Suspense>
        </>
      )}

      {/* Recent Activity */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Recent Activity
          </CardTitle>
          <CardDescription className="text-xs">Last 5 orders from sandbox &amp; live trading</CardDescription>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No orders yet. Go to the Trade page to place orders.
            </p>
          ) : (
            <div className="space-y-1">
              {recentOrders.map((order) => {
                const tradingSymbol =
                  (order.meta as Record<string, string>)?.trading_symbol ||
                  order.instrument_key
                const isBuy = order.side === "BUY"
                const statusColor =
                  order.status === "PLACED"
                    ? "bg-emerald-400/10 text-emerald-400"
                    : order.status === "FAILED"
                    ? "bg-red-400/10 text-red-400"
                    : "bg-muted text-muted-foreground"
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isBuy
                            ? "bg-emerald-400/10 text-emerald-400"
                            : "bg-red-400/10 text-red-400"
                        }`}
                      >
                        {order.side}
                      </span>
                      <div>
                        <p className="text-xs font-medium">{tradingSymbol}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {order.quantity} shares
                          {order.price ? ` @ ₹${Number(order.price).toFixed(2)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor}`}>
                        {order.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
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
