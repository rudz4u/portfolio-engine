"use client"

import { useState, useEffect, useCallback } from "react"
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
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  X,
  Clock,
  Activity,
  Wifi,
} from "lucide-react"
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

/* ─── Main page ─────────────────────────────────────────────────────────── */

export default function TradePage() {
  const [loading, setLoading] = useState(false)
  const [holdings, setHoldings] = useState<UpstoxHolding[]>([])
  const [profile, setProfile] = useState<{ user_name: string; email: string } | null>(null)
  const [error, setError] = useState("")
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Order history
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

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
    success: boolean
    message: string
    order_id?: string
  } | null>(null)

  /* ── Fetch live holdings ── */
  const loadHoldings = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [profileRes, holdingsRes] = await Promise.all([
        fetch("/api/upstox/profile"),
        fetch("/api/upstox/holdings"),
      ])
      const profileData = await profileRes.json()
      const holdingsData = await holdingsRes.json()

      if (profileRes.ok && profileData.status === "success") {
        setProfile(profileData.data)
      }
      if (holdingsRes.ok && holdingsData.status === "success") {
        setHoldings(holdingsData.data || [])
        setLastRefresh(new Date())
      } else {
        setError(holdingsData.message || "Failed to load holdings")
      }
    } catch {
      setError("Could not connect to Upstox. Check your access token in Settings.")
    }
    setLoading(false)
  }, [])

  /* ── Fetch order history ── */
  const loadOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await fetch("/api/orders/history?limit=20")
      const data = await res.json()
      if (res.ok && data.status === "success") {
        setOrders(data.data || [])
      }
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  // Load orders on mount
  useEffect(() => {
    loadOrders()
  }, [loadOrders])

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
        loadOrders() // refresh order history
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

  /* ── Status badge for orders ── */
  function orderStatusBadge(status: string) {
    const s = status?.toLowerCase()
    if (s === "complete" || s === "filled")
      return <Badge variant="success" className="text-xs">{status}</Badge>
    if (s === "rejected" || s === "cancelled")
      return <Badge variant="destructive" className="text-xs">{status}</Badge>
    return <Badge variant="secondary" className="text-xs">{status}</Badge>
  }

  /* ── Render ── */
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Trade
            <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </h1>
          <p className="text-muted-foreground mt-0.5">
            Execute orders and monitor your live Upstox portfolio in real time.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={loadHoldings} disabled={loading} variant="outline" size="sm">
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{loading ? "Loading…" : "Load live data"}</span>
          </Button>
        </div>
      </div>

      {/* Connection status */}
      {profile && (
        <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border bg-muted/30">
          <Wifi className="h-4 w-4 text-green-600" />
          <span className="font-medium text-green-700">Connected:</span>
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

      {/* Live holdings */}
      {holdings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Live Holdings
                </CardTitle>
                <CardDescription>{holdings.length} positions from Upstox</CardDescription>
              </div>
            </div>
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
                        <td className={`text-right py-2.5 px-2 tabular-nums text-xs hidden sm:table-cell ${
                          dayChg >= 0 ? "text-green-600" : "text-red-500"
                        }`}>
                          {dayChg !== 0 ? `${dayChg >= 0 ? "+" : ""}${dayChg.toFixed(2)}%` : "—"}
                        </td>
                        <td className={`text-right py-2.5 px-2 ${(h.pnl || 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                          <span className="tabular-nums">
                            {(h.pnl || 0) >= 0 ? "+" : ""}{formatCurrency(h.pnl || 0)}
                          </span>
                        </td>
                        <td className="text-right py-2.5 pl-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-green-700 border-green-300 hover:bg-green-50 hover:border-green-400"
                              onClick={() => openOrderForm(h, "BUY")}
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Buy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-red-700 border-red-300 hover:bg-red-50 hover:border-red-400"
                              onClick={() => openOrderForm(h, "SELL")}
                            >
                              <TrendingDown className="h-3 w-3 mr-1" />
                              Sell
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
      )}

      {!holdings.length && !loading && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No live data loaded</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click &ldquo;Load live data&rdquo; to fetch your current positions from Upstox.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Order history */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Order History
              </CardTitle>
              <CardDescription>Recent orders placed via this platform</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={loadOrders} disabled={ordersLoading}>
              {ordersLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ordersLoading && orders.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              No orders placed yet. Use the Buy / Sell buttons above.
            </p>
          ) : (
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
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">{o.instrument_key}</td>
                      <td className="text-right py-2.5 px-2">
                        <span className={`text-xs font-semibold ${o.side === "BUY" ? "text-green-700" : "text-red-600"}`}>
                          {o.side}
                        </span>
                      </td>
                      <td className="text-right py-2.5 px-2 tabular-nums">{o.quantity}</td>
                      <td className="text-right py-2.5 px-2 tabular-nums hidden sm:table-cell">
                        {o.price ? `₹${o.price}` : "Market"}
                      </td>
                      <td className="text-right py-2.5 px-2">
                        {orderStatusBadge(o.status)}
                      </td>
                      <td className="text-right py-2.5 pl-2 text-xs text-muted-foreground hidden md:table-cell">
                        {new Date(o.created_at).toLocaleString("en-IN", {
                          day: "numeric", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                      orderForm.side === "BUY"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {orderForm.side}
                  </span>
                  {orderForm.trading_symbol}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => { setOrderForm(null); setOrderResult(null) }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>Review and confirm your order</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {orderResult ? (
                <>
                  <div
                    className={`rounded-md px-4 py-3 flex items-start gap-3 ${
                      orderResult.success
                        ? "bg-green-50 text-green-800"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {orderResult.success
                      ? <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                      : <X className="h-5 w-5 shrink-0 mt-0.5" />}
                    <div>
                      <p className="font-medium">
                        {orderResult.success ? "Order Submitted" : "Order Failed"}
                      </p>
                      <p className="text-sm mt-0.5">{orderResult.message}</p>
                      {orderResult.order_id && (
                        <p className="text-xs mt-1 font-mono opacity-70">
                          Order ID: {orderResult.order_id}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => { setOrderForm(null); setOrderResult(null) }}>
                    Close
                  </Button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                      <Input
                        type="number"
                        min="1"
                        value={orderForm.quantity}
                        onChange={(e) => setOrderForm((p) => p ? { ...p, quantity: e.target.value } : null)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Order Type</label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        value={orderForm.order_type}
                        onChange={(e) =>
                          setOrderForm((p) => p ? { ...p, order_type: e.target.value as "MARKET" | "LIMIT" } : null)
                        }
                      >
                        <option value="MARKET">MARKET</option>
                        <option value="LIMIT">LIMIT</option>
                      </select>
                    </div>
                  </div>

                  {orderForm.order_type === "LIMIT" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Limit Price (₹)</label>
                      <Input
                        type="number"
                        step="0.05"
                        value={orderForm.price}
                        onChange={(e) => setOrderForm((p) => p ? { ...p, price: e.target.value } : null)}
                      />
                    </div>
                  )}

                  {/* Order summary */}
                  <div className="bg-muted/50 rounded-md px-3 py-3 text-sm space-y-1.5">
                    {[
                      ["Side", <span key="s" className={`font-bold ${orderForm.side === "BUY" ? "text-green-700" : "text-red-600"}`}>{orderForm.side}</span>],
                      ["Symbol", orderForm.trading_symbol],
                      ["Quantity", orderForm.quantity],
                      ["Type", orderForm.order_type],
                      ...(orderForm.order_type === "LIMIT" ? [["Limit", `₹${orderForm.price}`]] : []),
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setOrderForm(null); setOrderResult(null) }}>
                      Cancel
                    </Button>
                    <Button
                      className={`flex-1 font-semibold ${
                        orderForm.side === "BUY"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
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
