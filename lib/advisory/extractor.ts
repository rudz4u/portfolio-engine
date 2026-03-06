/**
 * Advisory Extractor
 *
 * Uses the configured LLM (Gemini by default, falls back to OpenAI) to
 * extract structured BUY/SELL/HOLD signals from raw advisory content.
 *
 * Returns RawRecommendation[] for downstream symbol resolution.
 */

import type { RawSourceContent, RawRecommendation } from "./types"

// ── LLM call helpers ─────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a financial data extraction assistant.
Given a block of text from an Indian stock advisory firm, extract every BUY, SELL, HOLD, or NEUTRAL recommendation mentioned.

Return a JSON array. Each element must have EXACTLY these fields:
{
  "stock_name": "<company name as written in the text>",
  "trading_symbol": "<NSE symbol if explicitly mentioned, else null>",
  "signal": "BUY" | "SELL" | "HOLD" | "NEUTRAL",
  "target_price": <number or null>,
  "stop_loss": <number or null>,
  "horizon": "<e.g. '3 months', '1 year', null>",
  "rationale": "<1–2 sentence summary of why, or null>",
  "source_url": null,
  "published_at": "<ISO date string if mentioned, else null>"
}

Rules:
- Only include real, named Indian equities (NSE/BSE listed).
- Skip ETFs, mutual funds, indices, and generic sector advice.
- If the text says "target of ₹250" interpret as target_price: 250.
- Do NOT invent data. If information is absent, use null.
- Return ONLY a valid JSON array — no markdown, no explanation.`

async function callGemini(content: string, apiKey: string): Promise<RawRecommendation[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: EXTRACTION_PROMPT },
            { text: `\n\n---\nSOURCE TEXT:\n${content.slice(0, 10000)}` },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  })

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const text: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

  return parseJsonResponse(text)
}

async function callOpenAI(content: string, apiKey: string): Promise<RawRecommendation[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 2048,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `SOURCE TEXT:\n${content.slice(0, 10000)}` },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ""
  return parseJsonResponse(text)
}

function parseJsonResponse(text: string): RawRecommendation[] {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r) =>
        r &&
        typeof r.stock_name === "string" &&
        ["BUY", "SELL", "HOLD", "NEUTRAL"].includes(r.signal)
    ) as RawRecommendation[]
  } catch {
    console.warn("[extractor] Failed to parse LLM JSON:", cleaned.slice(0, 200))
    return []
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract structured recommendations from a raw source content block.
 * Tries Gemini first, falls back to OpenAI if Gemini key not set.
 */
export async function extractRecommendations(
  raw: RawSourceContent
): Promise<RawRecommendation[]> {
  const geminiKey = process.env.GEMINI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!geminiKey && !openaiKey) {
    console.error("[extractor] No LLM API key configured (GEMINI_API_KEY or OPENAI_API_KEY)")
    return []
  }

  try {
    const recs = geminiKey
      ? await callGemini(raw.content, geminiKey)
      : await callOpenAI(raw.content, openaiKey!)

    // Attach source_url from the raw object
    return recs.map((r) => ({
      ...r,
      source_url: r.source_url || raw.url,
    }))
  } catch (err) {
    console.error(`[extractor] ${raw.source_name} extraction error:`, err)

    // Try fallback LLM
    if (geminiKey && openaiKey) {
      try {
        const recs = await callOpenAI(raw.content, openaiKey)
        return recs.map((r) => ({ ...r, source_url: r.source_url || raw.url }))
      } catch (fallbackErr) {
        console.error(`[extractor] ${raw.source_name} OpenAI fallback error:`, fallbackErr)
      }
    }

    return []
  }
}

/**
 * Extract recommendations from multiple raw content blocks concurrently.
 * Rate-limited to 3 concurrent LLM calls to control costs.
 */
export async function extractAllRecommendations(
  rawContents: RawSourceContent[]
): Promise<Array<{ source_id: string; recs: RawRecommendation[] }>> {
  const results: Array<{ source_id: string; recs: RawRecommendation[] }> = []

  for (let i = 0; i < rawContents.length; i += 3) {
    const batch = rawContents.slice(i, i + 3)
    const batchResults = await Promise.allSettled(
      batch.map((raw) => extractRecommendations(raw).then((recs) => ({ source_id: raw.source_id, recs })))
    )
    for (const r of batchResults) {
      if (r.status === "fulfilled") results.push(r.value)
    }
  }

  return results
}
