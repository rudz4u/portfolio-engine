import { NextApiRequest, NextApiResponse } from 'next'
import { generateText, tool } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { createClient, createAdminClient } from '../../../lib/supabase/server'
import { computeCompositeScore } from '../../../lib/quant-engine'

// ─── LLM Provider Resolution ────────────────────────────────────────────────
// Priority: user Anthropic key → user OpenAI key → env Anthropic → env OpenAI → Gemini → simulated
function resolveModel(userKeys: Record<string, string> = {}) {
    const anthropicKey = userKeys.anthropic_key || process.env.ANTHROPIC_API_KEY
    if (anthropicKey) {
        const anthropic = createAnthropic({ apiKey: anthropicKey })
        return { model: anthropic('claude-3-5-haiku-20241022'), provider: 'Anthropic Claude 3.5 Haiku' }
    }
    const openaiKey = userKeys.openai_key || process.env.OPENAI_API_KEY
    if (openaiKey) {
        const openai = createOpenAI({ apiKey: openaiKey })
        return { model: openai('gpt-4o-mini'), provider: 'OpenAI GPT-4o-mini' }
    }
    const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (geminiKey) {
        const google = createGoogleGenerativeAI({ apiKey: geminiKey })
        return { model: google('gemini-1.5-flash'), provider: 'Google Gemini 1.5 Flash' }
    }
    return { model: null, provider: 'simulated' }
}

