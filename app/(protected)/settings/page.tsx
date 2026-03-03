"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { Loader2, Save, TestTube2, CheckCircle2, XCircle } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

export default function SettingsPage() {
  const { toast } = useToast()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "unknown">("unknown")

  const [upstoxToken, setUpstoxToken] = useState("")
  const [upstoxSandbox, setUpstoxSandbox] = useState(true)
  const [openaiKey, setOpenaiKey] = useState("")
  const [anthropicKey, setAnthropicKey] = useState("")
  const [geminiKey, setGeminiKey] = useState("")
  const [tavilyKey, setTavilyKey] = useState("")

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (data?.preferences) {
      const prefs = data.preferences as Record<string, unknown>
      if (prefs.upstox_sandbox !== undefined) setUpstoxSandbox(prefs.upstox_sandbox as boolean)
    }
  }

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        preferences: {
          upstox_sandbox: upstoxSandbox,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)

    setSaving(false)

    if (error) {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Settings saved", description: "Your preferences have been updated." })
    }
  }

  async function handleTestUpstox() {
    setTesting(true)
    try {
      const res = await fetch("/api/upstox/profile")
      const data = await res.json()
      if (res.ok && data.status === "success") {
        setConnectionStatus("connected")
        toast({
          title: "Upstox connected!",
          description: `Logged in as ${data.data?.user_name || data.data?.email}`,
        })
      } else {
        setConnectionStatus("disconnected")
        toast({
          title: "Connection failed",
          description: data.message || "Invalid or expired token.",
          variant: "destructive",
        })
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
        toast({
          title: "Holdings synced!",
          description: `${data.count || 0} holdings updated from Upstox.`,
        })
      } else {
        toast({ title: "Sync failed", description: data.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "Sync error", variant: "destructive" })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your API connections and preferences
        </p>
      </div>

      {/* Upstox */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upstox Connection</CardTitle>
              <CardDescription>
                Connect your Upstox account to sync holdings and place orders
              </CardDescription>
            </div>
            {connectionStatus === "connected" && (
              <Badge variant="success" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            )}
            {connectionStatus === "disconnected" && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Disconnected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sandbox Mode</Label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUpstoxSandbox(!upstoxSandbox)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  upstoxSandbox ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    upstoxSandbox ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm text-muted-foreground">
                {upstoxSandbox ? "Sandbox (test orders)" : "Live trading"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Access Token</Label>
            <p className="text-xs text-muted-foreground">
              Set via <code className="bg-muted px-1 rounded">UPSTOX_ACCESS_TOKEN</code> environment
              variable in Netlify. Tokens are valid for ~30 days. Generate from Upstox Developer Portal.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTestUpstox} disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TestTube2 className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={saving || connectionStatus !== "connected"}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Sync Holdings
            </Button>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-2">OAuth Flow (optional)</p>
            <p className="text-xs text-muted-foreground mb-3">
              Use OAuth if you want multi-user support or token auto-refresh. For personal
              use, a direct access token is simpler.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/upstox/authorize">Connect via OAuth</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Keys info */}
      <Card>
        <CardHeader>
          <CardTitle>AI & Research Keys</CardTitle>
          <CardDescription>
            LLM and search API keys for the AI Assistant (set via Netlify env vars)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "OpenAI API Key", envVar: "OPENAI_API_KEY" },
            { label: "Anthropic API Key", envVar: "ANTHROPIC_API_KEY" },
            { label: "Gemini API Key", envVar: "GEMINI_API_KEY" },
            { label: "Tavily API Key", envVar: "TAVILY_API_KEY" },
          ].map((item) => (
            <div key={item.envVar} className="flex items-center justify-between py-1">
              <span className="text-sm">{item.label}</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">{item.envVar}</code>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-2">
            Configure these in your Netlify dashboard under Site Configuration → Environment Variables.
          </p>
        </CardContent>
      </Card>

      {/* Save preferences */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Preferences
        </Button>
      </div>
    </div>
  )
}
