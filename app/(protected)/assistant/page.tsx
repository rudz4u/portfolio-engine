"use client"

import { useState, useRef, useEffect } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Bot, Send, User, Loader2, Key, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

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
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function loadHistory() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if user has any LLM key configured
    const settingsRes = await fetch("/api/settings")
    if (settingsRes.ok) {
      const s = await settingsRes.json()
      setHasApiKey(s.openai_key_set || s.anthropic_key_set || s.gemini_key_set ||
        !!process.env.NEXT_PUBLIC_HAS_LLM_KEY)
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
  }

  function clearChat() {
    setMessages([
      {
        id: "welcome_new",
        role: "assistant",
        content: "Chat cleared. How can I help you today?",
        timestamp: new Date(),
      },
    ])
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

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userId: user?.id,
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
              <Bot className="h-4 w-4 text-primary" />
              Portfolio Assistant
              <Badge variant="secondary" className="text-[10px]">Beta</Badge>
            </CardTitle>
            <button
              onClick={clearChat}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              title="Clear visible chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
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
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "assistant"
                    ? "bg-gradient-to-br from-violet-500 to-blue-500 text-white"
                    : "bg-secondary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/80 text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-white flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-secondary/80 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking…
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
