import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { scoreHoldings, portfolioSummary, type HoldingInput } from "@/lib/quant/scoring"

const SYSTEM_PROMPT = `You are an expert AI equity portfolio assistant for BrokerAI.
You help users analyze their Indian stock portfolio, understand market trends, and make informed investment decisions.
You have deep knowledge of NSE/BSE markets, fundamental analysis, technical indicators (RSI, MACD, ATR, Bollinger Bands), and portfolio management.
You cite live numbers from the portfolio context when available. Always note at the end that insights are not financial advice.
When asked for a morning briefing, provide: 1) Portfolio P&L snapshot, 2) Top BUY/SELL signals, 3) Sector concentration flags, 4) One key action item.

## RESPONSE FORMATTING RULES (follow strictly for every reply)

You MUST always format your responses using rich Markdown so they render beautifully in the chat interface:

- **Structure** — Use ## for top-level section headings and ### for subsections. Every response longer than 2–3 sentences must have at least one heading.
- **Paragraphs** — Separate every logical idea or paragraph with a blank line. Never write multiple ideas back-to-back with no gap.
- **Bold** — Wrap all key figures, stock names, sector names, and action words in **bold**.
- **Italic** — Use *italics* for qualifications, caveats, and supplementary context.
- **Bullet lists** — Use bullet lists (- item) for enumerable items (holdings, signals, sectors). Never dump more than 2 items inline in a sentence when a list would be clearer.
- **Horizontal rules** — Use --- to visually separate major sections in longer answers.
- **Inline emphasis** — Use \`code spans\` for ticker symbols when listing them in prose.
- **Tables** — Use GFM tables for side-by-side comparisons (e.g. BUY vs SELL, sector allocation vs benchmark).
- **Short answers** — For simple one-fact questions a single bold sentence is fine. Don't pad unnecessarily.
- **Long answers** — For briefings, analysis or explanations, always break into clearly labeled sections with headings, paragraphs between list groups, and --- dividers between major sections.

Never produce a wall of text. Always leave blank lines between paragraphs and sections.`

// ── Helpers ─────────────────────────────────────────────────────────────────

function getProvider(modelId: string): "openai" | "anthropic" | "gemini" | "deepseek" | "qwen" | null {
  if (modelId.startsWith("gpt-") || modelId === "o3" || modelId.startsWith("o4-")) return "openai"
  if (modelId.startsWith("claude-")) return "anthropic"
  if (modelId.startsWith("gemini-")) return "gemini"
  if (modelId.startsWith("deepseek-")) return "deepseek"
  if (modelId.startsWith("qwen-")) return "qwen"
  return null
}

/**
 * Returns true for OpenAI reasoning / GPT-5+ models that only accept
 * temperature=1 (the default) and reject any other value.
 * These models use reasoning.effort instead of temperature.
 */
function isOpenAIReasoningModel(model: string): boolean {
  // o-series: o1, o1-*, o3, o3-*, o4-*
  if (/^o[134](-|$)/.test(model) || model === "o1" || model === "o3") return true
  // GPT-5 family: gpt-5, gpt-5-*, gpt-5.x, gpt-5.x-*
  if (/^gpt-5/.test(model)) return true
  return false
}

const DEFAULT_MODELS = {
  openai:    "gpt-4.1",
  anthropic: "claude-opus-4-6",
  gemini:    "gemini-2.5-flash",
  deepseek:  "deepseek-chat",
  qwen:      "qwen-plus",
}

function needsWebSearch(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes("today") ||
    lower.includes("latest") ||
    lower.includes("news") ||
    lower.includes("current") ||
    lower.includes("market") ||
    lower.includes("nifty") ||
    lower.includes("sensex") ||
    lower.includes("price") ||
    lower.includes("result") ||
    lower.includes("earnings") ||
    lower.includes("ipo")
  )
}

