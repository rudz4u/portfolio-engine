/**
 * Symbol Resolver
 *
 * Resolves a raw stock name (as extracted by the LLM) to a confirmed
 * NSE trading_symbol + instrument_key from the instruments table.
 *
 * Strategy (in order):
 *  1. Exact match on trading_symbol (case-insensitive)
 *  2. ilike match on trading_symbol prefix
 *  3. ilike match on name (company name)
 *
 * Only stocks that exist in the user's portfolio OR active watchlists
 * are returned — we never score stocks the user isn't tracking.
 */

import { createServiceClient } from "@/lib/supabase/server"
import type { RawRecommendation, ResolvedRecommendation } from "./types"

interface InstrumentRow {
  trading_symbol: string
  instrument_key: string
  name: string
}

/** Returns a de-duped list of symbols the user cares about (portfolio + watchlists) */
export async function getUserSymbols(userId: string): Promise<string[]> {
  const supabase = createServiceClient()

  const [holdingsRes, watchlistRes] = await Promise.all([
    // Portfolio holdings
    supabase
      .from("holdings")
      .select("trading_symbol, portfolios!inner(user_id)")
      .eq("portfolios.user_id", userId),

    // Watchlist items — join through watchlists table
    supabase
      .from("watchlist_items")
      .select("trading_symbol, watchlists!inner(user_id)")
      .eq("watchlists.user_id", userId),
  ])

  const symbols = new Set<string>()

  for (const h of holdingsRes.data ?? []) {
    if (h.trading_symbol) symbols.add(h.trading_symbol.toUpperCase())
  }
  for (const w of watchlistRes.data ?? []) {
    if (w.trading_symbol) symbols.add(w.trading_symbol.toUpperCase())
  }

  return Array.from(symbols)
}

/**
 * Resolve a single raw recommendation to a confirmed instrument.
 * Returns null if no match found in the instruments table.
 */
async function resolveOne(
  raw: RawRecommendation
): Promise<ResolvedRecommendation | null> {
  const supabase = createServiceClient()

  // Normalise the raw symbol/name
  const candidate = (raw.trading_symbol || raw.stock_name || "").trim().toUpperCase()
  if (!candidate) return null

  // Try exact match first (fastest)
  const { data: exact } = await supabase
    .from("instruments")
    .select("trading_symbol, instrument_key, name")
    .eq("trading_symbol", candidate)
    .limit(1)
    .maybeSingle()

  if (exact) {
    return {
      ...raw,
      resolved_symbol: exact.trading_symbol,
      instrument_key: exact.instrument_key,
      confidence: 1.0,
    }
  }

  // Try prefix match on trading_symbol
  const { data: prefix } = await supabase
    .from("instruments")
    .select("trading_symbol, instrument_key, name")
    .ilike("trading_symbol", `${candidate}%`)
    .limit(1)
    .maybeSingle()

  if (prefix) {
    return {
      ...raw,
      resolved_symbol: prefix.trading_symbol,
      instrument_key: prefix.instrument_key,
      confidence: 0.85,
    }
  }

  // Fuzzy match on company name
  const namePart = raw.stock_name?.trim()
  if (namePart && namePart.length > 3) {
    const { data: byName } = await supabase
      .from("instruments")
      .select("trading_symbol, instrument_key, name")
      .ilike("name", `%${namePart}%`)
      .limit(1)
      .maybeSingle()

    if (byName) {
      return {
        ...raw,
        resolved_symbol: byName.trading_symbol,
        instrument_key: byName.instrument_key,
        confidence: 0.7,
      }
    }
  }

  return null
}

/**
 * Resolve multiple raw recommendations.
 * Filters to only include symbols that exist in the instruments table.
 * Further filters to only the provided allowedSymbols (portfolio + watchlist).
 */
export async function resolveRecommendations(
  raws: RawRecommendation[],
  allowedSymbols: string[]
): Promise<ResolvedRecommendation[]> {
  const allowed = new Set(allowedSymbols.map((s) => s.toUpperCase()))
  const resolved: ResolvedRecommendation[] = []

  // Deduplicate by stock_name before expensive DB calls
  const seen = new Set<string>()
  const unique = raws.filter((r) => {
    const key = (r.trading_symbol || r.stock_name || "").toUpperCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Resolve in parallel batches of 10
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10)
    const results = await Promise.allSettled(batch.map(resolveOne))
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        const sym = r.value.resolved_symbol.toUpperCase()
        // Only keep if the user actually tracks this stock
        if (allowed.size === 0 || allowed.has(sym)) {
          resolved.push(r.value)
        }
      }
    }
  }

  return resolved
}
