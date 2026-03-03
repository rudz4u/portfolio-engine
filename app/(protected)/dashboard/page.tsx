import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
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

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/signin")

  const summary = await getPortfolioSummary(user.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.email?.split("@")[0]}
        </p>
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
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Invested</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.totalInvested)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Current Value</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.currentValue)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total P&amp;L</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold flex items-center gap-1 ${
                    summary.totalPnL >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {summary.totalPnL >= 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  {formatCurrency(Math.abs(summary.totalPnL))}
                </div>
                <p
                  className={`text-xs mt-1 ${
                    summary.pnlPercent >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {summary.pnlPercent >= 0 ? "+" : ""}
                  {(summary.pnlPercent * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Holdings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-1">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  {summary.count}
                </div>
                <p className="text-xs text-muted-foreground mt-1">active stocks</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Segment allocation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Segment Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(summary.segments)
                    .sort(([, a], [, b]) => b - a)
                    .map(([seg, amount]) => {
                      const pct = (amount / summary.totalInvested) * 100
                      return (
                        <div key={seg}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{seg}</span>
                            <span className="text-muted-foreground">
                              {formatCurrency(amount)} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
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
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Top Gainers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.topGainers.map((h) => (
                      <div
                        key={h.instrument_key}
                        className="flex justify-between items-center text-sm"
                      >
                        <span className="font-medium">{h.instrument_key}</span>
                        <Badge variant="success">
                          +{formatCurrency(h.unrealized_pl || 0)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    Top Losers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.topLosers.map((h) => (
                      <div
                        key={h.instrument_key}
                        className="flex justify-between items-center text-sm"
                      >
                        <span className="font-medium">{h.instrument_key}</span>
                        <Badge variant="destructive">
                          {formatCurrency(h.unrealized_pl || 0)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Recent Activity stub */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Order history and portfolio changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No recent orders. Connect Upstox in Settings to start trading.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
