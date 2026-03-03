import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import PortfolioTable from "./portfolio-table"

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

  const totalInvested = holdings.reduce(
    (s, h) => s + ((h.invested_amount as number) || 0),
    0,
  )
  const totalPnL = holdings.reduce(
    (s, h) => s + ((h.unrealized_pl as number) || 0),
    0,
  )
  const currentValue = totalInvested + totalPnL

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground">
          All your holdings synced from Upstox. Click a segment badge to edit
          it.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Invested</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatCurrency(totalInvested)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatCurrency(currentValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>P&amp;L</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl font-bold ${
                totalPnL >= 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {totalPnL >= 0 ? "+" : ""}
              {formatCurrency(totalPnL)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Return</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl font-bold ${
                totalPnL >= 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {totalInvested > 0
                ? `${totalPnL >= 0 ? "+" : ""}${(
                    (totalPnL / totalInvested) *
                    100
                  ).toFixed(2)}%`
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
            Sorted by invested amount. Click a segment badge to change it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PortfolioTable
            holdings={
              holdings as unknown as Parameters<typeof PortfolioTable>[0]["holdings"]
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
