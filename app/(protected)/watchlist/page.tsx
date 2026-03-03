"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Bookmark, BookmarkX, RefreshCw, TrendingUp, TrendingDown, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

interface WatchedHolding {
  id: string
  instrument_key: string
  company_name?: string | null
  trading_symbol?: string | null
  quantity: number
  avg_price: number
  ltp: number
  invested_amount: number
  unrealized_pl: number
  segment?: string | null
  raw?: Record<string, unknown> | null
}

function displayName(h: WatchedHolding): string {
  if (h.company_name) return h.company_name
  if (h.trading_symbol) return h.trading_symbol
  const raw = h.instrument_key || ""
  return raw.includes("|") ? raw.split("|")[1] : raw
}

function tradingSymbol(h: WatchedHolding): string {
  if (h.trading_symbol) return h.trading_symbol
  const raw = h.instrument_key || ""
  return raw.includes("|") ? raw.split("|")[1] : raw
}

function getDayChangePct(h: WatchedHolding): number {
  return (h.raw?.day_change_percentage as number) || 0
}

export default function WatchlistPage() {
  const [symbols, setSymbols] = useState<string[]>([])
  const [holdings, setHoldings] = useState<WatchedHolding[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/watchlist")
      if (!res.ok) throw new Error("Failed to fetch watchlist")
      const data = await res.json()
      setSymbols(data.symbols ?? [])
      setHoldings(data.holdings ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function removeSymbol(instrument_key: string) {
    setRemoving(instrument_key)
    try {
      await fetch(`/api/watchlist?instrument_key=${encodeURIComponent(instrument_key)}`, { method: "DELETE" })
      await load()
    } finally {
      setRemoving(null)
    }
  }

  // Build a lookup map from API response
  const holdingMap = new Map(holdings.map((h) => [h.instrument_key, h]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-primary" />
            Watchlist
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Stocks you&apos;re monitoring. Add them from the{" "}
            <Link href="/portfolio" className="text-primary hover:underline">Portfolio</Link> table.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-6 w-24 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : symbols.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Bookmark className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Your watchlist is empty.</p>
            <p className="text-xs text-muted-foreground">
              Click the bookmark icon next to any stock in your{" "}
              <Link href="/portfolio" className="text-primary hover:underline">Portfolio</Link>{" "}
              to start watching it.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{symbols.length} symbol{symbols.length !== 1 ? "s" : ""} watched</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {symbols.map((key) => {
              const h = holdingMap.get(key)
              const isRemoving = removing === key
              const name = h ? displayName(h) : (key.includes("|") ? key.split("|")[1] : key)
              const sym  = h ? tradingSymbol(h) : name

              if (!h) {
                // Symbol watched but not in portfolio (e.g. sold)
                return (
                  <Card key={key} className="opacity-60">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{sym}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">Not in portfolio</CardDescription>
                        </div>
                        <button
                          onClick={() => removeSymbol(key)}
                          disabled={isRemoving}
                          className="text-muted-foreground hover:text-destructive transition-colors mt-0.5"
                          title="Remove from watchlist"
                        >
                          <BookmarkX className="h-4 w-4" />
                        </button>
                      </div>
                    </CardHeader>
                  </Card>
                )
              }

              const pnl      = h.unrealized_pl || 0
              const invested = h.invested_amount || 0
              const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0
              const ltp      = h.ltp || 0
              const dayChg   = getDayChangePct(h)
              const pnlPos   = pnl >= 0

              return (
                <Card key={key} className="hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{sym}</CardTitle>
                        {name !== sym && (
                          <CardDescription className="text-xs mt-0.5 truncate">{name}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/portfolio/${encodeURIComponent(key)}`}
                          title="View detail"
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => removeSymbol(key)}
                          disabled={isRemoving}
                          className="text-primary hover:text-destructive transition-colors"
                          title="Remove from watchlist"
                        >
                          <BookmarkX className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {/* LTP + Day Change */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">LTP</p>
                        <p className="text-xl font-bold tabular-nums">
                          {ltp ? `₹${ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                        </p>
                      </div>
                      {dayChg !== 0 && (
                        <div className={`flex items-center gap-1 text-sm font-medium tabular-nums ${dayChg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {dayChg >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {dayChg >= 0 ? "+" : ""}{dayChg.toFixed(2)}%
                        </div>
                      )}
                    </div>

                    {/* P&L */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Unrealized P&L</span>
                      <span className={`font-semibold tabular-nums ${pnlPos ? "text-emerald-400" : "text-red-400"}`}>
                        {pnlPos ? "+" : ""}{formatCurrency(pnl)}
                        <span className="font-normal ml-1 opacity-75">
                          ({pnlPos ? "+" : ""}{pnlPct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>

                    {/* Segment badge */}
                    {h.segment && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs px-2 py-0">
                          {h.segment}
                        </Badge>
                        {h.quantity > 0 && (
                          <span className="text-xs text-muted-foreground">{h.quantity} qty</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
