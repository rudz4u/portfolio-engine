"use client"

import { useEffect, useState, useCallback } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity } from "lucide-react"

// Upstox historical candle tuple: [timestamp_iso, open, high, low, close, volume, oi]
type Candle = [string, number, number, number, number, number, number]

interface ChartPoint {
  date: string
  close: number
  open: number
  high: number
  low: number
  volume: number
}

interface CandelApiResponse {
  status?: string
  error?: string
  data?: {
    candles?: Candle[]
  }
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
] as const

/**
 * Compute Beta = Cov(stock_returns, market_returns) / Var(market_returns)
 * using aligned daily close-to-close returns.
 */
function computeBeta(
  stockCandles: Candle[],
  marketCandles: Candle[],
): number | null {
  if (stockCandles.length < 10 || marketCandles.length < 10) return null

  // Map date string (YYYY-MM-DD) → close price
  const stockByDate = new Map<string, number>()
  for (const c of stockCandles) {
    stockByDate.set(c[0].slice(0, 10), c[4])
  }

  const mktByDate = new Map<string, number>()
  for (const c of marketCandles) {
    mktByDate.set(c[0].slice(0, 10), c[4])
  }

  // Common dates sorted ascending
  const dates = [...stockByDate.keys()]
    .filter((d) => mktByDate.has(d))
    .sort()

  if (dates.length < 10) return null

  const stockR: number[] = []
  const mktR: number[] = []

  for (let i = 1; i < dates.length; i++) {
    const d = dates[i]
    const prev = dates[i - 1]

    const sc = stockByDate.get(d)!
    const sp = stockByDate.get(prev)!
    const mc = mktByDate.get(d)!
    const mp = mktByDate.get(prev)!

    if (sp === 0 || mp === 0) continue

    stockR.push((sc - sp) / sp)
    mktR.push((mc - mp) / mp)
  }

  const n = stockR.length
  if (n < 5) return null

  const sMean = stockR.reduce((a, b) => a + b, 0) / n
  const mMean = mktR.reduce((a, b) => a + b, 0) / n

  let cov = 0
  let mVar = 0
  for (let i = 0; i < n; i++) {
    cov += (stockR[i] - sMean) * (mktR[i] - mMean)
    mVar += (mktR[i] - mMean) ** 2
  }

  if (mVar === 0) return null
  return cov / mVar
}

function betaLabel(beta: number): string {
  if (beta > 1.3) return "High volatility vs market"
  if (beta > 1.0) return "Slightly more volatile than market"
  if (beta >= 0.7) return "Moves broadly with market"
  return "Lower volatility than market"
}

function betaColor(beta: number): string {
  if (beta > 1.3) return "text-red-400"
  if (beta < 0.7) return "text-blue-400"
  return "text-foreground"
}

