"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Save, Eye, EyeOff, Sparkles } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

export default function AISettingsPage() {
  const { toast } = useToast()

  const [aiMode, setAiMode] = useState<"platform" | "byok">("platform")
  const [preferredLlm, setPreferredLlm] = useState("invest-buddy-ai")
  const [openaiKey, setOpenaiKey] = useState("")
  const [anthropicKey, setAnthropicKey] = useState("")
  const [geminiKey, setGeminiKey] = useState("")
  const [deepseekKey, setDeepseekKey] = useState("")
  const [qwenKey, setQwenKey] = useState("")
  const [tavilyKey, setTavilyKey] = useState("")
  const [brevoKey, setBrevoKey] = useState("")
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

  const llmOptions: Record<string, { value: string; label: string }[]> =
    aiMode === "platform"
      ? { "": [{ value: "invest-buddy-ai", label: "Invest Buddy AI (managed routing, recommended)" }] }
      : {
          "Reasoning & Deep Research": [
            { value: "gpt-5.1", label: "GPT-5.1 — OpenAI: flagship reasoning+coding, 400K ctx" },
            { value: "gpt-4.1", label: "GPT-4.1 — OpenAI: strong tool-use & stable API" },
            { value: "claude-opus-4-6", label: "Claude Opus 4.6 — Anthropic's best: deep reasoning" },
            { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro — Google's top reasoning + 1M context" },
            { value: "deepseek-reasoner", label: "DeepSeek R1 — chain-of-thought reasoning" },
          ],
          "Chat + Tool-Use (balanced)": [
            { value: "gpt-5.2-chat-latest", label: "GPT-5.2 Chat — latest ChatGPT model" },
            { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — fast Anthropic" },
            { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash — great price/perf" },
            { value: "deepseek-chat", label: "DeepSeek Chat V3 — strong analysis" },
          ],
          "Cost-efficient": [
            { value: "gpt-5-mini", label: "GPT-5 mini — reasoning-capable" },
            { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest Claude" },
            { value: "qwen-plus", label: "Qwen Plus (Alibaba) — very affordable" },
          ],
        }

  useEffect(() => {
    loadSettings()
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
  }

  async function handleSaveKeys() {
    setSavingKeys(true)
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ai_mode: aiMode,
        preferred_llm: preferredLlm,
        openai_key: openaiKey || undefined,
        anthropic_key: anthropicKey || undefined,
        gemini_key: geminiKey || undefined,
        deepseek_key: deepseekKey || undefined,
        qwen_key: qwenKey || undefined,
        tavily_key: tavilyKey || undefined,
        brevo_key: brevoKey || undefined,
      }),
    })
    setSavingKeys(false)
    if (res.ok) {
      toast({ title: "AI settings saved!" })
      setOpenaiKey("")
      setAnthropicKey("")
      setGeminiKey("")
      setDeepseekKey("")
      setQwenKey("")
      setTavilyKey("")
      setBrevoKey("")
      loadSettings()
    } else {
      toast({ title: "Failed to save settings", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5" />AI & API Keys</h2>
        <p className="text-muted-foreground text-sm">Choose how Invest Buddy AI accesses AI models and manage your API keys</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Access Mode</CardTitle>
          <CardDescription>Choose between using our managed AI platform or bringing your own keys</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {(["platform", "byok"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setAiMode(mode)
                  setPreferredLlm(mode === "platform" ? "invest-buddy-ai" : "gpt-5.2-chat-latest")
                }}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  aiMode === mode ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <p className="text-sm font-semibold">{mode === "platform" ? "Invest Buddy AI Platform" : "Bring Your Own Keys"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mode === "platform" ? "Managed LLM access. No key needed." : "Use your own OpenAI / Anthropic / Gemini key."}
                </p>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Preferred LLM</label>
            </div>
            <select
              value={preferredLlm}
              onChange={(e) => setPreferredLlm(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground text-sm"
            >
              {Object.entries(llmOptions).map(([category, options]) =>
                category ? (
                  <optgroup key={category} label={category}>
                    {options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))
                )
              )}
            </select>
          </div>

          {aiMode === "byok" && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">API Keys</p>
                <Button variant="ghost" size="sm" onClick={() => setShowKeys(!showKeys)} className="h-7">
                  {showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span className="ml-1.5 text-xs">{showKeys ? "Hide" : "Show"}</span>
                </Button>
              </div>
              <div className="space-y-3">
                {[
                  { key: "openai", label: "OpenAI API Key", state: openaiKey, setState: setOpenaiKey, set: keyStatus.openai_key_set },
                  { key: "anthropic", label: "Anthropic API Key", state: anthropicKey, setState: setAnthropicKey, set: keyStatus.anthropic_key_set },
                  { key: "gemini", label: "Google Gemini API Key", state: geminiKey, setState: setGeminiKey, set: keyStatus.gemini_key_set },
                  { key: "deepseek", label: "DeepSeek API Key", state: deepseekKey, setState: setDeepseekKey, set: keyStatus.deepseek_key_set },
                  { key: "qwen", label: "Qwen API Key", state: qwenKey, setState: setQwenKey, set: keyStatus.qwen_key_set },
                  { key: "tavily", label: "Tavily Search API Key", state: tavilyKey, setState: setTavilyKey, set: keyStatus.tavily_key_set },
                  { key: "brevo", label: "Brevo Email API Key", state: brevoKey, setState: setBrevoKey, set: keyStatus.brevo_key_set },
                ].map(({ key, label, state, setState, set }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Input
                      type={showKeys ? "text" : "password"}
                      placeholder={label}
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="flex-1"
                    />
                    {set && <span className="text-xs text-green-600">✓ Set</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={handleSaveKeys} disabled={savingKeys} className="w-full">
            {savingKeys ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save AI Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
