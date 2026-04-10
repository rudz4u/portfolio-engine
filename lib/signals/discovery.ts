/**
 * Opportunity Discovery Engine
 *
 * Scans advisory_consensus for stocks with BUY/STRONG_BUY signals that
 * match the investor's profile (sectors, horizon, risk tolerance) and are
 * NOT already held in the portfolio.
 *
 * Returns up to 10 ranked opportunities, each with a relevance_score.
 * Pure server-side computation — no LLM required.
 */

import type { InvestorProfile } from "@/lib/types/investor-profile"

// ── Types ─────────────────────────────────────────────────────────────────

export interface DiscoveredOpportunity {
  trading_symbol: string
  segment: string | null
  consensus_signal: string
  weighted_score: number
  advisory_score: number
  buy_count: number
  sell_count: number
  total_sources: number
  /** 0–100: how well this stock fits the investor's profile */
  relevance_score: number
  /** Human-readable reason for the recommendation */
  relevance_reason: string
}

interface ConsensusRow {
  trading_symbol: string
  segment?: string | null
  consensus_signal: string
  weighted_score: number
  advisory_score: number
  buy_count: number
  sell_count: number
  total_sources: number
}

// ── Relevance scoring ──────────────────────────────────────────────────────

function scoreRelevance(
  row: ConsensusRow,
  profile: InvestorProfile,
): { score: number; reason: string } {
  let score = 0
  const reasons: string[] = []
  const seg = row.segment ?? ""

  // 1. Advisory signal strength (max 40)
  if (row.consensus_signal === "STRONG_BUY") { score += 40; reasons.push("strong advisory consensus") }
  else if (row.consensus_signal === "BUY")   { score += 28; reasons.push("positive advisory consensus") }

  // 2. Sector fit (max 30)
  if (profile.preferred_sectors.includes(seg)) {
    score += 30; reasons.push(`matches preferred ${seg} sector`)
  } else if (profile.avoided_sectors.includes(seg)) {
    score -= 20; reasons.push(`outside preferred sectors (${seg} is avoided)`)
  } else {
    score += 10 // neutral sector
  }

  // 3. Risk alignment via analyst conviction (max 20)
  // More sources and fewer sell votes = higher conviction
  const conviction = row.total_sources > 0
    ? (row.buy_count / row.total_sources) * 100
    : 50
  if (conviction >= 80) score += 20
  else if (conviction >= 60) score += 12
  else score += 5

  // Conservative profiles: penalise very high weighted scores (momentum darlings)
  if (["very_conservative", "conservative"].includes(profile.risk_tolerance) && row.weighted_score > 85) {
    score -= 10
    reasons.push("caution: high speculation risk for conservative profile")
  }

  // 4. Source breadth (max 10)
  if (row.total_sources >= 4) { score += 10; reasons.push(`${row.total_sources} sources agree`) }
  else if (row.total_sources >= 2) score += 5

  const relevance_score = Math.max(0, Math.min(100, score))
  const reason = reasons.length
    ? reasons.join(", ")
    : `advisory consensus of ${row.consensus_signal.toLowerCase().replace("_", " ")}`

  return { score: relevance_score, reason }
}

// ── Main function ──────────────────────────────────────────────────────────

export function discoverOpportunities(
  allConsensus: ConsensusRow[],
  heldSymbols: Set<string>,
  profile: InvestorProfile,
  limit = 10,
): DiscoveredOpportunity[] {
  const results: DiscoveredOpportunity[] = []

  for (const row of allConsensus) {
    // Skip: already held or not a buy signal
    if (heldSymbols.has(row.trading_symbol)) continue
    if (!["STRONG_BUY", "BUY"].includes(row.consensus_signal)) continue
    // Skip avoided sectors entirely
    if (row.segment && profile.avoided_sectors.includes(row.segment)) continue

    const { score, reason } = scoreRelevance(row, profile)

    results.push({
      trading_symbol:  row.trading_symbol,
      segment:         row.segment ?? null,
      consensus_signal: row.consensus_signal,
      weighted_score:  row.weighted_score,
      advisory_score:  row.advisory_score,
      buy_count:       row.buy_count,
      sell_count:      row.sell_count,
      total_sources:   row.total_sources,
      relevance_score: score,
      relevance_reason: reason,
    })
  }

  return results
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit)
}
