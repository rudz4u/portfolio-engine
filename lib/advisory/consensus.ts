/**
 * Advisory Consensus Engine
 *
 * Computes a weighted consensus score for each stock from all resolved
 * recommendations using a recency-decay formula:
 *
 *   weight = base_weight × track_record_multiplier × e^(-0.1 × days_old)
 *
 * Final weighted_score is on 0–100 scale (0 = strong sell, 50 = neutral,
 * 100 = strong buy). The advisory_score component for the scoring engine
 * is mapped to 0–25.
 */

import type {
  AdvisorySource,
  AdvisoryTrackRecord,
  ResolvedRecommendation,
  ConsensusInput,
  ConsensusResult,
  SourceContribution,
} from "./types"

// Signal numeric values (for weighted averaging)
const SIGNAL_SCORES: Record<string, number> = {
  BUY:     85,
  HOLD:    50,
  NEUTRAL: 50,
  SELL:    15,
}

/** Map weighted_score → consensus signal */
function toConsensusSignal(
  score: number
): ConsensusResult["consensus_signal"] {
  if (score >= 75) return "STRONG_BUY"
  if (score >= 60) return "BUY"
  if (score >= 40) return "HOLD"
  if (score >= 25) return "SELL"
  return "STRONG_SELL"
}

/** Map weighted_score (0–100) → advisory_score (0–25) */
function toAdvisoryScore(weightedScore: number): number {
  return Math.round((weightedScore / 100) * 25)
}

/**
 * Compute recency-decay weight.
 * Decay constant λ = 0.1 means a 7-day-old signal retains ~50% weight;
 * a 30-day-old signal retains ~5% weight.
 */
function recencyDecay(publishedAt: string | null): number {
  if (!publishedAt) return 0.5 // unknown age → half weight
  const daysOld =
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24)
  return Math.exp(-0.1 * Math.max(0, daysOld))
}

/**
 * Build a ConsensusInput map from all resolved recommendations.
 * Groups by trading_symbol, one entry per source (latest signal wins).
 */
export function groupBySymbol(
  recs: Array<ResolvedRecommendation & { source_id: string }>,
  sources: AdvisorySource[],
  trackRecords: AdvisoryTrackRecord[]
): Map<string, ConsensusInput> {
  const sourceMap = new Map(sources.map((s) => [s.id, s]))
  // Build track-record multiplier lookup — use 30-day period preferentially
  const trMultiplierMap = new Map<string, number>()
  for (const tr of trackRecords) {
    if (tr.period_days === 30 || !trMultiplierMap.has(tr.source_id)) {
      trMultiplierMap.set(tr.source_id, tr.track_record_multiplier ?? 1.0)
    }
  }

  // Latest-signal-per-source-per-symbol
  const latestMap = new Map<string, ResolvedRecommendation & { source_id: string }>()
  for (const rec of recs) {
    const key = `${rec.source_id}||${rec.resolved_symbol}`
    const existing = latestMap.get(key)
    if (
      !existing ||
      (rec.published_at && existing.published_at && rec.published_at > existing.published_at)
    ) {
      latestMap.set(key, rec)
    }
  }

  const result = new Map<string, ConsensusInput>()
  for (const rec of latestMap.values()) {
    const source = sourceMap.get(rec.source_id)
    if (!source) continue

    const trMultiplier = trMultiplierMap.get(rec.source_id) ?? 1.0
    const decay = recencyDecay(rec.published_at)
    const weight = source.base_weight * trMultiplier * decay

    const contribution: SourceContribution = {
      source_id: rec.source_id,
      source_name: source.name,
      weight,
      signal: rec.signal,
      published_at: rec.published_at,
    }

    const sym = rec.resolved_symbol
    if (!result.has(sym)) {
      result.set(sym, {
        trading_symbol: sym,
        instrument_key: rec.instrument_key,
        contributions: [],
      })
    }
    result.get(sym)!.contributions.push(contribution)
  }

  return result
}

/** Compute consensus for a single stock from its contributions */
export function computeConsensus(input: ConsensusInput): ConsensusResult {
  const { trading_symbol, instrument_key, contributions } = input

  let weightedSum = 0
  let totalWeight = 0
  let buy_count = 0, sell_count = 0, hold_count = 0, neutral_count = 0

  for (const c of contributions) {
    const signalScore = SIGNAL_SCORES[c.signal] ?? 50
    weightedSum += c.weight * signalScore
    totalWeight += c.weight

    if (c.signal === "BUY")     buy_count++
    else if (c.signal === "SELL")    sell_count++
    else if (c.signal === "HOLD")    hold_count++
    else                             neutral_count++
  }

  const weighted_score =
    totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 50

  return {
    trading_symbol,
    instrument_key,
    buy_count,
    sell_count,
    hold_count,
    neutral_count,
    total_sources: contributions.length,
    weighted_score,
    advisory_score: toAdvisoryScore(weighted_score),
    consensus_signal: toConsensusSignal(weighted_score),
    contributing_sources: contributions.map((c) => c.source_id),
  }
}

/** Compute consensus for all tracked symbols */
export function computeAllConsensus(
  grouped: Map<string, ConsensusInput>
): ConsensusResult[] {
  return Array.from(grouped.values()).map(computeConsensus)
}
