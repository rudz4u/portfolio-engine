"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Send, User, Loader2, Key, Trash2, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { MarkdownMessage } from "@/components/ui/markdown-message"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const STARTER_PROMPTS = [
  "Give me a morning briefing on my portfolio",
  "Which sectors am I most exposed to?",
  "Show me my top performing stocks",
  "Which positions should I review today?",
  "What is my overall risk profile?",
]

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [clearingChat, setClearingChat] = useState(false)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Defined before the useEffect that calls it to satisfy React Compiler analysis
  const loadHistory = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if user has any LLM key configured
    const settingsRes = await fetch("/api/settings")
    if (settingsRes.ok) {
      const s = await settingsRes.json()
      const byokConfigured = s.openai_key_set || s.anthropic_key_set || s.gemini_key_set ||
        s.deepseek_key_set || s.qwen_key_set
      const platformMode = (s.ai_mode || "platform") === "platform"
      setHasApiKey(byokConfigured || (platformMode && s.platform_llm_available))
    }

    const { data: history } = await supabase
      .from("chat_history")
      .select("id, message, reply, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(30)

    if (history && history.length > 0) {
      const histMsgs: Message[] = history.flatMap((h) => [
        {
          id: h.id + "_u",
          role: "user" as const,
          content: h.message || "",
          timestamp: new Date(h.created_at),
        },
        {
          id: h.id + "_a",
          role: "assistant" as const,
          content: h.reply || "",
          timestamp: new Date(h.created_at),
        },
      ])
      setMessages(histMsgs)
    } else {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "Hello! I'm your AI portfolio assistant. I can help you analyse your holdings, discuss market conditions, and give you quantitative insights. What would you like to know today?",
          timestamp: new Date(),
        },
      ])
    }
    setHistoryLoaded(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadHistory() }, [loadHistory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function clearChat() {
    setClearingChat(true)
    // Delete from DB
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("chat_history").delete().eq("user_id", user.id)
      }
    } catch { /* non-critical */ }
    setMessages([
      {
        id: "welcome_new",
        role: "assistant",
        content: "Chat cleared. How can I help you today?",
        timestamp: new Date(),
      },
    ])
    setClearingChat(false)
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return
    setInput("")
    setLoading(true)

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Build conversation history for multi-turn context.
      // Exclude the welcome placeholder, keep only real persisted messages, cap at 20.
      const historyForApi = messages
        .filter(
          (m) =>
            !m.id.startsWith("welcome") &&
            m.content.trim().length > 0
        )
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userId: user?.id,
          history: historyForApi,
        }),
      })

      const data = await res.json()

      const assistantMsg: Message = {
        id: Date.now().toString() + "_resp",
        role: "assistant",
        content:
          data.reply ||
          "I'm sorry, I couldn't process that. Please check your AI API keys in Settings.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "_err",
          role: "assistant",
          content: "Connection error. Please check your settings.",
          timestamp: new Date(),
        },
      ])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-4rem)] space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground text-sm">
          Powered by AI — portfolio analysis, market insights, trade suggestions
        </p>
      </div>

      {/* API key notice */}
      {hasApiKey === false && (
        <div className="bg-amber-400/10 border border-amber-400/25 rounded-lg px-4 py-2.5 flex items-center gap-2">
          <Key className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            No AI provider configured.{" "}
            <Link href="/settings" className="underline font-medium text-amber-200">Add an API key in Settings</Link>{" "}
            to enable AI responses.
          </p>
        </div>
      )}

      {/* Chat area */}
      <Card className="card-elevated flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              Portfolio Assistant
              <Badge variant="secondary" className="text-[10px]">Beta</Badge>
            </CardTitle>
            <button
              onClick={clearChat}
              disabled={clearingChat}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors disabled:opacity-50"
              title="Clear chat & delete history from database"
            >
              {clearingChat
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />}
              Clear
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {!historyLoaded && (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history…
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "flex-row-reverse items-end" : "items-start"
              }`}
            >
              {/* Avatar */}
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "assistant"
                    ? "bg-gradient-to-br from-violet-500 to-blue-600 text-white glow-sm"
                    : "bg-secondary text-foreground/70"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Sparkles className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Bubble */}
              {msg.role === "user" ? (
                <div className="max-w-[72%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-md">
                  {msg.content}
                </div>
              ) : (
                <div className="flex-1 min-w-0 rounded-xl rounded-tl-sm px-4 py-3 bg-secondary/40 border border-violet-500/10 shadow-sm">
                  <MarkdownMessage content={msg.content} />
                  <p className="text-[10px] text-muted-foreground/40 mt-2 text-right">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 items-start">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 glow-sm">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              </div>
              <div className="flex-1 rounded-xl rounded-tl-sm px-4 py-3.5 bg-secondary/40 border border-violet-500/10">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                  <span className="ml-1 text-xs text-muted-foreground/60">Analysing…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>

        {/* Starter prompts + input */}
        <div className="p-4 border-t border-border/60 space-y-3">
          {historyLoaded && messages.filter((m) => m.role === "user").length === 0 && (
            <div className="flex flex-wrap gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs bg-secondary/60 hover:bg-secondary border border-border/50 rounded-full px-3 py-1.5 transition-colors text-foreground/70 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage(input)
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your portfolio…"
              disabled={loading}
              className="flex-1 bg-secondary/40 border-border/60"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} className="btn-gradient border-0 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
