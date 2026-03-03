"use client"

import { useState } from "react"
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function SyncBar({ lastSynced }: { lastSynced?: string | null }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null)

  async function handleSync() {
    setSyncing(true)
    setMsg(null)
    try {
      const res  = await fetch("/api/upstox/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok && data.status === "success") {
        setMsg({ type: "ok", text: `Synced ${data.count ?? 0} holdings` })
        router.refresh()
      } else {
        setMsg({ type: "err", text: data.message || "Sync failed" })
      }
    } catch {
      setMsg({ type: "err", text: "Network error" })
    } finally {
      setSyncing(false)
    }
  }

  const lastSyncStr = lastSynced
    ? new Date(lastSynced).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
    : null

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {lastSyncStr && (
        <span className="text-xs text-muted-foreground">
          Last synced: {lastSyncStr}
        </span>
      )}
      {msg && (
        <span className={`flex items-center gap-1 text-xs ${msg.type === "ok" ? "text-emerald-400" : "text-destructive"}`}>
          {msg.type === "ok"
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <AlertCircle className="h-3.5 w-3.5" />}
          {msg.text}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="h-8">
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing…" : "Sync Now"}
      </Button>
    </div>
  )
}
