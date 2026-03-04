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
import PortfolioTable from "@/app/(protected)/portfolio/portfolio-table"
import { PortfolioSwitcher } from "@/components/portfolio-switcher"

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ pid?: string }>
}) {
  const { pid } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/signin")

  // Fetch all user portfolios (most recent first)
  const { data: allPortfolios } = await supabase
    .from("portfolios")
    .select("id, source, fetched_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const portfolios = allPortfolios ?? []

  // Resolve which portfolio to display
  const portfolio =
    (pid ? portfolios.find((p) => p.id === pid) : null) ?? portfolios[0] ?? null

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

  // Derive a readable label for the current portfolio
  const portfolioLabel =
    portfolio?.source
      ? portfolio.source.charAt(0).toUpperCase() + portfolio.source.slice(1) + " Portfolio"
      : "Portfolio"

  // Build switcher options (name column may not exist yet — pass null)
  const switcherPortfolios = portfolios.map((p) => ({
    id: p.id,
    source: p.source as string | null,
    name: null as null,
    fetched_at: p.fetched_at as string | null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{portfolioLabel}</h1>
          <p className="text-muted-foreground">
            {holdings.length} holdings · Click a segment badge to edit it
            {portfolios.length > 1 && (
              <span className="text-muted-foreground/60">
                {" "}· {portfolios.length} portfolios
              </span>
            )}
          </p>
        </div>
        {portfolio && (
          <PortfolioSwitcher
            portfolios={switcherPortfolios}
            currentId={portfolio.id}
          />
        )}
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
