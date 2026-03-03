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
} from "lucide-react"
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
