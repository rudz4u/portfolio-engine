import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { scoreHoldings, portfolioSummary, type HoldingInput } from "@/lib/quant/scoring"

const SYSTEM_PROMPT = `You are an expert AI equity portfolio assistant for BrokerAI. 
You help users analyze their Indian stock portfolio, understand market trends, and make informed investment decisions.
You have deep knowledge of NSE/BSE markets, fundamental analysis, technical indicators (RSI, MACD, ATR, Bollinger Bands), and portfolio management.
You speak concisely, citing numbers from the portfolio context when available. Always note that insights are not financial advice.
When asked for a morning briefing, provide: 1) Portfolio P&L snapshot, 2) Top BUY/SELL signals, 3) Sector concentration flags, 4) One key action item.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const message: string = body.message
  // history = prior turns the client sends for multi-turn context (max 20 kept)
  const rawHistory: { role: string; content: string }[] = Array.isArray(body.history)
    ? body.history.filter((m: { role: string; content: string }) => m.content?.trim())
    : []
  // Keep at most 10 pairs (20 messages) so we don't blow token budgets
  const history = rawHistory.slice(-20)

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  // Fetch portfolio context + run quant scoring
  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)

  let portfolioContext = ""

  if (portfolios && portfolios.length > 0) {
    const portfolioId = portfolios[0].id
    const { data: holdings } = await supabase
      .from("holdings")
      .select("instrument_key, quantity, avg_price, ltp, unrealized_pl, invested_amount, segment, raw")
      .eq("portfolio_id", portfolioId)

    if (holdings && holdings.length > 0) {
      const inputs: HoldingInput[] = holdings.map((h) => {
        const raw = (h.raw as Record<string, number>) || {}
        return {
          instrument_key: h.instrument_key,
          trading_symbol: (h.raw as Record<string, string>)?.trading_symbol || h.instrument_key,
          name: (h.raw as Record<string, string>)?.company_name || h.instrument_key,
          quantity: Number(h.quantity) || 0,
          avg_price: Number(h.avg_price) || 0,
          ltp: Number(h.ltp) || Number(h.avg_price) || 0,
          unrealized_pl: Number(h.unrealized_pl) || 0,
          invested_amount: Number(h.invested_amount) || 0,
          day_change_percentage: raw.day_change_percentage,
          segment: (h.segment as string) || "Others",
        }
      })
      const scored = scoreHoldings(inputs)
      const summary = portfolioSummary(scored)
      const buySignals = scored.filter((s) => s.signal === "BUY").map((s) => s.trading_symbol).slice(0, 5)
      const sellSignals = scored.filter((s) => s.signal === "SELL").map((s) => s.trading_symbol).slice(0, 5)
      const oversoldStocks  = scored.filter((s) => s.technical_signal === "oversold").map((s) => s.trading_symbol).slice(0, 5)
      const overboughtStocks = scored.filter((s) => s.technical_signal === "overbought").map((s) => s.trading_symbol).slice(0, 5)
      const totalInvested = inputs.reduce((s, h) => s + h.invested_amount, 0)
      const totalPnL = inputs.reduce((s, h) => s + h.unrealized_pl, 0)
      const pnlPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0

      portfolioContext = `

Portfolio Summary (live data):
- Total Invested: ₹${totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
- Total P&L: ₹${totalPnL.toLocaleString("en-IN", { maximumFractionDigits: 0 })} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)
- Holdings: ${inputs.length} stocks
- Portfolio Score: ${summary.avgScore}/100
- BUY signals: ${buySignals.join(", ") || "None"}
- SELL signals: ${sellSignals.join(", ") || "None"}
- RSI oversold (potential bounce): ${oversoldStocks.join(", ") || "None"}
- RSI overbought (caution): ${overboughtStocks.join(", ") || "None"}
- Top 10 by invested: ${scored.slice(0, 10).map((s) => `${s.trading_symbol}(${s.signal},score:${s.score},pnl:${s.pnl_pct.toFixed(1)}%,RSI≈${s.rsi_approx},MACD:${s.macd_trend})`).join(", ")}`
    }
  }

  const fullSystemPrompt = SYSTEM_PROMPT + portfolioContext

  // Resolve user-saved LLM keys (user prefs override env vars)
  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()
  const prefs = (settingsRow?.preferences as Record<string, string>) || {}
  const preferredLlm = prefs.preferred_llm || ""
  const aiModePref = (prefs.ai_mode as string) || "platform"
  const resolvedOpenai    = prefs.openai_key    || process.env.OPENAI_API_KEY    || ""
  const resolvedAnthropic = prefs.anthropic_key || process.env.ANTHROPIC_API_KEY || ""
  const resolvedGemini    = prefs.gemini_key    || process.env.GOOGLE_GEMINI_API_KEY || ""
  const resolvedDeepseek  = prefs.deepseek_key  || process.env.DEEPSEEK_API_KEY  || ""

  // Build ordered attempt list based on preferred_llm (model ID → provider)
  type LLMProvider = "openai" | "anthropic" | "gemini" | "deepseek"
  const allProviders: LLMProvider[] = ["openai", "anthropic", "gemini", "deepseek"]
  function getProvider(modelId: string): LLMProvider | null {
    if (modelId.startsWith("gpt-") || modelId === "o3" || modelId.startsWith("o4-")) return "openai"
    if (modelId.startsWith("claude-")) return "anthropic"
    if (modelId.startsWith("gemini-")) return "gemini"
    if (modelId.startsWith("deepseek-")) return "deepseek"
    return null
  }
  // Only treat `preferred_llm` as an override when user has BYOK enabled.
  const preferredProvider = aiModePref === "byok" ? getProvider(preferredLlm) : null
  const orderedProviders: LLMProvider[] = preferredProvider
    ? [preferredProvider, ...allProviders.filter((p) => p !== preferredProvider)]
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
            model: preferredProvider === "openai" ? preferredLlm : "gpt-5.1-chat-latest",
            messages: [
              { role: "system", content: fullSystemPrompt },
              ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
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
            model: preferredProvider === "anthropic" ? preferredLlm : "claude-sonnet-4-6",
            max_tokens: 800,
            system: fullSystemPrompt,
            messages: [
              ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
              { role: "user", content: message },
            ],
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
  if (!reply && resolvedGemini) {
    try {
      const geminiModel = preferredProvider === "gemini" ? preferredLlm : "gemini-2.5-flash"
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${resolvedGemini}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Gemini: system prompt prepended to first user turn; "assistant" → "model"
            system_instruction: { parts: [{ text: fullSystemPrompt }] },
            contents: [
              ...history.map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
              { role: "user", parts: [{ text: message }] },
            ],
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

  // Try DeepSeek (OpenAI-compatible endpoint)
  if (!reply && resolvedDeepseek) {
    try {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolvedDeepseek}` },
        body: JSON.stringify({
          model: preferredProvider === "deepseek" ? preferredLlm : "deepseek-chat",
          messages: [
            { role: "system", content: fullSystemPrompt },
            ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
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
    } catch {
      console.error("DeepSeek error")
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
