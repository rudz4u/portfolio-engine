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
import { Loader2, Save, TestTube2, CheckCircle2, XCircle, Eye, EyeOff, Key, Mail, Bell } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

export default function SettingsPage() {
  const { toast } = useToast()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [savingKeys, setSavingKeys] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "unknown">("unknown")

  const [upstoxSandbox, setUpstoxSandbox] = useState(true)
  const [openaiKey, setOpenaiKey] = useState("")
  const [anthropicKey, setAnthropicKey] = useState("")
  const [geminiKey, setGeminiKey] = useState("")
  const [preferredLlm, setPreferredLlm] = useState("auto")
  const [showKeys, setShowKeys] = useState(false)
  const [keyStatus, setKeyStatus] = useState({
    openai_key_set: false,
    anthropic_key_set: false,
    gemini_key_set: false,
    brevo_key_set: false,
  })

  // Email notification state
  const [emailDigest, setEmailDigest] = useState(false)
  const [notificationEmail, setNotificationEmail] = useState("")
  const [brevoKey, setBrevoKey] = useState("")
  const [savingNotif, setSavingNotif] = useState(false)
  const [sendingDigest, setSendingDigest] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const res = await fetch("/api/settings")
    if (res.ok) {
      const data = await res.json()
      setKeyStatus({
        openai_key_set: !!data.openai_key_set,
        anthropic_key_set: !!data.anthropic_key_set,
        gemini_key_set: !!data.gemini_key_set,
        brevo_key_set: !!data.brevo_key_set,
      })
      setPreferredLlm(data.preferred_llm || "auto")
      setUpstoxSandbox(data.sandbox_mode !== false)
      setEmailDigest(!!data.email_digest)
      setNotificationEmail(data.notification_email || "")
    }
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandbox_mode: String(upstoxSandbox) }),
    })
    setSaving(false)
    if (res.ok) {
      toast({ title: "Settings saved" })
    } else {
      toast({ title: "Failed to save", variant: "destructive" })
    }
  }

  async function handleSaveKeys() {
    setSavingKeys(true)
    const body: Record<string, string> = { preferred_llm: preferredLlm }
    if (openaiKey) body.openai_key = openaiKey
    if (anthropicKey) body.anthropic_key = anthropicKey
    if (geminiKey) body.gemini_key = geminiKey
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setSavingKeys(false)
    if (res.ok) {
      toast({ title: "API keys saved" })
      setOpenaiKey("")
      setAnthropicKey("")
      setGeminiKey("")
      loadSettings()
    } else {
      toast({ title: "Failed to save keys", variant: "destructive" })
    }
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

  async function handleSaveNotifications() {
    setSavingNotif(true)
    const body: Record<string, string> = {
      email_digest: String(emailDigest),
      notification_email: notificationEmail,
    }
    if (brevoKey) body.brevo_key = brevoKey
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setSavingNotif(false)
    if (res.ok) {
      setBrevoKey("")
      loadSettings()
      toast({ title: "Notification settings saved" })
    } else {
      toast({ title: "Failed to save", variant: "destructive" })
    }
  }

  async function handleSendDigest() {
    setSendingDigest(true)
    const res = await fetch("/api/notifications/digest", { method: "POST" })
    const data = await res.json()
    setSendingDigest(false)
    if (res.ok) {
      toast({ title: "Digest sent!", description: data.message })
    } else {
      toast({ title: "Send failed", description: data.error, variant: "destructive" })
    }
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

      {/* AI Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                AI Provider Keys
              </CardTitle>
              <CardDescription>
                Your own LLM API keys — take precedence over server env vars.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowKeys(!showKeys)}>
              {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {([
              { label: "OpenAI", key: "openai_key_set" as const, clearKey: "openai_key" },
              { label: "Anthropic", key: "anthropic_key_set" as const, clearKey: "anthropic_key" },
              { label: "Gemini", key: "gemini_key_set" as const, clearKey: "gemini_key" },
            ]).map(({ label, key, clearKey }) => (
              <div key={key} className="flex items-center gap-1">
                <Badge variant={keyStatus[key] ? "success" : "secondary"} className="flex items-center gap-1">
                  {keyStatus[key] && <CheckCircle2 className="h-3 w-3" />}
                  {label}
                </Badge>
                {keyStatus[key] && (
                  <button onClick={() => handleClearKey(clearKey)} className="text-xs text-muted-foreground hover:text-destructive">✕</button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">OpenAI API Key</Label>
              <Input type={showKeys ? "text" : "password"} placeholder={keyStatus.openai_key_set ? "sk-... (set — enter new to update)" : "sk-..."} value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Anthropic API Key</Label>
              <Input type={showKeys ? "text" : "password"} placeholder={keyStatus.anthropic_key_set ? "sk-ant-... (set)" : "sk-ant-..."} value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Google Gemini API Key</Label>
              <Input type={showKeys ? "text" : "password"} placeholder={keyStatus.gemini_key_set ? "AIza... (set)" : "AIza..."} value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Preferred LLM</Label>
            <select value={preferredLlm} onChange={(e) => setPreferredLlm(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="auto">Auto (best available)</option>
              <option value="openai">OpenAI GPT-4o mini</option>
              <option value="anthropic">Anthropic Claude Haiku</option>
              <option value="gemini">Google Gemini Flash</option>
            </select>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveKeys} disabled={savingKeys}>
              {savingKeys ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Keys
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
          <CardDescription>
            Daily portfolio digest email via Brevo. Sent at 10:00 AM IST on trading days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Daily Digest Email</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Morning summary: P&amp;L, top movers, recent orders
              </p>
            </div>
            <button
              onClick={() => setEmailDigest((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailDigest ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  emailDigest ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Notification Email</Label>
            <Input
              type="email"
              placeholder="your@email.com (leave blank to use account email)"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
            />
          </div>

          <Separator />

          <div className="space-y-1">
            <Label className="text-sm flex items-center gap-2">
              <Key className="h-3.5 w-3.5" />
              Brevo API Key
              {keyStatus.brevo_key_set && (
                <Badge variant="success" className="text-xs">Set</Badge>
              )}
            </Label>
            <p className="text-xs text-muted-foreground">
              Get a free key at{" "}
              <a href="https://app.brevo.com" target="_blank" rel="noreferrer" className="underline">app.brevo.com</a>.
              Falls back to system key if not set.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={keyStatus.brevo_key_set ? "xkeysib-... (set — enter new to update)" : "xkeysib-..."}
                value={brevoKey}
                onChange={(e) => setBrevoKey(e.target.value)}
              />
              {keyStatus.brevo_key_set && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleClearKey("brevo_key")}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveNotifications} disabled={savingNotif}>
              {savingNotif ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
            <Button variant="outline" onClick={handleSendDigest} disabled={sendingDigest}>
              {sendingDigest ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Send Test Digest
            </Button>
          </div>
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