export function StockChart({ instrumentKey }: { instrumentKey: string }) {
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [niftyCandles, setNiftyCandles] = useState<Candle[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rangeIdx, setRangeIdx] = useState(1) // default 3M

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const days = RANGES[rangeIdx].days
    const toDate = new Date().toISOString().slice(0, 10)
    const fromDate = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10)

    const endpoint = (key: string) =>
      `/api/upstox/historical-candle?instrument_key=${encodeURIComponent(key)}&interval=day&from=${fromDate}&to=${toDate}`

    try {
      const [stockRes, niftyRes] = await Promise.all([
        fetch(endpoint(instrumentKey)),
        fetch(endpoint("NSE_INDEX|Nifty 50")),
      ])

      const [stockJson, niftyJson] = (await Promise.all([
        stockRes.json(),
        niftyRes.json(),
      ])) as [CandelApiResponse, CandelApiResponse]

      if (stockJson.error || !Array.isArray(stockJson.data?.candles)) {
        setError(stockJson.error ?? "No historical data available")
        setLoading(false)
        return
      }

      setCandles(stockJson.data!.candles as Candle[])

      if (!niftyJson.error && Array.isArray(niftyJson.data?.candles)) {
        setNiftyCandles(niftyJson.data!.candles as Candle[])
      }
    } catch {
      setError("Failed to load chart data")
    }

    setLoading(false)
  }, [instrumentKey, rangeIdx])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // Convert raw candles to chart-friendly points (sorted ascending)
  const chartData: ChartPoint[] = (candles ?? [])
    .slice()
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((c) => {
      const [, mm, dd] = c[0].slice(0, 10).split("-")
      const label = `${MONTHS[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}`
      return {
        date: label,
        close: c[4],
        open: c[1],
        high: c[2],
        low: c[3],
        volume: c[5],
      }
    })

  const beta =
    candles && niftyCandles ? computeBeta(candles, niftyCandles) : null

  const firstClose = chartData[0]?.close ?? 0
  const lastClose = chartData[chartData.length - 1]?.close ?? 0
  const totalReturn =
    firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0
  const isUp = totalReturn >= 0
  const lineColor = isUp ? "#10b981" : "#ef4444"

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-violet-400" />
            Price History
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Beta badge */}
            {beta !== null && (
              <Badge
                variant="outline"
                className={`text-xs ${betaColor(beta)} border-current/30`}
              >
                β {beta.toFixed(2)}
              </Badge>
            )}

            {/* Period return badge */}
            {!loading && !error && chartData.length > 0 && (
              <Badge
                className={`text-xs border ${
                  isUp
                    ? "bg-emerald-400/15 text-emerald-400 border-emerald-400/30"
                    : "bg-red-400/15 text-red-400 border-red-400/30"
                }`}
              >
                {isUp ? "+" : ""}
                {totalReturn.toFixed(2)}% ({RANGES[rangeIdx].label})
              </Badge>
            )}

            {/* Range selector buttons */}
            <div className="flex gap-0.5">
              {RANGES.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => setRangeIdx(i)}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    rangeIdx === i
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Skeleton className="h-52 w-full rounded-lg" />
        ) : error ? (
          <div className="h-52 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60">
            <Activity className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground text-center max-w-xs px-4">
              {error.toLowerCase().includes("token") ||
              error.toLowerCase().includes("connect") ||
              error.toLowerCase().includes("no upstox")
                ? "Connect Upstox in Settings to view price history"
                : "Price chart unavailable for this instrument"}
            </p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-52 flex items-center justify-center rounded-lg border border-dashed border-border/60">
            <p className="text-sm text-muted-foreground">
              No historical data in this period
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={208}>
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={lineColor}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={lineColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />

                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  tickFormatter={(v: number) =>
                    v >= 1_000
                      ? `₹${(v / 1_000).toFixed(1)}K`
                      : `₹${v.toFixed(0)}`
                  }
                  domain={["auto", "auto"]}
                />

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload as ChartPoint
                    return (
                      <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur px-3 py-2 shadow-xl text-xs space-y-0.5">
                        <p className="font-semibold text-foreground mb-1">
                          {label}
                        </p>
                        <p className="text-muted-foreground">
                          Close:{" "}
                          <span className="text-foreground font-medium">
                            ₹{d.close.toFixed(2)}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Open:{" "}
                          <span className="text-foreground">
                            ₹{d.open.toFixed(2)}
                          </span>
                        </p>
                        <p className="text-emerald-400">
                          H: ₹{d.high.toFixed(2)}
                        </p>
                        <p className="text-red-400">L: ₹{d.low.toFixed(2)}</p>
                        <p className="text-muted-foreground">
                          Vol:{" "}
                          <span className="text-foreground">
                            {d.volume.toLocaleString("en-IN")}
                          </span>
                        </p>
                      </div>
                    )
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={lineColor}
                  strokeWidth={1.5}
                  fill="url(#priceGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: lineColor }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Beta explanation row */}
            {beta !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium">Beta vs Nifty 50: </span>
                <span className={`font-semibold ${betaColor(beta)}`}>
                  {beta.toFixed(2)}
                </span>
                <span className="ml-1">— {betaLabel(beta)}</span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
