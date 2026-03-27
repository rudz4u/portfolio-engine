"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Wifi, WifiOff } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface LiveLtpTilesProps {
  /** Clean NSE trading symbol, e.g. "RELIANCE". Used to look up the live price. */
  tradingSymbol: string
  avgPrice: number
  quantity: number
  /** Initial (DB-cached) values shown immediately while LTP is fetched. */
  initialLtp: number
  initialPnl: number
  initialPnlPct: number
  /** Day-change % from latest sync — kept as-is since LTP API doesn't return intraday open */
  initialDayChangePct: number
}

function cleanSymbol(sym: string): string {
  // Strip broker suffixes like "-EQ5/-", "-RE.1/-", "-EQ" → keep only alphanumeric prefix
  return sym.split("-")[0].trim().toUpperCase()
}

export function LiveLtpTiles({
  tradingSymbol,
  avgPrice,
  quantity,
  initialLtp,
  initialPnl,
  initialPnlPct,
  initialDayChangePct,
}: LiveLtpTilesProps) {
  const [ltp, setLtp] = useState(initialLtp)
  const [pnl, setPnl] = useState(initialPnl)
  const [pnlPct, setPnlPct] = useState(initialPnlPct)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    const sym = cleanSymbol(tradingSymbol)

    async function fetchLtp() {
      setLoading(true)
      try {
        const res = await fetch("/api/instruments/ltp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: [{ trading_symbol: sym }] }),
          cache: "no-store",
        })
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        const prices: Record<string, number> = data.prices ?? {}
        const price = prices[sym]

        if (price && price > 0) {
          const livePnl = (price - avgPrice) * quantity
          const livePnlPct =
            avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0
          setLtp(price)
          setPnl(livePnl)
          setPnlPct(livePnlPct)
          setLive(true)
          setUpdatedAt(new Date())
        }
      } catch {
        // Silently fall back to stale initial values
      } finally {
        setLoading(false)
      }
    }

    void fetchLtp()
  }, [tradingSymbol, avgPrice, quantity])

  const pnlPositive = pnl >= 0
  const dayChg = initialDayChangePct

  const StatusDot = () => {
    if (loading)
      return (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-1" />
      )
    if (live)
      return <Wifi className="w-2.5 h-2.5 text-green-500 ml-1 inline" />
    return <WifiOff className="w-2.5 h-2.5 text-muted-foreground/40 ml-1 inline" />
  }

  return (
    <>
      {/* Last Traded Price — refreshed live on mount */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground flex items-center">
            Last Traded Price
            <StatusDot />
          </p>
          {loading ? (
            <Skeleton className="h-7 w-24 mt-1" />
          ) : (
            <p className="text-lg font-bold mt-0.5">₹{ltp.toFixed(2)}</p>
          )}
          {dayChg !== 0 && !loading && (
            <p
              className={`text-xs mt-0.5 ${
                dayChg >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {dayChg >= 0 ? "+" : ""}
              {dayChg.toFixed(2)}% today
            </p>
          )}
          {updatedAt && (
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              {updatedAt.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Unrealized P&L — recalculated from live LTP */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">Unrealized P&amp;L</p>
          {loading ? (
            <>
              <Skeleton className="h-7 w-24 mt-1" />
              <Skeleton className="h-3 w-16 mt-1" />
            </>
          ) : (
            <>
              <p
                className={`text-lg font-bold mt-0.5 ${
                  pnlPositive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {pnlPositive ? "+" : ""}
                {formatCurrency(pnl)}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  pnlPositive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {pnlPositive ? "+" : ""}
                {pnlPct.toFixed(2)}%
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
