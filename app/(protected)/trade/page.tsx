"use client"

import { useState, useEffect, useCallback, Fragment } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, RefreshCw, TrendingUp, TrendingDown,
  CheckCircle2, X, Clock, Activity, Wifi,
  ChevronDown, ChevronRight, Zap, History, BarChart3, AlertCircle,
} from "lucide-react"
import type { NormalizedOrder, NormalizedTrade, OrderHistoryEntry } from "@/lib/providers"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface UpstoxHolding {
  trading_symbol: string
  company_name: string
  quantity: number
  average_price: number
  last_price: number
  pnl: number
  exchange: string
  isin: string
  instrument_token?: string
  day_change?: number
  day_change_percentage?: number
}

interface ProfileData { user_name: string; email: string }

interface Order {
  id: string
  instrument_key: string
  side: "BUY" | "SELL"
  quantity: number
  price: number
  status: string
  created_at: string
  meta?: Record<string, unknown>
}

type QuickRange = "1w" | "1m" | "3m" | "6m" | "1y" | "custom"

/* ─── Quick date helper ─────────────────────────────────────────────────── */

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfRange(range: QuickRange): { from: string; to: string } {
  const now = new Date()
  const to = isoDate(now)
  const d = new Date()
  switch (range) {
    case "1w": d.setDate(d.getDate() - 7);   break
    case "1m": d.setMonth(d.getMonth() - 1); break
    case "3m": d.setMonth(d.getMonth() - 3); break
    case "6m": d.setMonth(d.getMonth() - 6); break
    case "1y": d.setFullYear(d.getFullYear() - 1); break
    default:   d.setMonth(d.getMonth() - 1); break
  }
  return { from: isoDate(d), to }
}