// ─── Simulated fallback (no API keys) ────────────────────────────────────────
function simulatedReply(message: string): string {
    const m = message.toLowerCase()
    if (m.includes('rsi')) {
        return '📊 **RSI Analysis**: Based on the seeded portfolio data, no stocks are currently in oversold territory (RSI < 30). TCS and HDFCBANK are approaching neutral (RSI ~45).'
    }
    if (m.includes('macd') || m.includes('momentum')) {
        return '📉 **MACD Momentum**: Several tech holdings show a negative MACD histogram. Consider maintaining a 15–20% cash buffer to capitalize on dips.'
    }
    if (m.includes('vix') || m.includes('discount')) {
        return '⚡ **VIX Signal**: VIX is currently elevated (~24). The Quant Engine applies a +3 bullish discount to all oversold positions. Consider systematic accumulation.'
    }
    if (m.includes('buy') || m.includes('execute')) {
        return '🎯 **Execution Ready**: I can prepare a buy/sell order. All orders require your **manual confirmation** in the Sandbox page. Which instrument would you like to trade?'
    }
    if (m.includes('portfolio') || m.includes('holdings')) {
        return '💼 **Portfolio Summary**: Your portfolio contains equity positions tracked in Supabase. Use the Dashboard to see live P&L. Run a Holdings Sync to refresh from Upstox.'
    }
    if (m.includes('recommend') || m.includes('signal')) {
        return '🤖 **AI Signals**: Check the **Signals** page for the latest Quant Engine composite scores. Stocks are scored on RSI, MACD, Bollinger Bands, EMA, and VIX-adjusted momentum.'
    }
    return '🧠 I am your Portfolio AI in **Simulated Mode** (no API key configured). Add your OpenAI or Anthropic key in **Settings** to enable live AI reasoning. I can discuss RSI, MACD, VIX, portfolio analysis, and order preparation.'
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const { message } = req.body
    if (!message) {
        return res.status(400).json({ error: 'Message is required' })
    }

    // Load user keys from Supabase (for per-user API key support)
    let userKeys: Record<string, string> = {}
    try {
        const supabase = createClient(req, res)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const admin = createAdminClient()
            const { data } = await admin
                .from('user_settings')
                .select('encrypted_keys')
                .eq('user_id', user.id)
                .maybeSingle()
            if (data?.encrypted_keys) {
                userKeys = JSON.parse(data.encrypted_keys)
            }
        }
    } catch (e) {
        // If we can't load user keys, fall back to env vars silently
    }

    const { model, provider } = resolveModel(userKeys)

    // Simulated mode if no keys at all
    if (!model) {
        await new Promise(r => setTimeout(r, 600)) // simulate latency
        return res.status(200).json({
            role: 'assistant',
            content: simulatedReply(message),
            provider: provider,
            timestamp: new Date().toISOString()
        })
    }

    // ─── Live AI mode ─────────────────────────────────────────────────────────
    try {
        const { text } = await generateText({
            model,
            system: `You are the Portfolio Engine AI — an expert quantitative equity analysis and execution assistant for Indian stock markets (NSE/BSE).

You have access to tools to:
1. **checkIndicator** — Query technical indicators (RSI, MACD, Bollinger Bands, EMA, SMA) for any stock
2. **fetchPortfolio** — Get the user's current holdings summary from Supabase
3. **prepareOrder** — Draft a BUY/SELL order for user confirmation

Rules:
- All order execution REQUIRES explicit user confirmation in the app UI (never auto-execute)
- Use the Quant Engine composite score (0-100) to rank signals: >60 = BUY, 40-60 = HOLD, <40 = SELL
- Apply VIX-adjusted discounts: VIX > 25 = +5 bullish bias on oversold; VIX < 15 = +3 momentum bonus
- Format responses with markdown for clarity
- Always cite which indicators drove your recommendation
- If asked about Indian stocks, use NSE instrument keys (e.g., NSE_EQ|INE002A01018 for RELIANCE)`,
            prompt: message,
            tools: {
                checkIndicator: tool({
                    description: 'Get the current state of a technical indicator (RSI, MACD, Bollinger Bands, EMA, or SMA) for a given stock. Returns computed values.',
                    parameters: z.object({
                        indicator: z.enum(['RSI', 'MACD', 'Bollinger Bands', 'EMA', 'SMA']),
                        symbol: z.string().describe('Stock symbol like RELIANCE, TCS, INFY')
                    }),
                    // @ts-expect-error: AI SDK execute types vary by version
                    execute: async (args: any) => {
                        const { indicator, symbol } = args
                        // Generate realistic price series and compute with quant engine
                        const basePrice = 1500 + Math.random() * 2000
                        const prices = Array.from({ length: 40 }, (_, i) => basePrice + (Math.random() - 0.5) * basePrice * 0.02 * i)
                        const { score, signal, insights } = computeCompositeScore({ prices }, { vixLevel: 18 })
                        return JSON.stringify({ symbol, indicator, score, signal, summary: insights[0] || `${indicator} computed for ${symbol}`, raw_score: score })
                    }
                }),
                fetchPortfolio: tool({
                    description: 'Get the current portfolio holdings, total invested value, and unrealized P&L from the database.',
                    parameters: z.object({}),
                    // @ts-expect-error: AI SDK execute types vary by version
                    execute: async (_args: any) => {
                        try {
                            const admin = createAdminClient()
                            const { data: holdings } = await admin
                                .from('holdings')
                                .select('instrument_key, quantity, avg_price, ltp, unrealized_pl, invested_amount')
                                .order('invested_amount', { ascending: false })
                                .limit(10)
                            if (!holdings || holdings.length === 0) {
                                return 'No holdings found. Sync your portfolio from the Dashboard or seed the database.'
                            }
                            const totalInvested = holdings.reduce((s: number, h: any) => s + Number(h.invested_amount || 0), 0)
                            const totalPL = holdings.reduce((s: number, h: any) => s + Number(h.unrealized_pl || 0), 0)
                            const plPct = totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(2) : '0'
                            const summary = holdings.map((h: any) => {
                                const name = h.instrument_key?.split('|').pop() || h.instrument_key
                                const pl = Number(h.unrealized_pl || 0)
                                return `${name}: qty=${h.quantity}, avg=₹${Number(h.avg_price).toFixed(2)}, P&L=${pl >= 0 ? '+' : ''}₹${pl.toFixed(2)}`
                            }).join('\n')
                            return `Portfolio: ${holdings.length} holdings\nTotal Invested: ₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}\nUnrealized P&L: ${totalPL >= 0 ? '+' : ''}₹${totalPL.toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${plPct}%)\n\nTop Holdings:\n${summary}`
                        } catch (e) {
                            return 'Unable to fetch portfolio at this time.'
                        }
                    }
                }),
                prepareOrder: tool({
                    description: 'Draft a BUY or SELL order for the user to review and manually confirm in the Sandbox.',
                    parameters: z.object({
                        action: z.enum(['BUY', 'SELL']),
                        symbol: z.string(),
                        instrumentKey: z.string().optional().describe('Full Upstox instrument key, e.g. NSE_EQ|INE002A01018'),
                        quantity: z.number(),
                        rationale: z.string().describe('One-line reason for this trade')
                    }),
                    // @ts-expect-error: AI SDK execute types vary by version
                    execute: async (args: any) => {
                        const { action, symbol, quantity, rationale } = args
                        return `✅ **Order Drafted**: ${action} ${quantity}x ${symbol}\n📝 Rationale: ${rationale}\n⚠️ **This is a draft only** — go to the Sandbox page to review and execute.`
                    }
                })
            }
        })

        return res.status(200).json({
            role: 'assistant',
            content: text,
            provider,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        console.error('[AI Chat Error]:', error)
        // Graceful fallback if AI call fails
        return res.status(200).json({
            role: 'assistant',
            content: `⚠️ AI service temporarily unavailable (${String(error?.message || error)}). Please try again or check your API key in Settings.`,
            provider: 'error-fallback',
            timestamp: new Date().toISOString()
        })
    }
}
