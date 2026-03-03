import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

const SEGMENT_COLORS: Record<string, string> = {
  Defence: "bg-blue-100 text-blue-800",
  EV: "bg-green-100 text-green-800",
  Technology: "bg-purple-100 text-purple-800",
  "Green Energy": "bg-emerald-100 text-emerald-800",
  PSU: "bg-orange-100 text-orange-800",
  Others: "bg-gray-100 text-gray-800",
}

export default async function PortfolioPage() {
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

  let holdings: Record<string, unknown>[] = []
  if (portfolio) {
    const { data } = await supabase
      .from("holdings")
      .select("*")
      .eq("portfolio_id", portfolio.id)
      .not("instrument_key", "eq", "Total")
      .order("invested_amount", { ascending: false })

    holdings = data || []
  }

  const totalInvested = holdings.reduce((s, h) => s + ((h.invested_amount as number) || 0), 0)
  const totalPnL = holdings.reduce((s, h) => s + ((h.unrealized_pl as number) || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground">
          All your holdings synced from Upstox
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Invested</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(totalInvested)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unrealized P&amp;L</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl font-bold ${totalPnL >= 0 ? "text-green-600" : "text-red-500"}`}
            >
              {totalPnL >= 0 ? "+" : ""}
              {formatCurrency(totalPnL)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>P&amp;L %</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl font-bold ${totalPnL >= 0 ? "text-green-600" : "text-red-500"}`}
            >
              {totalInvested > 0
                ? `${totalPnL >= 0 ? "+" : ""}${((totalPnL / totalInvested) * 100).toFixed(2)}%`
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holdings table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings ({holdings.length} stocks)</CardTitle>
          <CardDescription>
            All positions in your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              No holdings found. Sync from Upstox via the Sandbox page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Symbol</th>
                    <th className="text-right py-2 px-2 font-medium">Qty</th>
                    <th className="text-right py-2 px-2 font-medium">Avg Price</th>
                    <th className="text-right py-2 px-2 font-medium hidden md:table-cell">LTP</th>
                    <th className="text-right py-2 px-2 font-medium">Invested</th>
                    <th className="text-right py-2 px-2 font-medium">P&amp;L</th>
                    <th className="text-right py-2 pl-2 font-medium hidden lg:table-cell">Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const pnl = (h.unrealized_pl as number) || 0
                    const invested = (h.invested_amount as number) || 0
                    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
                    const segment = (h.segment as string) || "Others"
                    return (
                      <tr
                        key={h.id as string}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2.5 pr-4 font-medium">
                          <Link
                            href={`/portfolio/${encodeURIComponent(h.instrument_key as string)}`}
                            className="hover:text-primary hover:underline underline-offset-2 transition-colors"
                          >
                            {h.instrument_key as string}
                          </Link>
                          {Boolean(h.moving) && (
                            <span className="text-xs text-green-600">Moving</span>
                          )}
                        </td>
                        <td className="text-right py-2.5 px-2">{h.quantity as number}</td>
                        <td className="text-right py-2.5 px-2">
                          ₹{((h.avg_price as number) || 0).toFixed(2)}
                        </td>
                        <td className="text-right py-2.5 px-2 hidden md:table-cell">
                          {h.ltp ? `₹${(h.ltp as number).toFixed(2)}` : "—"}
                        </td>
                        <td className="text-right py-2.5 px-2">
                          {formatCurrency(invested)}
                        </td>
                        <td className={`text-right py-2.5 px-2 ${pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                          <div>{pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}</div>
                          <div className="text-xs">
                            {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                          </div>
                        </td>
                        <td className="text-right py-2.5 pl-2 hidden lg:table-cell">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              SEGMENT_COLORS[segment] || SEGMENT_COLORS.Others
                            }`}
                          >
                            {segment}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
