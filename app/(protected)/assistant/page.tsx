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
import { Bot, Send, User, Loader2, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const STARTER_PROMPTS = [
  "What is my portfolio's overall performance?",
  "Which sectors am I most exposed to?",
  "Show me my top performing stocks",
  "What stocks should I consider buying today?",
]

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your AI portfolio assistant. I can help you analyze your holdings, discuss market conditions, and give you quantitative insights. What would you like to know today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-muted-foreground">
          Powered by AI — portfolio analysis, market insights, trade suggestions
        </p>
      </div>

      {/* Not configured notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-800">
          Configure your OpenAI / Anthropic / Gemini API key in Netlify env vars to enable AI
          responses.
        </p>
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Portfolio Assistant
            <Badge variant="secondary" className="text-xs">Beta</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === "assistant"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </CardContent>

        {/* Starter prompts + input */}
        <div className="p-4 border-t space-y-3">
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 transition-colors"
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
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
