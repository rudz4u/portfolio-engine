"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, RefreshCw, ExternalLink } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

function Toggle({ value, onChange, label, description }: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button type="button" onClick={() => onChange(!value)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${value ? "bg-primary" : "bg-muted"}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  )
}

export default function ConnectionPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "unknown">("unknown")
  const [upstoxSandbox, setUpstoxSandbox] = useState(true)
  const [upstoxTokenSet, setUpstoxTokenSet] = useState(false)
  const [upstoxTokenExpiresAt, setUpstoxTokenExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
    const success = searchParams.get("success")
    const error = searchParams.get("error")
    const message = searchParams.get("message")
    const doSync = searchParams.get("sync") === "1"

    if (success === "upstox_connected") {
      setConnectionStatus("connected")
      toast({ title: "Upstox connected!", description: doSync ? "Syncing your portfolio now…" : "Your Upstox account is linked." })
      window.history.replaceState({}, "", "/settings/connection")
      loadSettings()

      if (doSync) {
        fetch("/api/upstox/sync", { method: "POST" })
          .then((r) => r.json())
          .then((data) => {
            if (data.status === "success") {
              toast({ title: "Portfolio synced!", description: `${data.count ?? 0} holdings imported.` })
            } else {
              toast({ title: "Sync failed", description: data.message, variant: "destructive" })
            }
          })
          .catch(() => toast({ title: "Sync error", variant: "destructive" }))
      }
    } else if (error) {
      toast({ title: "Upstox connection failed", description: message ? decodeURIComponent(message) : error, variant: "destructive" })
      window.history.replaceState({}, "", "/settings/connection")
    }
  }, [searchParams, toast])

  async function loadSettings() {
    const res = await fetch("/api/settings")
    if (!res.ok) return
    const data = await res.json()
    setUpstoxSandbox(data.sandbox_mode !== false)
    setUpstoxTokenSet(!!data.upstox_token_set)
    setUpstoxTokenExpiresAt(data.upstox_token_expires_at || null)
  }

  async function handleClearKey(key: string) {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: "" }),
    })
    toast({ title: `${key} cleared` })
    loadSettings()
  }

  async function handleTestUpstox() {
    setTesting(true)
    try {
      const res = await fetch("/api/upstox/profile")
      const data = await res.json()
      if (res.ok && data.status === "success") {
        setConnectionStatus("connected")
        toast({ title: "Upstox connected!", description: `Logged in as ${data.data?.user_name || data.data?.email}` })
      } else {
        setConnectionStatus("disconnected")
        toast({ title: "Connection failed", description: data.message || "Invalid or expired token.", variant: "destructive" })
      }
    } catch {
      setConnectionStatus("disconnected")
      toast({ title: "Connection error", variant: "destructive" })
    }
    setTesting(false)
  }

  async function handleSync() {
    setSaving(true)
    try {
      const res = await fetch("/api/upstox/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast({ title: "Holdings synced!", description: `${data.count || 0} holdings updated.` })
      } else {
        toast({ title: "Sync failed", description: data.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "Sync error", variant: "destructive" })
    }
    setSaving(false)
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandbox_mode: String(upstoxSandbox) }),
    })
    setSaving(false)
    if (res.ok) toast({ title: "Settings saved" })
    else toast({ title: "Failed to save", variant: "destructive" })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold">Upstox Connection</h2>
        <p className="text-muted-foreground text-sm">Connect your Upstox account to sync holdings and place orders</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connection Status</CardTitle>
              <CardDescription>Manage your Upstox OAuth connection</CardDescription>
            </div>
            {connectionStatus === "connected" && <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Connected</Badge>}
            {connectionStatus === "disconnected" && <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Disconnected</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle value={upstoxSandbox} onChange={setUpstoxSandbox} label="Sandbox Mode" description={upstoxSandbox ? "Sandbox — test orders only" : "Live trading enabled"} />

          {upstoxTokenSet ? (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">Upstox account connected</span>
                  </div>
                  {upstoxTokenExpiresAt && (
                    <p className={`text-xs pl-6 ${new Date(upstoxTokenExpiresAt) < new Date() ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {new Date(upstoxTokenExpiresAt) < new Date()
                        ? "⚠ Token expired — reconnect below"
                        : `Session valid until ${new Date(upstoxTokenExpiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => { handleClearKey("upstox_access_token"); setConnectionStatus("disconnected"); setUpstoxTokenSet(false); setUpstoxTokenExpiresAt(null); }} className="text-muted-foreground hover:text-destructive text-xs shrink-0">
                  Disconnect
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleTestUpstox} disabled={testing}>
                  {testing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <>✓</>}
                  Test Connection
                </Button>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                  Sync Holdings
                </Button>
                {upstoxTokenExpiresAt && new Date(upstoxTokenExpiresAt) < new Date() && (
                  <Button size="sm" asChild>
                    <a href="/api/oauth/upstox/authorize"><ExternalLink className="mr-2 h-3 w-3" /> Re-connect</a>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 flex flex-col items-center gap-3 text-center">
              <p className="text-muted-foreground text-sm">Connect your Upstox account to automatically sync your holdings. You'll be redirected to Upstox to authorise access — no copy-pasting required.</p>
              <Button asChild size="lg" className="mt-1">
                <a href="/api/oauth/upstox/authorize"><ExternalLink className="mr-2 h-4 w-4" /> Connect with Upstox</a>
              </Button>
              <p className="text-xs text-muted-foreground">Your credentials are never stored outside your own account.</p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>Save</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
