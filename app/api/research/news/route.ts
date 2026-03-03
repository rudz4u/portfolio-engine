import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/research/news?q=INFY stock outlook 2026
 * Fetches news/insights via Tavily API (if key configured) or returns
 * a curated set of Indian finance search queries via DuckDuckGo instant answer.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") || ""
  const symbol = searchParams.get("symbol") || ""

  if (!query && !symbol) {
    return NextResponse.json({ error: "q or symbol param required" }, { status: 400 })
  }

  const searchQuery = query || `${symbol} NSE stock news outlook India 2026`

  // Resolve Tavily key: user prefs first, then env var
  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  const prefs = (settingsRow?.preferences as Record<string, string>) || {}
  const tavilyKey = prefs.tavily_key || process.env.TAVILY_API_KEY || ""

  if (tavilyKey) {
    // ── Tavily search ──────────────────────────────────────────────
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: searchQuery,
          search_depth: "basic",
          include_answer: true,
          include_images: false,
          max_results: 5,
          topic: "finance",
        }),
      })

      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({
          source: "tavily",
          query: searchQuery,
          answer: data.answer || null,
          results: (data.results || []).map((r: Record<string, string>) => ({
            title: r.title,
            url: r.url,
            snippet: r.content?.slice(0, 250),
            published_date: r.published_date,
          })),
        })
      }
    } catch (e) {
      console.error("Tavily error:", e)
    }
  }

  // ── Fallback: return curated finance sources for Indian markets ──
  const indianFinanceSources = [
    {
      title: "Economic Times Markets",
      url: `https://economictimes.indiatimes.com/markets/stocks/news?query=${encodeURIComponent(searchQuery)}`,
      snippet: "Latest stock news and analysis from Economic Times",
    },
    {
      title: "Moneycontrol",
      url: `https://www.moneycontrol.com/news/tags/${encodeURIComponent(symbol || "nse")}.html`,
      snippet: "Real-time market updates and expert analysis",
    },
    {
      title: "BSE India",
      url: `https://www.bseindia.com/markets/equity/EQReports/BseStockReach.html`,
      snippet: "Official BSE exchange data and filings",
    },
  ]

  return NextResponse.json({
    source: "fallback",
    query: searchQuery,
    answer: `Configure a Tavily API key in Settings to get AI-powered news research for "${searchQuery}". Links below are curated sources for Indian markets.`,
    results: indianFinanceSources,
    tip: "Add TAVILY_API_KEY to your environment or enter your Tavily key in Settings > AI Keys.",
  })
}
