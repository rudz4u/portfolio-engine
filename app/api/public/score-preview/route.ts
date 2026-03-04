import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

// Simple in-memory rate limiter: IP → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// Map composite score to signal label
function scoreToSignal(score: number): { signal: string; color: string } {
  if (score >= 75) return { signal: "STRONG BUY",  color: "emerald" }
  if (score >= 60) return { signal: "BUY",          color: "green" }
  if (score >= 45) return { signal: "HOLD",         color: "amber" }
  if (score >= 30) return { signal: "SELL",         color: "orange" }
  return             { signal: "STRONG SELL",  color: "red" }
}

export async function GET(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 })
  }

  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase().trim()
  if (!symbol || symbol.length > 20) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Check if symbol exists in instruments table
  const { data: instrument } = await supabase
    .from("instruments")
    .select("symbol, name, exchange")
    .eq("symbol", symbol)
    .single()

  if (!instrument) {
    // Try partial match for common names
    const { data: fuzzy } = await supabase
      .from("instruments")
      .select("symbol, name, exchange")
      .ilike("symbol", `${symbol}%`)
      .limit(3)

    if (!fuzzy || fuzzy.length === 0) {
      return NextResponse.json({
        found: false,
        symbol,
        message: `${symbol} is not yet in our universe. Sign up to request it.`,
      })
    }
    // Return suggestions
    const symbols = (fuzzy as { symbol: string }[]).map((i) => i.symbol)
    return NextResponse.json({
      found: false,
      symbol,
      suggestions: symbols,
      message: `Did you mean: ${symbols.join(", ")}?`,
    })
  }

  // 2. Look for today's composite score in analysis_reports (any user's report — public data only)
  const today = new Date().toISOString().split("T")[0]
  const { data: report } = await supabase
    .from("analysis_reports")
    .select("symbol, composite_score, signal, generated_at")
    .eq("symbol", symbol)
    .gte("generated_at", `${today}T00:00:00`)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single()

  if (report) {
    const { signal, color } = scoreToSignal(report.composite_score)
    return NextResponse.json({
      found: true,
      symbol: report.symbol,
      name: instrument.name,
      exchange: instrument.exchange,
      composite_score: Math.round(report.composite_score),
      signal,
      signal_color: color,
      updated_at: report.generated_at,
      is_preview: true,
      note: "Sign up to see full breakdown: momentum, valuation, position sizing, and advisory scores.",
    })
  }

  // 3. No today's report — return a lightweight score scaffold (no DB write)
  // We don't run a full computation here (no LLM, no holdings needed).
  // Return a "data pending" response that still hooks the user.
  return NextResponse.json({
    found: true,
    symbol: instrument.symbol,
    name: instrument.name,
    exchange: instrument.exchange,
    composite_score: null,
    signal: "PENDING",
    signal_color: "muted",
    is_preview: true,
    note: `Sign up and sync your portfolio to generate a live quant score for ${instrument.symbol}.`,
  })
}
