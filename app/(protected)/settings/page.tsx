"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
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
import {
  Loader2, Save, TestTube2, CheckCircle2, XCircle,
  Eye, EyeOff, Key, Mail, Bell, ExternalLink, RefreshCw,
  Plus, Trash2, Sparkles, Database,
} from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

/* ─── helpers ────────────────────────────────────────────────────────────── */

function Toggle({
  value, onChange, label, description,
}: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          value ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { toast } = useToast()
  const supabase = createClient() // used in async handlers below
  const searchParams = useSearchParams()

  /* ── upstox ── */
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "unknown">("unknown")
  const [upstoxSandbox, setUpstoxSandbox] = useState(true)
  const [upstoxToken, setUpstoxToken] = useState("")
  const [savingToken, setSavingToken] = useState(false)
  const [upstoxTokenSet, setUpstoxTokenSet] = useState(false)
  const [upstoxTokenExpiresAt, setUpstoxTokenExpiresAt] = useState<string | null>(null)

  /* ── AI mode ── */
  const [aiMode, setAiMode] = useState<"platform" | "byok">("platform")
  const [preferredLlm, setPreferredLlm] = useState("invest-buddy-ai")
  const [openaiKey, setOpenaiKey] = useState("")
  const [anthropicKey, setAnthropicKey] = useState("")
  const [geminiKey, setGeminiKey] = useState("")
  const [deepseekKey, setDeepseekKey] = useState("")
  const [qwenKey,     setQwenKey]     = useState("")
  const [tavilyKey, setTavilyKey] = useState("")
  const [brevoKey,  setBrevoKey]  = useState("")
  const [showKeys, setShowKeys] = useState(false)
  const [keyStatus, setKeyStatus] = useState({
    openai_key_set: false,
    anthropic_key_set: false,
    gemini_key_set: false,
    deepseek_key_set: false,
    qwen_key_set: false,
    tavily_key_set: false,
    brevo_key_set: false,
  })
  const [savingKeys, setSavingKeys] = useState(false)

  /* ── notifications ── */
  const [notifDailyDigest, setNotifDailyDigest] = useState(false)
  const [notifOrderPlaced, setNotifOrderPlaced] = useState(false)
  const [notifPortfolioAlert, setNotifPortfolioAlert] = useState(false)
  const [notifPriceAlert, setNotifPriceAlert] = useState(false)
  const [emails, setEmails] = useState<string[]>([""])

  const [savingNotif, setSavingNotif] = useState(false)
  const [sendingDigest, setSendingDigest] = useState(false)

  // Instruments DB seeding
  const [instrCount, setInstrCount]   = useState<number | null>(null)
  const [seeding,    setSeeding]       = useState(false)
  const [seedMsg,    setSeedMsg]       = useState<string | null>(null)

  async function checkInstrumentCount() {
    try {
      const r = await fetch("/api/instruments/seed")
      const d = await r.json()
      setInstrCount(d.count ?? 0)
    } catch { /* ignore */ }
  }

  async function seedInstruments() {
    setSeeding(true); setSeedMsg(null)
    try {
      const r = await fetch("/api/instruments/seed", { method: "POST" })
      const d = await r.json()
      setSeedMsg(d.status === "success"
        ? `Seeded ${d.total.toLocaleString()} instruments (NSE + BSE equity)`
        : `Partial: ${JSON.stringify(d.summary)}${ d.errors?.length ? " — " + d.errors[0] : "" }`)
      checkInstrumentCount()
    } catch (e) {
      setSeedMsg("Error: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => {
    loadSettings()

    const success = searchParams.get("success")
    const error = searchParams.get("error")
    const message = searchParams.get("message")
    const doSync = searchParams.get("sync") === "1"

    if (success === "upstox_connected") {
      setConnectionStatus("connected")
      toast({
        title: "Upstox connected!",
        description: doSync ? "Syncing your portfolio now…" : "Your Upstox account is linked.",
      })
      window.history.replaceState({}, "", "/settings")
      // Explicitly reload settings so upstoxTokenSet reflects the newly saved token.
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
      toast({
        title: "Upstox connection failed",
        description: message ? decodeURIComponent(message) : error,
        variant: "destructive",
      })
      window.history.replaceState({}, "", "/settings")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSettings() {
    const res = await fetch("/api/settings")
    if (!res.ok) return
    const data = await res.json()

    setKeyStatus({
      openai_key_set: !!data.openai_key_set,
      anthropic_key_set: !!data.anthropic_key_set,
      gemini_key_set: !!data.gemini_key_set,
      deepseek_key_set: !!data.deepseek_key_set,
      qwen_key_set: !!data.qwen_key_set,
      tavily_key_set: !!data.tavily_key_set,
      brevo_key_set: !!data.brevo_key_set,
    })
    setAiMode(data.ai_mode === "byok" ? "byok" : "platform")
    setPreferredLlm(data.preferred_llm || "invest-buddy-ai")
    setUpstoxSandbox(data.sandbox_mode !== false)
    setUpstoxTokenSet(!!data.upstox_token_set)
    setUpstoxTokenExpiresAt(data.upstox_token_expires_at || null)

    setNotifDailyDigest(!!data.notif_daily_digest)
    setNotifOrderPlaced(!!data.notif_order_placed)
    setNotifPortfolioAlert(!!data.notif_portfolio_alert)
    setNotifPriceAlert(!!data.notif_price_alert)

    const emailStr: string = data.notification_emails || ""
    const parsed = emailStr.split(",").map((e: string) => e.trim()).filter(Boolean)
    setEmails(parsed.length > 0 ? parsed : [""])
  }

  /* ── handlers: upstox ── */
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

  async function handleSaveToken() {
    if (!upstoxToken.trim()) return
    setSavingToken(true)
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upstox_access_token: upstoxToken.trim() }),
    })
    setSavingToken(false)
    if (res.ok) {
      setUpstoxToken("")
      await loadSettings()
      setConnectionStatus("unknown")
      toast({ title: "Access token saved" })
    } else {
      toast({ title: "Failed to save token", variant: "destructive" })
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
    if (res.ok) toast({ title: "Settings saved" })
    else toast({ title: "Failed to save", variant: "destructive" })
  }

  /* ── handlers: AI ── */
  async function handleSaveAI() {
    setSavingKeys(true)
    const body: Record<string, string> = { ai_mode: aiMode, preferred_llm: preferredLlm }
    if (openaiKey)    body.openai_key    = openaiKey
    if (anthropicKey) body.anthropic_key = anthropicKey
    if (geminiKey)    body.gemini_key    = geminiKey
    if (deepseekKey)  body.deepseek_key  = deepseekKey
    if (qwenKey)      body.qwen_key      = qwenKey
    if (tavilyKey)    body.tavily_key    = tavilyKey
    if (brevoKey)     body.brevo_key     = brevoKey
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setSavingKeys(false)
    if (res.ok) {
      toast({ title: "AI settings saved" })
      setOpenaiKey(""); setAnthropicKey(""); setGeminiKey(""); setDeepseekKey(""); setQwenKey(""); setTavilyKey(""); setBrevoKey("")
      loadSettings()
    } else {
      toast({ title: "Failed to save AI settings", variant: "destructive" })
    }
  }

  /* ── handlers: notifications ── */
  function addEmail() { if (emails.length < 4) setEmails([...emails, ""]) }
  function removeEmail(i: number) {
    const next = emails.filter((_, idx) => idx !== i)
    setEmails(next.length > 0 ? next : [""])
  }
  function updateEmail(i: number, v: string) {
    setEmails(emails.map((e, idx) => (idx === i ? v : e)))
  }

  async function handleSaveNotifications() {
    setSavingNotif(true)
    const validEmails = emails.filter((e) => e.trim())
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notification_emails: validEmails.join(","),
        notif_daily_digest: String(notifDailyDigest),
        notif_order_placed: String(notifOrderPlaced),
        notif_portfolio_alert: String(notifPortfolioAlert),
        notif_price_alert: String(notifPriceAlert),
      }),
    })
    setSavingNotif(false)
    if (res.ok) {
      toast({ title: "Notification settings saved" })
      loadSettings()
    } else {
      toast({ title: "Failed to save", variant: "destructive" })
    }
  }

  async function handleSendDigest() {
    setSendingDigest(true)
    const res = await fetch("/api/notifications/digest", { method: "POST" })
    const data = await res.json()
    setSendingDigest(false)
    if (res.ok) toast({ title: "Digest sent!", description: data.message })
    else toast({ title: "Send failed", description: data.error, variant: "destructive" })
  }

  /* ── Curated BYOK shortlist: reasoning-first, tool-aware, investment-grade ── */
  // All model IDs match the provider's actual API model identifiers.
  const llmOptions: Record<string, { value: string; label: string }[]> =
    aiMode === "platform"
      ? { "": [{ value: "invest-buddy-ai", label: "Invest Buddy AI (managed routing, recommended)" }] }
      : {
          "Reasoning & Deep Research": [
            { value: "gpt-5.1",           label: "GPT-5.1 — OpenAI: flagship reasoning+coding, 400K ctx, configurable effort" },
            { value: "gpt-4.1",           label: "GPT-4.1 — OpenAI: strong tool-use & stable API" },
            { value: "claude-opus-4-6",   label: "Claude Opus 4.6 — Anthropic’s best: deep, careful reasoning" },
            { value: "gemini-2.5-pro",    label: "Gemini 2.5 Pro — Google’s top reasoning + 1M context window" },
            { value: "deepseek-reasoner", label: "DeepSeek R1 — chain-of-thought reasoning at very low cost" },
          ],
          "Chat + Tool-Use (balanced)": [
            { value: "gpt-5.2-chat-latest", label: "GPT-5.2 Chat — latest ChatGPT model, fast & agent ready ($1.75/$14 per 1M)" },
            { value: "gpt-5.1-chat-latest", label: "GPT-5.1 Chat — previous ChatGPT model, function calling ($1.25/$10 per 1M)" },
            { value: "claude-sonnet-4-6",   label: "Claude Sonnet 4.6 — fast Anthropic with 200K context" },
            { value: "gemini-2.5-flash",    label: "Gemini 2.5 Flash — great price/perf, strong reasoning" },
            { value: "deepseek-chat",       label: "DeepSeek Chat V3 — strong analysis, OpenAI-compatible endpoint" },
          ],
          "Cost-efficient": [
            { value: "gpt-5-mini",       label: "GPT-5 mini — 400K context, reasoning-capable, $0.25/$2 per 1M" },
            { value: "gpt-4.1-mini",     label: "GPT-4.1 Mini — compact OpenAI, tool-capable, affordable" },
            { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest Claude for quick queries" },
            { value: "qwen-plus",        label: "Qwen Plus (Alibaba) — 1M context, multilingual, very affordable" },
          ],
        }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your API connections and preferences</p>
      </div>

      {/* ══ Upstox ══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upstox Connection</CardTitle>
              <CardDescription>Connect your Upstox account to sync holdings and place orders</CardDescription>
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
          <Toggle
            value={upstoxSandbox}
            onChange={setUpstoxSandbox}
            label="Sandbox Mode"
            description={upstoxSandbox ? "Sandbox — test orders only" : "Live trading enabled"}
          />

          {upstoxTokenSet ? (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                      Upstox account connected
                    </span>
                  </div>
                  {upstoxTokenExpiresAt && (
                    <p className={`text-xs pl-6 ${
                      new Date(upstoxTokenExpiresAt) < new Date()
                        ? "text-destructive font-medium"
                        : "text-muted-foreground"
                    }`}>
                      {new Date(upstoxTokenExpiresAt) < new Date()
                        ? "⚠ Token expired — reconnect below"
                        : `Session valid until ${new Date(upstoxTokenExpiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => {
                    handleClearKey("upstox_access_token")
                    setConnectionStatus("disconnected")
                    setUpstoxTokenSet(false)
                    setUpstoxTokenExpiresAt(null)
                  }}
                  className="text-muted-foreground hover:text-destructive text-xs shrink-0"
                >
                  Disconnect
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleTestUpstox} disabled={testing}>
                  {testing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <TestTube2 className="mr-2 h-3 w-3" />}
                  Test Connection
                </Button>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                  Sync Holdings
                </Button>
                {upstoxTokenExpiresAt && new Date(upstoxTokenExpiresAt) < new Date() && (
                  <Button size="sm" asChild>
                    <a href="/api/oauth/upstox/authorize">
                      <ExternalLink className="mr-2 h-3 w-3" /> Re-connect
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 flex flex-col items-center gap-3 text-center">
              <p className="text-muted-foreground text-sm">
                Connect your Upstox account to automatically sync your holdings.
                You&apos;ll be redirected to Upstox to authorise access — no copy-pasting required.
              </p>
              <Button asChild size="lg" className="mt-1">
                <a href="/api/oauth/upstox/authorize">
                  <ExternalLink className="mr-2 h-4 w-4" /> Connect with Upstox
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">
                Your credentials are never stored outside your own account.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2 max-w-sm">
                <strong>Tip:</strong> If the Upstox OTP is not arriving, first{" "}
                <a
                  href="https://upstox.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  log in to Upstox.com
                </a>{" "}
                directly in another tab, then come back and click Connect — Upstox will ask for your
                6-digit PIN instead of sending an OTP.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ AI Access ══ */}
      <Card>
          <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Access
          </CardTitle>
          <CardDescription>Choose how Invest Buddy AI accesses AI models for analysis and chat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {(["platform", "byok"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setAiMode(mode)
                  setPreferredLlm(mode === "platform" ? "invest-buddy-ai" : "gpt-5.2")
                }}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  aiMode === mode ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <p className="text-sm font-semibold">
                  {mode === "platform" ? "Invest Buddy AI Platform" : "Bring Your Own Keys"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mode === "platform"
                    ? "Managed LLM access. No key needed."
                    : "Use your own OpenAI / Anthropic / Gemini key."}
                </p>
              </button>
            ))}
          </div>

          {aiMode === "byok" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Enter the keys you want to use:</p>
                <Button variant="ghost" size="sm" onClick={() => setShowKeys(!showKeys)} className="h-7">
                  {showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span className="ml-1.5 text-xs">{showKeys ? "Hide" : "Show"}</span>
                </Button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { label: "OpenAI", key: "openai_key_set" as const, clearKey: "openai_key" },
                  { label: "Anthropic", key: "anthropic_key_set" as const, clearKey: "anthropic_key" },
                  { label: "Gemini", key: "gemini_key_set" as const, clearKey: "gemini_key" },
                  { label: "DeepSeek", key: "deepseek_key_set" as const, clearKey: "deepseek_key" },
                  { label: "Qwen", key: "qwen_key_set" as const, clearKey: "qwen_key" },
                  { label: "Tavily", key: "tavily_key_set" as const, clearKey: "tavily_key" },
                  { label: "Brevo", key: "brevo_key_set" as const, clearKey: "brevo_key" },
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
              {([
                { label: "OpenAI API Key", placeholder: "sk-...", value: openaiKey, set: setOpenaiKey, flagKey: "openai_key_set" as const },
                { label: "Anthropic API Key", placeholder: "sk-ant-...", value: anthropicKey, set: setAnthropicKey, flagKey: "anthropic_key_set" as const },
                { label: "Google Gemini API Key", placeholder: "AIza...", value: geminiKey, set: setGeminiKey, flagKey: "gemini_key_set" as const },
                { label: "DeepSeek API Key", placeholder: "sk-...", value: deepseekKey, set: setDeepseekKey, flagKey: "deepseek_key_set" as const },
                { label: "Qwen (Alibaba) API Key", placeholder: "sk-...", value: qwenKey, set: setQwenKey, flagKey: "qwen_key_set" as const },
                { label: "Tavily API Key (news research)", placeholder: "tvly-...", value: tavilyKey, set: setTavilyKey, flagKey: "tavily_key_set" as const },
                { label: "Brevo API Key (email digest)", placeholder: "xkeysib-...", value: brevoKey, set: setBrevoKey, flagKey: "brevo_key_set" as const },
              ]).map(({ label, placeholder, value, set, flagKey }) => (
                <div key={label} className="space-y-1.5">
                  <Label className="text-sm">{label}</Label>
                  <Input
                    type={showKeys ? "text" : "password"}
                    placeholder={keyStatus[flagKey] ? `${placeholder} (set — enter new to update)` : placeholder}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">Preferred Model</Label>
            <select
              value={preferredLlm}
              onChange={(e) => setPreferredLlm(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(llmOptions).map(([group, opts]) =>
                group ? (
                  <optgroup key={group} label={group}>
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </optgroup>
                ) : (
                  opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
                )
              )}
            </select>
            {aiMode === "platform" && (
              <p className="text-xs text-muted-foreground">Invest Buddy AI manages model routing automatically.</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveAI} disabled={savingKeys}>
              {savingKeys ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save AI Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ══ Notifications ══ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
          <CardDescription>Email alerts delivered via Brevo. Sent on trading days at 10 AM IST.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alert types</p>
            <Toggle value={notifDailyDigest} onChange={setNotifDailyDigest} label="Daily Digest"
              description="Morning P&L summary — top movers and recent orders" />
            <Separator />
            <Toggle value={notifOrderPlaced} onChange={setNotifOrderPlaced} label="Order Placed"
              description="Confirmation email each time an order is executed" />
            <Separator />
            <Toggle value={notifPortfolioAlert} onChange={setNotifPortfolioAlert} label="Portfolio Alerts"
              description="Notify on large drawdowns or significant portfolio rallies" />
            <Separator />
            <Toggle value={notifPriceAlert} onChange={setNotifPriceAlert} label="Price Alerts"
              description="Trigger when a watchlist stock hits your target" />
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Notification Emails</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Up to 4 recipients. Leave blank to use your account email.</p>
              </div>
              {emails.length < 4 && (
                <Button variant="ghost" size="sm" onClick={addEmail} className="h-7 gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {emails.map((email, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    type="email"
                    placeholder={`Email ${i + 1}`}
                    value={email}
                    onChange={(e) => updateEmail(i, e.target.value)}
                    className="flex-1"
                  />
                  {(emails.length > 1 || email) && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => removeEmail(i)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSaveNotifications} disabled={savingNotif}>
              {savingNotif ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
            <Button variant="outline" onClick={handleSendDigest} disabled={sendingDigest}>
              {sendingDigest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send Test Digest
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save preferences (sandbox) */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Preferences
        </Button>
      </div>

      {/* Manual token (advanced) */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-3.5 w-3.5" />
            Manual Token (Advanced)
          </CardTitle>
          <CardDescription className="text-xs">
            Paste an Upstox access token directly if OAuth redirect is unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Upstox access token…"
              value={upstoxToken}
              onChange={(e) => setUpstoxToken(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={handleSaveToken}
              disabled={savingToken || !upstoxToken.trim()} className="shrink-0">
              {savingToken ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Instruments database */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-3.5 w-3.5" />
            Instruments Database
          </CardTitle>
          <CardDescription className="text-xs">
            Seeds NSE &amp; BSE equity instrument names for stock search in Watchlist.
            Run once to enable &quot;Search &amp; Add&quot; from the full Indian market.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {instrCount === null ? (
                <button className="text-xs text-primary hover:underline" onClick={checkInstrumentCount}>
                  Check current count
                </button>
              ) : (
                <span className={instrCount > 0 ? "text-emerald-400" : "text-muted-foreground"}>
                  {instrCount > 0 ? `${instrCount.toLocaleString()} instruments loaded` : "Not seeded yet"}
                </span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={seedInstruments} disabled={seeding}>
              {seeding
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Seeding…</>
                : "Seed / Refresh"}
            </Button>
          </div>
          {seedMsg && (
            <p className={`text-xs ${seedMsg.startsWith("Error") ? "text-destructive" : "text-emerald-400"}`}>
              {seedMsg}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