const CACHE_KEY = "trade_live_holdings"
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function TradePage() {
  const [loading, setLoading] = useState(false)
  const [holdings, setHoldings] = useState<UpstoxHolding[]>([])
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [error, setError] = useState("")
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)

  // Order history
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [quickRange, setQuickRange] = useState<QuickRange>("1m")
  const [dateFrom, setDateFrom] = useState(() => startOfRange("1m").from)
  const [dateTo, setDateTo] = useState(() => isoDate(new Date()))

  // Order form
  const [orderForm, setOrderForm] = useState<{
    instrument_key: string
    trading_symbol: string
    quantity: string
    side: "BUY" | "SELL"
    order_type: "MARKET" | "LIMIT"
    price: string
  } | null>(null)
  const [placing, setPlacing] = useState(false)
  const [orderResult, setOrderResult] = useState<{
    success: boolean; message: string; order_id?: string
  } | null>(null)

  // Today's live order / trade book (from broker API — current session only)
  const [historyTab, setHistoryTab] = useState<"today" | "history">("today")
  const [providerSource] = useState("upstox")
  const [liveOrders, setLiveOrders] = useState<NormalizedOrder[]>([])
  const [liveTrades, setLiveTrades] = useState<NormalizedTrade[]>([])
  const [liveOrdersLoading, setLiveOrdersLoading] = useState(false)
  const [liveTradesLoading, setLiveTradesLoading] = useState(false)
  const [liveError, setLiveError] = useState("")
  // Order lifecycle (timeline steps) — keyed by order_id
  const [orderLifecycle, setOrderLifecycle] = useState<Record<string, OrderHistoryEntry[]>>({})
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [lifecycleLoading, setLifecycleLoading] = useState<string | null>(null)

  /* ── Restore cached holdings on mount ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const { data, profile: cachedProfile, ts } = JSON.parse(raw) as {
          data: UpstoxHolding[]; profile: ProfileData | null; ts: number
        }
        if (Date.now() - ts < CACHE_TTL_MS && data.length > 0) {
          setHoldings(data)
          setProfile(cachedProfile)
          setLastRefresh(new Date(ts))
          setFromCache(true)
        }
      }
    } catch { /* ignore */ }
  }, [])

  /* ── Load orders on mount + when date range changes ── */
  const loadOrders = useCallback(async (from: string, to: string) => {
    setOrdersLoading(true)
    try {
      const res = await fetch(`/api/orders/history?limit=200&from=${from}&to=${to}`)
      const data = await res.json()
      if (res.ok && data.status === "success") setOrders(data.data || [])
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders(dateFrom, dateTo) }, [dateFrom, dateTo, loadOrders])

  /* ── Load today's live order book from the broker ── */
  const loadLiveOrderBook = useCallback(async () => {
    setLiveOrdersLoading(true)
    setLiveError("")
    try {
      const res  = await fetch(`/api/trade/order-book?source=${providerSource}`)
      const data = await res.json()
      if (res.ok && data.status === "success") setLiveOrders(data.data || [])
      else setLiveError(data.message || "Failed to load today's orders from broker.")
    } catch {
      setLiveError("Could not reach broker API. Verify your connection in Settings.")
    }
    setLiveOrdersLoading(false)
  }, [providerSource])

  /* ── Load today's live trade book from the broker ── */
  const loadLiveTradeBook = useCallback(async () => {
    setLiveTradesLoading(true)
    try {
      const res  = await fetch(`/api/trade/trade-book?source=${providerSource}`)
      const data = await res.json()
      if (res.ok && data.status === "success") setLiveTrades(data.data || [])
    } catch { /* silent */ }
    setLiveTradesLoading(false)
  }, [providerSource])

  /* ── Auto-load live data when Today tab is first shown ── */
  useEffect(() => {
    if (historyTab === "today") {
      loadLiveOrderBook()
      loadLiveTradeBook()
    }
  }, [historyTab, loadLiveOrderBook, loadLiveTradeBook])

  /* ── Load / toggle lifecycle for one live order ── */
  async function loadOrderLifecycle(orderId: string) {
    // If already loaded, toggle collapse
    if (orderLifecycle[orderId]) {
      setExpandedOrderId((prev) => (prev === orderId ? null : orderId))
      return
    }
    setLifecycleLoading(orderId)
    setExpandedOrderId(orderId)
    try {
      const res  = await fetch(`/api/trade/order-history?order_id=${encodeURIComponent(orderId)}&source=${providerSource}`)
      const data = await res.json()
      if (res.ok && data.status === "success") {
        setOrderLifecycle((prev) => ({ ...prev, [orderId]: data.data || [] }))
      }
    } catch { /* silent */ }
    setLifecycleLoading(null)
  }

  /* ── Fetch live holdings ── */
  const fetchHoldings = useCallback(async () => {
    setLoading(true)
    setError("")
    setFromCache(false)
    try {
      const [profileRes, holdingsRes] = await Promise.all([
        fetch("/api/upstox/profile"),
        fetch("/api/upstox/holdings"),
      ])
      const profileData = await profileRes.json()
      const holdingsData = await holdingsRes.json()

      const prof = profileRes.ok && profileData.status === "success" ? profileData.data : null
      if (prof) setProfile(prof)

      if (holdingsRes.ok && holdingsData.status === "success") {
        const data: UpstoxHolding[] = holdingsData.data || []
        setHoldings(data)
        const ts = Date.now()
        setLastRefresh(new Date(ts))
        // Persist in localStorage
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data, profile: prof, ts }))
        } catch { /* ignore storage errors */ }
      } else {
        setError(holdingsData.message || "Failed to load holdings from Upstox.")
      }
    } catch {
      setError("Could not reach Upstox API. Verify your access token in Settings.")
    }
    setLoading(false)
  }, [])

  /* ── Quick range selector ── */
  function applyQuickRange(range: QuickRange) {
    setQuickRange(range)
    if (range !== "custom") {
      const { from, to } = startOfRange(range)
      setDateFrom(from)
      setDateTo(to)
    }
  }

  /* ── Place order ── */
  async function placeOrder() {
    if (!orderForm) return
    setPlacing(true)
    setOrderResult(null)
    try {
      const res = await fetch("/api/orders/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument_key: orderForm.instrument_key,
          trading_symbol: orderForm.trading_symbol,
          quantity: Number(orderForm.quantity),
          side: orderForm.side,
          order_type: orderForm.order_type,
          price: orderForm.order_type === "LIMIT" ? Number(orderForm.price) : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.status === "success") {
        setOrderResult({ success: true, message: data.message, order_id: data.order_id })
        loadOrders(dateFrom, dateTo)
      } else {
        setOrderResult({ success: false, message: data.message || "Order failed" })
      }
    } catch {
      setOrderResult({ success: false, message: "Network error. Please retry." })
    }
    setPlacing(false)
  }

  function openOrderForm(h: UpstoxHolding, side: "BUY" | "SELL") {
    setOrderResult(null)
    setOrderForm({
      instrument_key: h.instrument_token || h.isin || h.trading_symbol,
      trading_symbol: h.trading_symbol,
      quantity: "1",
      side,
      order_type: "MARKET",
      price: h.last_price?.toFixed(2) ?? "0",
    })
  }

  function orderStatusBadge(status: string) {
    const s = (status || "").toLowerCase()
    if (s === "complete" || s === "filled" || s === "placed")
      return <Badge variant="success" className="text-xs">{status}</Badge>
    if (s === "rejected" || s === "cancelled" || s === "failed")
      return <Badge variant="destructive" className="text-xs">{status}</Badge>
    return <Badge variant="secondary" className="text-xs">{status}</Badge>
  }

  /* ── Render ── */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Trade
            <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 border border-emerald-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </h1>
          <p className="text-muted-foreground mt-0.5">
            Execute orders on your live Upstox portfolio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              {fromCache ? "Cached · " : ""}
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchHoldings} disabled={loading} variant="outline" size="sm">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{loading ? "Loading…" : holdings.length ? "Refresh" : "Load live data"}</span>
          </Button>
        </div>
      </div>

      {/* Connection status */}
      {profile && (
        <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border bg-muted/30">
          <Wifi className="h-4 w-4 text-emerald-400" />
          <span className="font-medium text-emerald-400">Connected:</span>
          <span className="text-muted-foreground">{profile.user_name} ({profile.email})</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md px-4 py-3 text-sm flex items-start gap-2">
          <X className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Connection error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Live holdings table */}
      {holdings.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Live Holdings
            </CardTitle>
            <CardDescription>{holdings.length} positions · click Buy or Sell to trade</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-4 font-medium">Symbol</th>
                    <th className="text-right py-2 px-2 font-medium">Qty</th>
                    <th className="text-right py-2 px-2 font-medium hidden md:table-cell">Avg Price</th>
                    <th className="text-right py-2 px-2 font-medium">LTP</th>
                    <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Day Chg%</th>
                    <th className="text-right py-2 px-2 font-medium">P&amp;L</th>
                    <th className="text-right py-2 pl-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const dayChg = h.day_change_percentage || 0
                    return (
                      <tr key={h.trading_symbol} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="font-semibold">{h.trading_symbol}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                            {h.company_name}
                          </div>
                        </td>
                        <td className="text-right py-2.5 px-2 tabular-nums">{h.quantity}</td>
                        <td className="text-right py-2.5 px-2 tabular-nums hidden md:table-cell">
                          ₹{h.average_price?.toFixed(2)}
                        </td>
                        <td className="text-right py-2.5 px-2 tabular-nums font-medium">
                          ₹{h.last_price?.toFixed(2)}
                        </td>
                        <td className={`text-right py-2.5 px-2 text-xs tabular-nums hidden sm:table-cell ${
                          dayChg >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {dayChg !== 0 ? `${dayChg >= 0 ? "+" : ""}${dayChg.toFixed(2)}%` : "—"}
                        </td>
                        <td className={`text-right py-2.5 px-2 ${(h.pnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          <span className="tabular-nums">{(h.pnl || 0) >= 0 ? "+" : ""}{formatCurrency(h.pnl || 0)}</span>
                        </td>
                        <td className="text-right py-2.5 pl-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm" variant="outline"
                              className="h-7 px-2 text-emerald-400 border-emerald-400/40 hover:bg-emerald-400/10 hover:border-emerald-400"
                              onClick={() => openOrderForm(h, "BUY")}
                            >
                              <TrendingUp className="h-3 w-3 mr-1" /> Buy
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              className="h-7 px-2 text-red-400 border-red-400/40 hover:bg-red-400/10 hover:border-red-400"
                              onClick={() => openOrderForm(h, "SELL")}
                            >
                              <TrendingDown className="h-3 w-3 mr-1" /> Sell
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : !loading && !error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No live data loaded</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click <strong>Load live data</strong> to fetch your current positions from Upstox.
            </p>
            <Button onClick={fetchHoldings} disabled={loading} className="mt-4">
              Load live data
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Orders (Today + History tabs) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Orders
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400 text-xs font-medium border border-violet-400/20">
                  <Zap className="h-2.5 w-2.5" />
                  {providerSource.charAt(0).toUpperCase() + providerSource.slice(1)}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {historyTab === "today" ? "Live session data" : "Your stored order ledger"}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {historyTab === "today" && (
                <Button size="sm" variant="ghost"
                  onClick={() => { loadLiveOrderBook(); loadLiveTradeBook() }}
                  disabled={liveOrdersLoading}>
                  {liveOrdersLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              )}
              {historyTab === "history" && (
                <Button size="sm" variant="ghost"
                  onClick={() => loadOrders(dateFrom, dateTo)}
                  disabled={ordersLoading}>
                  {ordersLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 mt-3 p-0.5 bg-muted rounded-lg w-fit">
            {([
              { id: "today",   label: "Today",   icon: <Zap     className="h-3 w-3" /> },
              { id: "history", label: "History", icon: <History className="h-3 w-3" /> },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHistoryTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                  historyTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Date filters — only visible on History tab */}
          {historyTab === "history" && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                {(["1w", "1m", "3m", "6m", "1y"] as QuickRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => applyQuickRange(r)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      quickRange === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {r === "1w" ? "1 Week" : r === "1m" ? "1 Month" : r === "3m" ? "3 Months" : r === "6m" ? "6 Months" : "1 Year"}
                  </button>
                ))}
                <button
                  onClick={() => setQuickRange("custom")}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    quickRange === "custom"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Custom
                </button>
              </div>

              {quickRange === "custom" && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="date" value={dateFrom} max={dateTo}
                    className="h-8 text-xs w-36"
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date" value={dateTo} min={dateFrom} max={isoDate(new Date())}
                    className="h-8 text-xs w-36"
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs"
                    onClick={() => loadOrders(dateFrom, dateTo)}>
                    Apply
                  </Button>
                </div>
              )}
            </>
          )}
        </CardHeader>

        <CardContent>

          {/* ── TODAY TAB — live session data from broker ── */}
          {historyTab === "today" && (
            <div className="space-y-8">

              {/* Error banner */}
              {liveError && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {liveError}
                </div>
              )}

              {/* Live Order Book */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  Order Book
                  {liveOrdersLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {!liveOrdersLoading && liveOrders.length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">({liveOrders.length})</span>
                  )}
                </h3>

                {!liveOrdersLoading && liveOrders.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {liveError ? "Could not load orders." : "No orders placed in today\u2019s session."}{" "}
                    <button className="underline underline-offset-2 hover:text-foreground"
                      onClick={loadLiveOrderBook}>
                      Refresh
                    </button>
                  </p>
                )}

                {liveOrders.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="w-5" />
                          <th className="text-left py-2 pr-4 font-medium">Symbol</th>
                          <th className="text-right py-2 px-2 font-medium">Side</th>
                          <th className="text-right py-2 px-2 font-medium">Qty</th>
                          <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Filled</th>
                          <th className="text-right py-2 px-2 font-medium hidden md:table-cell">Price</th>
                          <th className="text-right py-2 px-2 font-medium">Status</th>
                          <th className="text-right py-2 pl-2 font-medium hidden md:table-cell">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveOrders.map((o) => (
                          <Fragment key={o.order_id}>
                            <tr
                              className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => loadOrderLifecycle(o.order_id)}
                            >
                              <td className="py-2.5 pr-1 text-muted-foreground">
                                {lifecycleLoading === o.order_id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : expandedOrderId === o.order_id
                                    ? <ChevronDown className="h-3 w-3" />
                                    : <ChevronRight className="h-3 w-3" />}
                              </td>
                              <td className="py-2.5 pr-4 font-medium">{o.trading_symbol}</td>
                              <td className="text-right py-2.5 px-2">
                                <span className={`text-xs font-bold ${o.transaction_type === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                                  {o.transaction_type}
                                </span>
                              </td>
                              <td className="text-right py-2.5 px-2 tabular-nums">{o.quantity}</td>
                              <td className="text-right py-2.5 px-2 tabular-nums hidden sm:table-cell text-muted-foreground text-xs">
                                {o.filled_quantity}/{o.quantity}
                              </td>
                              <td className="text-right py-2.5 px-2 tabular-nums hidden md:table-cell">
                                {o.price > 0 ? `₹${o.price}` : "Market"}
                              </td>
                              <td className="text-right py-2.5 px-2">{orderStatusBadge(o.status)}</td>
                              <td className="text-right py-2.5 pl-2 text-xs text-muted-foreground hidden md:table-cell">
                                {new Date(o.order_timestamp).toLocaleTimeString("en-IN", {
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </td>
                            </tr>

                            {/* Lifecycle timeline (expandable) */}
                            {expandedOrderId === o.order_id && orderLifecycle[o.order_id] && (
                              <tr className="bg-muted/20">
                                <td colSpan={8} className="px-4 py-3">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Order Timeline
                                  </p>
                                  <ol className="relative border-l border-border ml-2 space-y-3">
                                    {orderLifecycle[o.order_id].map((step, i) => (
                                      <li key={i} className="pl-4 relative">
                                        <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-background bg-violet-500" />
                                        <p className="text-xs font-semibold capitalize">
                                          {step.status.replace(/_/g, " ")}
                                        </p>
                                        {step.status_message && (
                                          <p className="text-xs text-muted-foreground">{step.status_message}</p>
                                        )}
                                        {step.filled_quantity > 0 && (
                                          <p className="text-xs text-muted-foreground">
                                            Filled: {step.filled_quantity} · Avg: ₹{step.average_price}
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                                          {new Date(step.order_timestamp).toLocaleTimeString("en-IN")}
                                        </p>
                                      </li>
                                    ))}
                                  </ol>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Live Trade Book */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Executed Trades
                  {liveTradesLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {!liveTradesLoading && liveTrades.length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">({liveTrades.length})</span>
                  )}
                </h3>

                {!liveTradesLoading && liveTrades.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No trades executed in today&apos;s session.
                  </p>
                )}

                {liveTrades.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="text-left py-2 pr-4 font-medium">Symbol</th>
                          <th className="text-right py-2 px-2 font-medium">Side</th>
                          <th className="text-right py-2 px-2 font-medium">Qty</th>
                          <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Avg Price</th>
                          <th className="text-right py-2 pl-2 font-medium hidden md:table-cell">Exchange Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveTrades.map((t) => (
                          <tr key={t.trade_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 pr-4 font-medium">{t.trading_symbol}</td>
                            <td className="text-right py-2.5 px-2">
                              <span className={`text-xs font-bold ${t.transaction_type === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                                {t.transaction_type}
                              </span>
                            </td>
                            <td className="text-right py-2.5 px-2 tabular-nums">{t.quantity}</td>
                            <td className="text-right py-2.5 px-2 tabular-nums hidden sm:table-cell">
                              ₹{t.average_price?.toFixed(2)}
                            </td>
                            <td className="text-right py-2.5 pl-2 text-xs text-muted-foreground hidden md:table-cell">
                              {t.exchange_timestamp
                                ? new Date(t.exchange_timestamp).toLocaleTimeString("en-IN", {
                                    hour: "2-digit", minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── HISTORY TAB — past orders from Supabase ── */}
          {historyTab === "history" && (
            <>
              {ordersLoading && orders.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : orders.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No orders found for the selected period.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="text-left py-2 pr-4 font-medium">Symbol</th>
                          <th className="text-right py-2 px-2 font-medium">Side</th>
                          <th className="text-right py-2 px-2 font-medium">Qty</th>
                          <th className="text-right py-2 px-2 font-medium hidden sm:table-cell">Price</th>
                          <th className="text-right py-2 px-2 font-medium">Status</th>
                          <th className="text-right py-2 pl-2 font-medium hidden md:table-cell">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => {
                          const sym = (o.meta as Record<string, string>)?.trading_symbol || o.instrument_key
                          return (
                            <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 pr-4 font-medium">{sym}</td>
                              <td className="text-right py-2.5 px-2">
                                <span className={`text-xs font-bold ${o.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                                  {o.side}
                                </span>
                              </td>
                              <td className="text-right py-2.5 px-2 tabular-nums">{o.quantity}</td>
                              <td className="text-right py-2.5 px-2 tabular-nums hidden sm:table-cell">
                                {o.price ? `₹${o.price}` : "Market"}
                              </td>
                              <td className="text-right py-2.5 px-2">{orderStatusBadge(o.status)}</td>
                              <td className="text-right py-2.5 pl-2 text-xs text-muted-foreground hidden md:table-cell">
                                {new Date(o.created_at).toLocaleString("en-IN", {
                                  day: "numeric", month: "short",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-right">
                    {orders.length} order{orders.length !== 1 ? "s" : ""} · {dateFrom} to {dateTo}
                  </p>
                </>
              )}
            </>
          )}

        </CardContent>
      </Card>

      {/* ── Order placement modal ── */}
      {orderForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      orderForm.side === "BUY" ? "bg-emerald-400/15 text-emerald-400" : "bg-red-400/15 text-red-400"
                    }`}
                  >
                    {orderForm.side}
                  </span>
                  {orderForm.trading_symbol}
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => { setOrderForm(null); setOrderResult(null) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>Review and confirm your order</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {orderResult ? (
                <>
                  <div className={`rounded-md px-4 py-3 flex items-start gap-3 ${
                    orderResult.success ? "bg-emerald-400/10 text-emerald-300" : "bg-destructive/10 text-destructive"
                  }`}>
                    {orderResult.success
                      ? <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                      : <X className="h-5 w-5 shrink-0 mt-0.5" />}
                    <div>
                      <p className="font-medium">{orderResult.success ? "Order Submitted" : "Order Failed"}</p>
                      <p className="text-sm mt-0.5">{orderResult.message}</p>
                      {orderResult.order_id && (
                        <p className="text-xs mt-1 font-mono opacity-70">ID: {orderResult.order_id}</p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full"
                    onClick={() => { setOrderForm(null); setOrderResult(null) }}>
                    Close
                  </Button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                      <Input type="number" min="1" value={orderForm.quantity}
                        onChange={(e) => setOrderForm((p) => p ? { ...p, quantity: e.target.value } : null)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Order Type</label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        value={orderForm.order_type}
                        onChange={(e) => setOrderForm((p) => p ? { ...p, order_type: e.target.value as "MARKET" | "LIMIT" } : null)}
                      >
                        <option value="MARKET">MARKET</option>
                        <option value="LIMIT">LIMIT</option>
                      </select>
                    </div>
                  </div>

                  {orderForm.order_type === "LIMIT" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Limit Price (₹)</label>
                      <Input type="number" step="0.05" value={orderForm.price}
                        onChange={(e) => setOrderForm((p) => p ? { ...p, price: e.target.value } : null)} />
                    </div>
                  )}

                  <div className="bg-muted/50 rounded-md px-3 py-3 text-sm space-y-1.5">
                    {[
                      ["Side",     <span key="s" className={`font-bold ${orderForm.side === "BUY" ? "text-green-700" : "text-red-600"}`}>{orderForm.side}</span>],
                      ["Symbol",   orderForm.trading_symbol],
                      ["Quantity", orderForm.quantity],
                      ["Type",     orderForm.order_type],
                      ...(orderForm.order_type === "LIMIT" ? [["Limit", `₹${orderForm.price}`]] : []),
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1"
                      onClick={() => { setOrderForm(null); setOrderResult(null) }}>
                      Cancel
                    </Button>
                    <Button
                      className={`flex-1 font-semibold ${
                        orderForm.side === "BUY" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                      }`}
                      onClick={placeOrder}
                      disabled={placing || !orderForm.quantity || Number(orderForm.quantity) < 1}
                    >
                      {placing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Confirm {orderForm.side}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
