/**
 * Advisory Scraper
 *
 * Fetches raw content for an advisory source using two modes:
 *   - "tavily"  Tavily search API (reliable, rate-limited)
 *   - "fetch"   Direct HTTP GET + HTML extraction
 *   - "both"    Tavily first, then direct fetch for supplementary content
 *
 * Returns RawSourceContent[] ready for the LLM extractor.
 */

import type { AdvisorySource, RawSourceContent } from "./types"

const TAVILY_API_URL = "https://api.tavily.com/search"

/** Thrown when Tavily returns 432 (monthly credits exhausted). */
class TavilyRateLimitError extends Error {
  constructor() { super("Tavily credits exhausted (HTTP 432)") }
}

// ── Tavily mode ─────────────────────────────────────────────────────────────

async function fetchViaTavily(
  source: AdvisorySource,
  stockSymbols: string[],
  tavilyKey: string
): Promise<RawSourceContent[]> {
  const results: RawSourceContent[] = []

  // Build a targeted query: "ICICI Securities stock recommendation BUY SELL 2026"
  const query = `${source.name} stock recommendation BUY SELL ${stockSymbols.slice(0, 8).join(" ")} ${new Date().getFullYear()}`

  try {
    const res = await fetch(TAVILY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: "basic",    // 1 credit vs 2 for "advanced"
        include_answer: false,
        include_raw_content: false,
        max_results: 3,            // was 5 — reduces credit burn
        include_domains: source.website_url ? [new URL(source.website_url).hostname] : undefined,
      }),
    })

    if (res.status === 432) {
      // Monthly credits exhausted — throw so callers can fall back to direct fetch
      throw new TavilyRateLimitError()
    }

    if (!res.ok) {
      console.error(`[scraper/tavily] ${source.name} HTTP ${res.status}`)
      return []
    }

    const data = await res.json()
    const answer: string = data.answer || ""
    const tavilyResults: { url: string; content: string; title?: string }[] = data.results || []

    // Combine answer + individual result content
    const combined = [
      answer,
      ...tavilyResults.map((r) => `${r.title || ""}\n${r.content}`),
    ]
      .filter(Boolean)
      .join("\n\n---\n\n")

    if (combined.trim()) {
      results.push({
        source_id: source.id,
        source_name: source.name,
        url: source.website_url || TAVILY_API_URL,
        content: combined.slice(0, 8000), // extractor uses first 6K; keep 8K as buffer
        fetched_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error(`[scraper/tavily] ${source.name} error:`, err)
  }

  return results
}

// ── Direct fetch mode ────────────────────────────────────────────────────────

async function fetchDirect(source: AdvisorySource): Promise<RawSourceContent[]> {
  if (!source.website_url) return []

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(source.website_url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[scraper/fetch] ${source.name} HTTP ${res.status}`)
      return []
    }

    const html = await res.text()
    // Strip script/style tags and extract visible text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{3,}/g, "\n")
      .trim()
      .slice(0, 8000) // match Tavily cap

    if (text) {
      return [
        {
          source_id: source.id,
          source_name: source.name,
          url: source.website_url,
          content: text,
          fetched_at: new Date().toISOString(),
        },
      ]
    }
  } catch (err) {
    console.error(`[scraper/fetch] ${source.name} error:`, err)
  }

  return []
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch raw content for a single advisory source.
 *
 * @param source       The advisory source config
 * @param symbols      List of relevant stock symbols (for Tavily query context)
 * @param tavilyKey    Tavily API key
 */
export async function scrapeSource(
  source: AdvisorySource,
  symbols: string[],
  tavilyKey: string
): Promise<RawSourceContent[]> {
  if (!source.active) return []

  switch (source.scrape_mode) {
    case "tavily":
      try {
        return await fetchViaTavily(source, symbols, tavilyKey)
      } catch (err) {
        if (err instanceof TavilyRateLimitError) {
          console.warn(`[scraper] Tavily credits exhausted — direct-fetch fallback for ${source.name}`)
          return fetchDirect(source)
        }
        console.error(`[scraper/tavily] ${source.name} unexpected error:`, err)
        return []
      }

    case "fetch":
      return fetchDirect(source)

    case "both": {
      // Run in sequence so a 432 on Tavily doesn't block the direct fetch
      let tavilyContent: RawSourceContent[] = []
      try {
        tavilyContent = await fetchViaTavily(source, symbols, tavilyKey)
      } catch (err) {
        if (err instanceof TavilyRateLimitError) {
          console.warn(`[scraper] Tavily credits exhausted — skipping Tavily for ${source.name}`)
        } else {
          console.error(`[scraper/tavily] ${source.name} unexpected error:`, err)
        }
      }
      const directContent = await fetchDirect(source)
      return [...tavilyContent, ...directContent]
    }

    default:
      return []
  }
}

/**
 * Scrape all active advisory sources concurrently (max 5 parallel).
 */
export async function scrapeAllSources(
  sources: AdvisorySource[],
  symbols: string[],
  tavilyKey: string
): Promise<RawSourceContent[]> {
  const active = sources.filter((s) => s.active)

  // All sources in parallel — Tavily rate-limiting is handled per-source with
  // direct-fetch fallback, so sequential batching only adds latency here.
  const batchResults = await Promise.allSettled(
    active.map((s) => scrapeSource(s, symbols, tavilyKey))
  )

  const results: RawSourceContent[] = []
  for (const r of batchResults) {
    if (r.status === "fulfilled") results.push(...r.value)
  }

  return results
}