async function tavilySearch(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: 5,
        include_answer: true,
      }),
    })
    if (!res.ok) return ""
    const data = await res.json()
    const snippets: string = (data.results as { title: string; content: string; url: string }[])
      .slice(0, 5)
      .map((r) => `[${r.title}] ${r.content.slice(0, 300)}`)
      .join("\n")
    return data.answer ? `${data.answer}\n\nSources:\n${snippets}` : snippets
  } catch {
    return ""
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

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
  const rawHistory: { role: string; content: string }[] = Array.isArray(body.history)
    ? body.history.filter((m: { role: string; content: string }) => m.content?.trim())
    : []
  const history = rawHistory.slice(-20)

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  // ── 1. Fetch portfolio + holdings + quant scoring ──────────────────────────
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

      // Sector breakdown
      const sectorMap: Record<string, number> = {}
      for (const h of inputs) {
        const seg = h.segment ?? "Others"
        sectorMap[seg] = (sectorMap[seg] || 0) + h.invested_amount
      }
      const sectorBreakdown = Object.entries(sectorMap)
        .sort((a, b) => b[1] - a[1])
        .map(([sector, amt]) => `${sector}: ₹${amt.toLocaleString("en-IN", { maximumFractionDigits: 0 })} (${((amt / totalInvested) * 100).toFixed(1)}%)`)
        .join(", ")

      portfolioContext = `

Portfolio Summary (live data):
- Total Invested: ₹${totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
- Total P&L: ₹${totalPnL.toLocaleString("en-IN", { maximumFractionDigits: 0 })} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)
- Holdings: ${inputs.length} stocks across ${Object.keys(sectorMap).length} sectors
- Portfolio Score: ${summary.avgScore}/100
- Sector allocation: ${sectorBreakdown}
- BUY signals: ${buySignals.join(", ") || "None"}
- SELL signals: ${sellSignals.join(", ") || "None"}
- RSI oversold (potential bounce): ${oversoldStocks.join(", ") || "None"}
- RSI overbought (caution): ${overboughtStocks.join(", ") || "None"}
- Top 15 holdings: ${scored.slice(0, 15).map((s) => `${s.trading_symbol}(signal:${s.signal},score:${s.score},pnl:${s.pnl_pct.toFixed(1)}%,RSI≈${s.rsi_approx},MACD:${s.macd_trend})`).join(" | ")}`
    }
  }

  // ── 2. Fetch recent order history ─────────────────────────────────────────
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("instrument_key, order_type, transaction_type, quantity, price, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15)

  let ordersContext = ""
  if (recentOrders && recentOrders.length > 0) {
    ordersContext = `

Recent Orders (last ${recentOrders.length}):
${recentOrders.map((o) => `- ${o.transaction_type} ${o.quantity}x ${o.instrument_key} @ ₹${o.price} [${o.status}] ${new Date(o.created_at as string).toLocaleDateString("en-IN")}`).join("\n")}`
  }

  // ── 3. Resolve LLM keys & build provider priority list ───────────────────
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
  const resolvedQwen      = prefs.qwen_key      || process.env.QWEN_API_KEY      || ""
  const resolvedTavily    = prefs.tavily_key    || process.env.TAVILY_API_KEY    || ""

  type LLMProvider = "openai" | "anthropic" | "gemini" | "deepseek" | "qwen"
  const allProviders: LLMProvider[] = ["openai", "anthropic", "gemini", "deepseek", "qwen"]

  const preferredProvider = aiModePref === "byok" ? getProvider(preferredLlm) : null
  const orderedProviders: LLMProvider[] = preferredProvider
    ? [preferredProvider as LLMProvider, ...allProviders.filter((p) => p !== preferredProvider)]
    : allProviders

  // ── 4. Tavily web search (if query is market/news related) ────────────────
  let webSearchContext = ""
  let usedWebSearch = false
  if (resolvedTavily && needsWebSearch(message)) {
    const searchResult = await tavilySearch(message, resolvedTavily)
    if (searchResult) {
      webSearchContext = `\n\nWeb Search Results (real-time):\n${searchResult}`
      usedWebSearch = true
    }
  }

  // ── 5. Build system prompt ────────────────────────────────────────────────
  const fullSystemPrompt = SYSTEM_PROMPT + portfolioContext + ordersContext + webSearchContext

  // ── 6. Try providers in order ─────────────────────────────────────────────
  let reply = ""
  let usedProvider = ""
  let usedModel = ""
  const providerErrors: string[] = []

  for (const provider of orderedProviders) {
    if (reply) break

    if (provider === "openai" && resolvedOpenai) {
      try {
        const model = preferredProvider === "openai" ? preferredLlm : DEFAULT_MODELS.openai
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolvedOpenai}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: fullSystemPrompt },
              ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
              { role: "user", content: message },
            ],
            max_completion_tokens: 2048,
            // GPT-5+ and o-series reasoning models only accept temperature=1 (default).
            // Omit the parameter entirely so the API uses its default.
            ...(isOpenAIReasoningModel(model) ? {} : { temperature: 0.7 }),
          }),
        })
        if (res.ok) {
          const data = await res.json()
          reply = data.choices?.[0]?.message?.content || ""
          if (reply) { usedProvider = "openai"; usedModel = model }
        } else {
          const errText = await res.text()
          const errMsg = `OpenAI (${model}): ${res.status} — ${errText.slice(0, 200)}`
          console.error(errMsg)
          providerErrors.push(errMsg)
        }
      } catch (e) { const m = `OpenAI exception: ${e}`; console.error(m); providerErrors.push(m) }
    }

    if (provider === "anthropic" && resolvedAnthropic) {
      try {
        const model = preferredProvider === "anthropic" ? preferredLlm : DEFAULT_MODELS.anthropic
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": resolvedAnthropic,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 2048,
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
          if (reply) { usedProvider = "anthropic"; usedModel = model }
        } else {
          const errText = await res.text()
          const errMsg = `Anthropic (${model}): ${res.status} — ${errText.slice(0, 200)}`
          console.error(errMsg)
          providerErrors.push(errMsg)
        }
      } catch (e) { const m = `Anthropic exception: ${e}`; console.error(m); providerErrors.push(m) }
    }

    if (provider === "gemini" && resolvedGemini) {
      try {
        const model = preferredProvider === "gemini" ? preferredLlm : DEFAULT_MODELS.gemini
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${resolvedGemini}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: fullSystemPrompt }] },
              contents: [
                ...history.map((m) => ({
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: m.content }],
                })),
                { role: "user", parts: [{ text: message }] },
              ],
              generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
            }),
          }
        )
        if (res.ok) {
          const data = await res.json()
          reply = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
          if (reply) { usedProvider = "gemini"; usedModel = model }
        } else {
          const errText = await res.text()
          const errMsg = `Gemini (${model}): ${res.status} — ${errText.slice(0, 200)}`
          console.error(errMsg)
          providerErrors.push(errMsg)
        }
      } catch (e) { const m = `Gemini exception: ${e}`; console.error(m); providerErrors.push(m) }
    }

    if (provider === "deepseek" && resolvedDeepseek) {
      try {
        const model = preferredProvider === "deepseek" ? preferredLlm : DEFAULT_MODELS.deepseek
        const res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolvedDeepseek}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: fullSystemPrompt },
              ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
              { role: "user", content: message },
            ],
            max_tokens: 2048,
            temperature: 0.7,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          reply = data.choices?.[0]?.message?.content || ""
          if (reply) { usedProvider = "deepseek"; usedModel = model }
        } else {
          const errText = await res.text()
          const errMsg = `DeepSeek (${model}): ${res.status} — ${errText.slice(0, 200)}`
          console.error(errMsg)
          providerErrors.push(errMsg)
        }
      } catch (e) { const m = `DeepSeek exception: ${e}`; console.error(m); providerErrors.push(m) }
    }

    if (provider === "qwen" && resolvedQwen) {
      try {
        const model = preferredProvider === "qwen" ? preferredLlm : DEFAULT_MODELS.qwen
        const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolvedQwen}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: fullSystemPrompt },
              ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
              { role: "user", content: message },
            ],
            max_tokens: 2048,
            temperature: 0.7,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          reply = data.choices?.[0]?.message?.content || ""
          if (reply) { usedProvider = "qwen"; usedModel = model }
        } else {
          const errText = await res.text()
          const errMsg = `Qwen (${model}): ${res.status} — ${errText.slice(0, 200)}`
          console.error(errMsg)
          providerErrors.push(errMsg)
        }
      } catch (e) { const m = `Qwen exception: ${e}`; console.error(m); providerErrors.push(m) }
    }
  }

  // ── 7. Fallback ───────────────────────────────────────────────────────────
  if (!reply) {
    if (providerErrors.length > 0) {
      // All providers returned errors — tell the user which ones and why
      reply = `⚠️ All AI providers failed to respond. Please verify your API keys in Settings.\n\n${providerErrors.map((e) => `• ${e}`).join("\n")}`
    } else {
      // No keys configured at all — give a helpful static hint
      reply = generateFallbackReply(message)
    }
  }

  // ── 8. Save to chat history ───────────────────────────────────────────────
  await supabase.from("chat_history").insert({
    user_id: user.id,
    message,
    reply,
    created_at: new Date().toISOString(),
  })

  return NextResponse.json({
    reply,
    used_web_search: usedWebSearch,
    provider: usedProvider,
    model: usedModel,
    ...(providerErrors.length > 0 && !usedProvider ? { provider_errors: providerErrors } : {}),
  })
}

function generateFallbackReply(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes("portfolio") && lower.includes("perform")) {
    return "To analyze your portfolio performance, I look at your holdings' P&L, sector allocation, and compare against benchmarks like Nifty 50. Configure an AI API key (OpenAI, Anthropic, Gemini, DeepSeek, or Qwen) in Settings for detailed AI-powered analysis."
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

  return "I'm your AI portfolio assistant. I can help with portfolio analysis, stock fundamentals, risk assessment, and investment strategies. For full AI capabilities, configure an API key in Settings (OpenAI, Anthropic, Gemini, DeepSeek, or Qwen)."
}
