import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const SYSTEM_PROMPT = `You are an expert AI equity portfolio assistant for BrokerAI. 
You help users analyze their stock portfolio, understand market trends, and make informed investment decisions.
You have knowledge of Indian equity markets (NSE/BSE), fundamental analysis, technical indicators, and portfolio management.
Be concise, data-driven, and always remind users that this is not financial advice.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { message } = await request.json()

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  // Fetch portfolio context for this user
  const { data: holdings } = await supabase
    .from("holdings")
    .select(`
      quantity, avg_price, invested_amount, ltp, unrealized_pl,
      instruments(trading_symbol, name, exchange)
    `)
    .eq("portfolios.user_id", user.id)
    .limit(50)

  const portfolioContext =
    holdings && holdings.length > 0
      ? `\n\nUser's current holdings: ${JSON.stringify(
          holdings.map((h) => ({
            symbol: (h.instruments as unknown as Record<string, unknown>)?.trading_symbol,
            qty: h.quantity,
            avg: h.avg_price,
            ltp: h.ltp,
            pnl: h.unrealized_pl,
          }))
        )}`
      : ""

  const fullSystemPrompt = SYSTEM_PROMPT + portfolioContext

  // Resolve user-saved LLM keys (user prefs override env vars)
  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()
  const prefs = (settingsRow?.preferences as Record<string, string>) || {}
  const preferredLlm = prefs.preferred_llm || "auto"
  const resolvedOpenai = prefs.openai_key || process.env.OPENAI_API_KEY || ""
  const resolvedAnthropic = prefs.anthropic_key || process.env.ANTHROPIC_API_KEY || ""
  const resolvedGemini = prefs.gemini_key || process.env.GOOGLE_GEMINI_API_KEY || ""

  // Build ordered attempt list based on preferred_llm
  type LLMProvider = "openai" | "anthropic" | "gemini"
  const allProviders: LLMProvider[] = ["openai", "anthropic", "gemini"]
  const orderedProviders: LLMProvider[] =
    preferredLlm !== "auto" && allProviders.includes(preferredLlm as LLMProvider)
      ? [preferredLlm as LLMProvider, ...allProviders.filter((p) => p !== preferredLlm)]
      : allProviders

  let reply = ""

  for (const provider of orderedProviders) {
    if (reply) break
    if (provider === "openai" && resolvedOpenai) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolvedOpenai}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: fullSystemPrompt },
              { role: "user", content: message },
            ],
            max_tokens: 800,
            temperature: 0.7,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          reply = data.choices?.[0]?.message?.content || ""
        }
      } catch { console.error("OpenAI error") }
    }
    if (provider === "anthropic" && resolvedAnthropic) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": resolvedAnthropic,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 800,
            system: fullSystemPrompt,
            messages: [{ role: "user", content: message }],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          reply = data.content?.[0]?.text || ""
        }
      } catch { console.error("Anthropic error") }
    }
  }

  // Try Google Gemini
  if (!reply) {
    const geminiKey = resolvedGemini
    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${fullSystemPrompt}\n\nUser: ${message}` }] }],
            }),
          }
        )
        if (res.ok) {
          const data = await res.json()
          reply = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
        }
      } catch {
        console.error("Gemini error")
      }
    }
  }

  // Intelligent fallback
  if (!reply) {
    reply = generateFallbackReply(message)
  }

  // Save to chat history
  await supabase.from("chat_history").insert({
    user_id: user.id,
    message,
    reply,
    created_at: new Date().toISOString(),
  })

  return NextResponse.json({ reply })
}

function generateFallbackReply(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes("portfolio") && lower.includes("perform")) {
    return "To analyze your portfolio performance, I look at your holdings' P&L, sector allocation, and compare against benchmarks like Nifty 50. Configure an AI API key (OpenAI, Anthropic, or Gemini) in your environment variables for detailed AI-powered analysis."
  }
  if (lower.includes("buy") || lower.includes("recommend")) {
    return "For stock recommendations, I analyze fundamentals, technicals, and your existing portfolio concentration. Please note this is not financial advice. Add an AI API key for personalized recommendations."
  }
  if (lower.includes("risk")) {
    return "Portfolio risk assessment involves Beta, Sharpe ratio, sector concentration, and drawdown analysis. I can give detailed risk metrics when an AI provider is configured."
  }
  if (lower.includes("sector") || lower.includes("allocation")) {
    return "Sector diversification is key to managing risk. Ideally no single sector should exceed 25-30% of your portfolio value. Check your dashboard for a breakdown of your current sector allocation."
  }

  return "I'm your AI portfolio assistant. I can help with portfolio analysis, stock fundamentals, risk assessment, and investment strategies. For full AI capabilities, configure an API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GEMINI_API_KEY) in your environment settings."
}
