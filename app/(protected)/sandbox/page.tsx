"use client"

import { useState } from "react"
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
  ShoppingCart,
  X,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"

interface UpstoxHolding {
  trading_symbol: string
  company_name: string
  quantity: number
  average_price: number
  last_price: number
  pnl: number
  exchange: string
  isin: string
}

export default function SandboxPage() {
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [upstoxHoldings, setUpstoxHoldings] = useState<UpstoxHolding[]>([])
  const [profile, setProfile] = useState<{ user_name: string; email: string } | null>(null)
  const [error, setError] = useState("")
  const [syncMsg, setSyncMsg] = useState("")

  // Order form state
  const [orderForm, setOrderForm] = useState<{
    instrument_key: string
    trading_symbol: string
    quantity: string
    side: "BUY" | "SELL"
    order_type: "MARKET" | "LIMIT"
    price: string
  } | null>(null)
  const [ordering, setOrdering] = useState(false)
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string; order_id?: string } | null>(null)

  async function loadFromUpstox() {
    setLoading(true)
    setError("")
    try {
      // Load profile
      const profileRes = await fetch("/api/upstox/profile")
      const profileData = await profileRes.json()
      if (profileRes.ok && profileData.status === "success") {
        setProfile(profileData.data)
      }

      // Load live holdings from Upstox
      const holdingsRes = await fetch("/api/upstox/holdings")
      const holdingsData = await holdingsRes.json()
      if (holdingsRes.ok && holdingsData.status === "success") {
        setUpstoxHoldings(holdingsData.data || [])
      } else {
        setError(holdingsData.message || "Failed to load holdings from Upstox")
      }
    } catch (e) {
      setError("Could not connect to Upstox API. Check your access token in Settings.")
    }
    setLoading(false)
  }

  async function syncToDatabase() {
    setSyncing(true)
    setSyncMsg("")
    try {
      const res = await fetch("/api/upstox/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setSyncMsg(`✅ Synced ${data.count} holdings to your portfolio database.`)
      } else {
        setError(data.message || "Sync failed")
      }
    } catch {
      setError("Sync request failed")
    }
    setSyncing(false)
  }

  function openOrderForm(h: UpstoxHolding, side: "BUY" | "SELL") {
    setOrderResult(null)
    setOrderForm({
      instrument_key: h.isin || h.trading_symbol,
      trading_symbol: h.trading_symbol,
      quantity: "1",
      side,
      order_type: "MARKET",
      price: h.last_price?.toFixed(2) ?? "0",
    })
  }

  async function placeOrder() {
    if (!orderForm) return
    setOrdering(true)
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
        setOrderResult({
          success: true,
          message: data.message,
          order_id: data.order_id,
        })
      } else {
        setOrderResult({ success: false, message: data.message || "Order failed" })
      }
    } catch {
      setOrderResult({ success: false, message: "Network error placing order" })
    }
    setOrdering(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upstox Sandbox</h1>
        <p className="text-muted-foreground">
          Test your Upstox connection, view live holdings, and sync data to your portfolio
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Sandbox Mode Active</p>
          <p className="text-sm text-amber-700 mt-1">
            All orders placed here are test orders. Real money is not at risk. Toggle in Settings.
          </p>
        </div>
      </div>

      {/* Connection panel */}
      <Card>
        <CardHeader>
          <CardTitle>Upstox Connection</CardTitle>
          <CardDescription>
            Load your live portfolio data from Upstox API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile && (
            <div className="flex items-center gap-2">
              <Badge variant="success">Connected</Badge>
              <span className="text-sm text-muted-foreground">
                {profile.user_name} ({profile.email})
              </span>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm flex items-center gap-2">
              <X className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {syncMsg && (
            <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
              {syncMsg}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={loadFromUpstox} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Load from Upstox
            </Button>

            {upstoxHoldings.length > 0 && (
              <Button
                variant="outline"
                onClick={syncToDatabase}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="mr-2 h-4 w-4" />
                )}
                Sync to Portfolio DB ({upstoxHoldings.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live holdings from Upstox */}
      {upstoxHoldings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Live Holdings from Upstox</CardTitle>
            <CardDescription>
              {upstoxHoldings.length} holdings fetched from Upstox API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Symbol</th>
                    <th className="text-right py-2 px-2 font-medium">Qty</th>
                    <th className="text-right py-2 px-2 font-medium">Avg Price</th>
                    <th className="text-right py-2 px-2 font-medium">LTP</th>
                    <th className="text-right py-2 px-2 font-medium">P&amp;L</th>
                    <th className="text-right py-2 pl-2 font-medium">Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {upstoxHoldings.map((h) => (
                    <tr
                      key={h.trading_symbol}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="py-2.5 pr-4">
                        <div className="font-medium">{h.trading_symbol}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                          {h.company_name}
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-2">{h.quantity}</td>
                      <td className="text-right py-2.5 px-2">
                        ₹{h.average_price?.toFixed(2)}
                      </td>
                      <td className="text-right py-2.5 px-2">
                        ₹{h.last_price?.toFixed(2)}
                      </td>
                      <td
                        className={`text-right py-2.5 px-2 ${
                          (h.pnl || 0) >= 0 ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {(h.pnl || 0) >= 0 ? "+" : ""}
                        {formatCurrency(h.pnl || 0)}
                      </td>
                      <td className="text-right py-2.5 pl-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => openOrderForm(h, "BUY")}
                          >
                            <TrendingUp className="h-3.5 w-3.5 mr-1" />
                            Buy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => openOrderForm(h, "SELL")}
                          >
                            <TrendingDown className="h-3.5 w-3.5 mr-1" />
                            Sell
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Order confirmation dialog */}
      {orderForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold px-2 py-0.5 rounded ${
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
                  className="h-8 w-8 p-0"
                  onClick={() => { setOrderForm(null); setOrderResult(null) }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>Confirm sandbox test order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderResult ? (
                <div
                  className={`rounded-md px-4 py-3 flex items-start gap-3 ${
                    orderResult.success
                      ? "bg-green-50 text-green-800"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {orderResult.success ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-5 w-5 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">
                      {orderResult.success ? "Order Submitted" : "Order Failed"}
                    </p>
                    <p className="text-sm mt-0.5">{orderResult.message}</p>
                    {orderResult.order_id && (
                      <p className="text-xs mt-1 font-mono opacity-70">
                        ID: {orderResult.order_id}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Quantity
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={orderForm.quantity}
                        onChange={(e) =>
                          setOrderForm((prev) => prev ? { ...prev, quantity: e.target.value } : null)
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Order Type
                      </label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                        value={orderForm.order_type}
                        onChange={(e) =>
                          setOrderForm((prev) =>
                            prev ? { ...prev, order_type: e.target.value as "MARKET" | "LIMIT" } : null
                          )
                        }
                      >
                        <option value="MARKET">MARKET</option>
                        <option value="LIMIT">LIMIT</option>
                      </select>
                    </div>
                  </div>

                  {orderForm.order_type === "LIMIT" && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Limit Price (₹)
                      </label>
                      <Input
                        type="number"
                        step="0.05"
                        value={orderForm.price}
                        onChange={(e) =>
                          setOrderForm((prev) => prev ? { ...prev, price: e.target.value } : null)
                        }
                      />
                    </div>
                  )}

                  <div className="bg-muted/50 rounded-md px-3 py-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Side</span>
                      <span
                        className={`font-semibold ${orderForm.side === "BUY" ? "text-green-700" : "text-red-600"}`}
                      >
                        {orderForm.side}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Symbol</span>
                      <span className="font-medium">{orderForm.trading_symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Qty</span>
                      <span>{orderForm.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span>{orderForm.order_type}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setOrderForm(null); setOrderResult(null) }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className={`flex-1 ${
                        orderForm.side === "BUY"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                      onClick={placeOrder}
                      disabled={ordering || !orderForm.quantity || Number(orderForm.quantity) < 1}
                    >
                      {ordering ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Confirm {orderForm.side}
                    </Button>
                  </div>
                </>
              )}

              {orderResult && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setOrderForm(null); setOrderResult(null) }}
                >
                  Close
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
