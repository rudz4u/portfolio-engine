/**
 * Symbol Resolver
 *
 * Resolves raw stock names (as extracted by the LLM) to confirmed
 * NSE trading_symbol + instrument_key from the instruments table.
 *
 * Strategy — two bulk DB passes instead of per-stock calls:
 *  Pass 1: Single IN query for all trading_symbol candidates (exact match)
 *  Pass 2: Single OR-ilike query for all unmatched (prefix + company name)
 *
 * allowedSymbols: optional allowlist. Empty (default) = keep all resolved recs.
 * The global advisory scan passes [] — per-user filtering happens in the
 * consensus API when the user queries their own symbols.
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
    supabase
      .from("holdings")
      .select("trading_symbol, portfolios!inner(user_id)")
      .eq("portfolios.user_id", userId),
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
 * Resolve multiple raw recommendations to confirmed instruments.
 *
 * Uses two bulk DB passes — O(1) queries regardless of input size:
 *  1. Bulk IN on trading_symbol for exact matches
 *  2. Bulk OR-ilike for prefix/name fuzzy matches on the remainder
 *
 * @param raws            Extracted recommendations from LLM
 * @param allowedSymbols  Optional allowlist. Empty = keep all resolved recs.
 */
export async function resolveRecommendations(
  raws: RawRecommendation[],
  allowedSymbols: string[] = []
): Promise<ResolvedRecommendation[]> {
  if (raws.length === 0) return []

  const supabase = createServiceClient()
  const allowed = new Set(allowedSymbols.map((s) => s.toUpperCase()))

  // Deduplicate by trading_symbol or stock_name before DB calls
  const seen = new Set<string>()
  const unique = raws.filter((r) => {
    const key = (r.trading_symbol || r.stock_name || "").trim().toUpperCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length === 0) return []

  // ── Pass 1: bulk IN exact match on trading_symbol ──────────────────────
  const symbolCandidates = [
    ...new Set(unique.map((r) => (r.trading_symbol || "").trim().toUpperCase()).filter(Boolean)),
  ]

  const exactMap = new Map<string, InstrumentRow>()
  if (symbolCandidates.length > 0) {
    const { data } = await supabase
      .from("instruments")
      .select("trading_symbol, instrument_key, name")
      .in("trading_symbol", symbolCandidates)
    for (const row of data ?? []) {
      exactMap.set(row.trading_symbol.toUpperCase(), row)
    }
  }

  const resolved: ResolvedRecommendation[] = []
  const needFuzzy: RawRecommendation[] = []

  for (const raw of unique) {
    const sym = (raw.trading_symbol || "").trim().toUpperCase()
    if (sym && exactMap.has(sym)) {
      const inst = exactMap.get(sym)!
      resolved.push({
        ...raw,
        resolved_symbol: inst.trading_symbol,
        instrument_key: inst.instrument_key,
        confidence: 1.0,
      })
    } else {
      needFuzzy.push(raw)
    }
  }

  // ── Pass 2: single bulk OR-ilike for prefix + name on unmatched ────────
  if (needFuzzy.length > 0) {
    // Build OR filter parts — batch in groups of 30 to stay under URL limits
    const BATCH = 30
    for (let i = 0; i < needFuzzy.length; i += BATCH) {
      const batch = needFuzzy.slice(i, i + BATCH)

      const orParts: string[] = []
      for (const raw of batch) {
        const sym = (raw.trading_symbol || "").trim().toUpperCase()
        if (sym.length > 1) orParts.push(`trading_symbol.ilike.${sym}%`)
        const name = raw.stock_name?.trim()
        if (name && name.length > 3) orParts.push(`name.ilike.%${name}%`)
      }

      if (orParts.length === 0) continue

      const { data: fuzzyRows } = await supabase
        .from("instruments")
        .select("trading_symbol, instrument_key, name")
        .or(orParts.join(","))
        .limit(batch.length * 2)

      const rows: InstrumentRow[] = fuzzyRows ?? []

      for (const raw of batch) {
        const sym = (raw.trading_symbol || "").trim().toUpperCase()
        const nameLower = raw.stock_name?.trim().toLowerCase() ?? ""

        // Prefer prefix match on symbol, fall back to name containment
        let match: InstrumentRow | null = null
        let confidence = 0.7

        if (sym.length > 1) {
          match = rows.find((r) => r.trading_symbol.toUpperCase().startsWith(sym)) ?? null
          if (match) confidence = 0.85
        }
        if (!match && nameLower.length > 3) {
          match = rows.find((r) => r.name.toLowerCase().includes(nameLower)) ?? null
        }

        if (match) {
          resolved.push({
            ...raw,
            resolved_symbol: match.trading_symbol,
            instrument_key: match.instrument_key,
            confidence,
          })
        }
      }
    }
  }

  // Filter to allowlist if specified (empty = keep all)
  return resolved.filter(
    (r) => allowed.size === 0 || allowed.has(r.resolved_symbol.toUpperCase())
  )
}

