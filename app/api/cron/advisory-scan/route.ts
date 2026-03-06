/**
 * POST /api/cron/advisory-scan
 *
 * Cron endpoint for the Advisory Intelligence System.
 * Called 4×/day Mon–Fri by the advisory-scan Netlify scheduled function.
 *
 * Pipeline:
 *  1. Fetch all active advisory sources from DB
 *  2. Collect all tracked symbols (across all users' portfolios + watchlists)
 *  3. Scrape each source (Tavily and/or direct fetch)
 *  4. Extract structured recommendations via LLM (Gemini/OpenAI)
 *  5. Resolve stock names to NSE trading_symbol + instrument_key
 *  6. Persist new recommendations (deduped by unique index)
 *  7. Compute weighted consensus per symbol
 *  8. Upsert consensus rows (one per symbol per day)
 *  9. Evaluate pending call outcomes + update track records
 *
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { scrapeAllSources } from "@/lib/advisory/scraper"
import { extractAllRecommendations } from "@/lib/advisory/extractor"
import { resolveRecommendations } from "@/lib/advisory/symbol-resolver"
import { groupBySymbol, computeAllConsensus } from "@/lib/advisory/consensus"
import { evaluateTrackRecords } from "@/lib/advisory/track-record"
import type { AdvisorySource, AdvisoryTrackRecord } from "@/lib/advisory/types"

export const dynamic = "force-dynamic"
export const maxDuration = 120 // 2 min — Netlify pro allows up to 120s

/** Validate Bearer token against the service role key */
function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") ?? ""
  const token = auth.replace(/^Bearer\s+/i, "")
  return !!token && token === process.env.SUPABASE_SERVICE_ROLE_KEY
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startMs = Date.now()
  const supabase = createServiceClient()
  const tavilyKey = process.env.TAVILY_API_KEY ?? ""

  if (!tavilyKey) {
    console.warn("[advisory-scan] TAVILY_API_KEY not set — Tavily scrapes will fail")
  }

  // ── 1. Fetch active sources ────────────────────────────────────────────
  const { data: sources, error: sourcesErr } = await supabase
    .from("advisory_sources")
    .select("*")
    .eq("active", true)
    .order("tier", { ascending: true })

  if (sourcesErr || !sources || sources.length === 0) {
    return NextResponse.json({ error: "No active advisory sources found", sourcesErr }, { status: 500 })
  }

  // ── 2. Collect all tracked symbols across all users ────────────────────
  const [holdingsRes, watchlistRes] = await Promise.all([
    supabase.from("holdings").select("trading_symbol"),
    supabase.from("watchlist_items").select("trading_symbol"),
  ])

  const allSymbols = new Set<string>()
  for (const h of holdingsRes.data ?? []) {
    if (h.trading_symbol) allSymbols.add(h.trading_symbol.toUpperCase())
  }
  for (const w of watchlistRes.data ?? []) {
    if (w.trading_symbol) allSymbols.add(w.trading_symbol.toUpperCase())
  }
  const symbolList = Array.from(allSymbols)
  console.log(`[advisory-scan] Tracking ${symbolList.length} unique symbols from ${sources.length} sources`)

  // ── 3. Scrape ──────────────────────────────────────────────────────────
  const rawContents = await scrapeAllSources(sources as AdvisorySource[], symbolList, tavilyKey)
  console.log(`[advisory-scan] Scraped ${rawContents.length} content blocks in ${Date.now() - startMs}ms`)

  if (rawContents.length === 0) {
    return NextResponse.json({ message: "No content scraped", symbolCount: symbolList.length })
  }

  // ── 4. Extract recommendations ─────────────────────────────────────────
  const extractionResults = await extractAllRecommendations(rawContents)
  const allRaws = extractionResults.flatMap(({ source_id, recs }) =>
    recs.map((r) => ({ ...r, source_id }))
  )
  console.log(`[advisory-scan] Extracted ${allRaws.length} raw recs in ${Date.now() - startMs}ms`)

  // ── 5. Resolve symbols ─────────────────────────────────────────────────
  // Pass no allowedSymbols (empty = keep all resolved recs globally).
  // Per-user filtering happens in the /api/advisory/consensus endpoint.
  const resolved = await resolveRecommendations(allRaws)
  console.log(`[advisory-scan] Resolved ${resolved.length}/${allRaws.length} recs to known instruments`)

  // ── 6. Persist recommendations ─────────────────────────────────────────
  let persistedCount = 0
  if (resolved.length > 0) {
    const rows = resolved.map((r) => ({
      source_id: (r as typeof r & { source_id: string }).source_id,
      trading_symbol: r.resolved_symbol,
      instrument_key: r.instrument_key,
      signal: r.signal,
      target_price: r.target_price,
      stop_loss: r.stop_loss,
      horizon: r.horizon,
      rationale: r.rationale,
      source_url: r.source_url,
      published_at: r.published_at,
    }))

    // ── Step A: intra-batch dedup ─────────────────────────────────────────
    // Deduplicate by (source_id, trading_symbol, signal, UTC day) so a single
    // batch never contains two rows that would conflict with each other.
    const seenKeys = new Set<string>()
    const dedupedRows = rows.filter((row) => {
      const day = row.published_at
        ? new Date(row.published_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
      const k = `${row.source_id}|${row.trading_symbol}|${row.signal}|${day}`
      if (seenKeys.has(k)) return false
      seenKeys.add(k)
      return true
    })

    // ── Step B: pre-filter against DB ────────────────────────────────────
    // PostgREST's upsert/ignoreDuplicates only targets the PK, not our
    // expression-based unique index (advisory_recs_dedup_idx). Pre-filtering
    // is the reliable way to avoid 23505 on the custom expression index.
    //
    // Fetch existing records for each source_id that appears in this batch,
    // published/scraped in the last 48 h to cover any timezone edge (UTC vs IST).
    const batchSourceIds = [...new Set(dedupedRows.map((r) => r.source_id))]
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from("advisory_recommendations")
      .select("source_id, trading_symbol, signal, published_at, scraped_at")
      .in("source_id", batchSourceIds)
      .or(`published_at.gte.${since48h},scraped_at.gte.${since48h}`)

    const existingKeys = new Set<string>()
    for (const e of existing ?? []) {
      const day = (e.published_at ?? e.scraped_at ?? new Date().toISOString())
        .split("T")[0]
      existingKeys.add(`${e.source_id}|${e.trading_symbol}|${e.signal}|${day}`)
    }

    const newRows = dedupedRows.filter((row) => {
      const day = row.published_at
        ? new Date(row.published_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
      return !existingKeys.has(`${row.source_id}|${row.trading_symbol}|${row.signal}|${day}`)
    })

    if (newRows.length > 0) {
      const { error: insertErr, count } = await supabase
        .from("advisory_recommendations")
        .insert(newRows, { count: "exact" })

      persistedCount = count ?? newRows.length
      if (insertErr) console.error("[advisory-scan] Insert error:", insertErr)
    } else {
      console.log("[advisory-scan] All resolved recs already exist in DB — nothing new to insert")
    }
  }

  // ── 7. Compute consensus ───────────────────────────────────────────────
  const { data: trackRecords } = await supabase
    .from("advisory_track_records")
    .select("*")
    .eq("period_days", 30)

  const grouped = groupBySymbol(
    resolved as Array<typeof resolved[0] & { source_id: string }>,
    sources as AdvisorySource[],
    (trackRecords ?? []) as AdvisoryTrackRecord[]
  )
  const consensusResults = computeAllConsensus(grouped)

  // ── 8. Upsert consensus ────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const consensusRows = consensusResults.map((c) => ({
    trading_symbol: c.trading_symbol,
    instrument_key: c.instrument_key,
    consensus_date: today,
    buy_count: c.buy_count,
    sell_count: c.sell_count,
    hold_count: c.hold_count,
    neutral_count: c.neutral_count,
    total_sources: c.total_sources,
    weighted_score: c.weighted_score,
    contributing_sources: c.contributing_sources,
    advisory_score: c.advisory_score,
    consensus_signal: c.consensus_signal,
    computed_at: new Date().toISOString(),
  }))

  if (consensusRows.length > 0) {
    await supabase
      .from("advisory_consensus")
      .upsert(consensusRows, { onConflict: "trading_symbol,consensus_date" })
  }

  // ── 9. Evaluate track records ──────────────────────────────────────────
  // Build current prices map from holdings.ltp
  const { data: ltpRows } = await supabase
    .from("holdings")
    .select("trading_symbol, ltp")
    .not("ltp", "is", null)

  const currentPrices = new Map<string, number>(
    (ltpRows ?? [])
      .filter((r: { trading_symbol: string | null; ltp: number | null }) => r.trading_symbol && r.ltp)
      .map((r: { trading_symbol: string | null; ltp: number | null }) => [r.trading_symbol!.toUpperCase(), Number(r.ltp)])
  )

  const updatedTrackRecords = await evaluateTrackRecords(supabase, currentPrices)

  if (updatedTrackRecords.length > 0) {
    await supabase
      .from("advisory_track_records")
      .upsert(updatedTrackRecords, { onConflict: "source_id,period_days" })
  }

  const elapsed = Date.now() - startMs
  console.log(`[advisory-scan] Completed in ${elapsed}ms`)

  return NextResponse.json({
    ok: true,
    elapsed_ms: elapsed,
    sources_scraped: rawContents.length,
    recs_extracted: allRaws.length,
    recs_resolved: resolved.length,
    recs_persisted: persistedCount,
    consensus_updated: consensusRows.length,
    track_records_updated: updatedTrackRecords.length,
  })
}
