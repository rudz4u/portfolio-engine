"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, TrendingDown, RefreshCw, Wifi, WifiOff } from "lucide-react"

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/** Checks if current time is within NSE market hours (9:15–15:30 IST, Mon–Fri). */
function isMarketOpen(): boolean {
  const now = new Date()
  // Derive IST time from UTC
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000
  const ist = new Date(utcMs + 5.5 * 60 * 60_000)
  const day = ist.getDay() // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false
  const minutes = ist.getHours() * 60 + ist.getMinutes()
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30
}

interface PortfolioSummaryCardsProps {
  portfolioId: string
  initialInvested: number
  initialPnL: number
  initialCurrentValue: number
}

export function PortfolioSummaryCards({
  portfolioId,
  initialInvested,
  initialPnL,
  initialCurrentValue,
}: PortfolioSummaryCardsProps) {
  // Invested never changes — it is cost basis from the uploaded import
  const invested = initialInvested
  const [pnl, setPnL] = useState(initialPnL)
  const [currentValue, setCurrentValue] = useState(initialCurrentValue)
  const [loading, setLoading] = useState(false)
  const [liveStatus, setLiveStatus] = useState<"idle" | "live" | "cached" | "error">("idle")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLivePrices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/portfolio/refresh-prices?portfolioId=${portfolioId}`,
        { cache: "no-store" },
      )
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()

      // Filter out any synthetic "Total" aggregation row stored by some brokers
      const holdings: Array<{
        instrument_key: string
        invested_amount: number
        unrealized_pl: number
      }> = (data.holdings ?? []).filter(
        (h: { instrument_key?: string }) =>
          h.instrument_key &&
          h.instrument_key !== "Total" &&
          !h.instrument_key.startsWith("Total"),
      )

      // Recompute totals from the returned (partially or fully refreshed) holdings
      const livePnL = holdings.reduce((s, h) => s + (h.unrealized_pl ?? 0), 0)
      const liveCurrentValue = holdings.reduce(
        (s, h) => s + (h.invested_amount ?? 0) + (h.unrealized_pl ?? 0),
        0,
      )

      setPnL(livePnL)
      setCurrentValue(liveCurrentValue)
      // "live" = DB updated with fresh prices; "cached" = prices fetched but
      // DB write failed (values still reflect live LTP); "error" = no prices at all
      const pricesFetched = (data.pricesFetched ?? 0) + (data.updated ?? 0)
      setLiveStatus(data.updated > 0 ? "live" : pricesFetched > 0 ? "cached" : "error")
      setLastUpdated(new Date())
    } catch {
      setLiveStatus("error")
    } finally {
      setLoading(false)
    }
  }, [portfolioId])

  useEffect(() => {
    // Immediate first fetch on mount
    fetchLivePrices()

    // Schedule recurring refresh — only execute during market hours
    const scheduleNext = () => {
      timerRef.current = setTimeout(async () => {
        if (isMarketOpen()) await fetchLivePrices()
        scheduleNext()
      }, REFRESH_INTERVAL_MS)
    }

    scheduleNext()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [fetchLivePrices])

  const returnPct = invested > 0 ? (pnl / invested) * 100 : 0
  const isPositive = pnl >= 0

  const LiveBadge = () => {
    if (loading)
      return <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
    if (liveStatus === "live")
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-500">
          <Wifi className="w-2.5 h-2.5" />
          LIVE
        </span>
      )
    if (liveStatus === "cached")
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-400">
          <Wifi className="w-2.5 h-2.5" />
          live
        </span>
      )
    if (liveStatus === "error")
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
          <WifiOff className="w-2.5 h-2.5" />
          cached
        </span>
      )
    return null
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Invested — static cost basis */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Invested</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">{formatCurrency(invested)}</div>
        </CardContent>
      </Card>

      {/* Current Value — live */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            Current Value
            <LiveBadge />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold">{formatCurrency(currentValue)}</div>
          {lastUpdated && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {lastUpdated.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* P&L — live */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>P&amp;L</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`text-xl font-bold flex items-center gap-1 ${
              isPositive ? "text-green-600" : "text-red-500"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-4 h-4 shrink-0" />
            ) : (
              <TrendingDown className="w-4 h-4 shrink-0" />
            )}
            {isPositive ? "+" : ""}
            {formatCurrency(pnl)}
          </div>
        </CardContent>
      </Card>

      {/* Return — derived from live P&L */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Return</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`text-xl font-bold ${
              isPositive ? "text-green-600" : "text-red-500"
            }`}
          >
            {invested > 0
              ? `${isPositive ? "+" : ""}${returnPct.toFixed(2)}%`
              : "—"}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
