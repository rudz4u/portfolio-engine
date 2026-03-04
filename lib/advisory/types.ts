/**
 * Advisory Intelligence — Shared Type Definitions
 *
 * These types flow through the full advisory pipeline:
 * scraper → extractor → symbol-resolver → consensus → scoring
 */

// ── Database row types (mirror Supabase schema) ────────────────────────────

export interface AdvisorySource {
  id: string
  name: string
  sebi_reg_no: string | null
  website_url: string | null
  rss_url: string | null
  tier: 1 | 2 | 3 | 4
  base_weight: number        // 0.55–0.85
  active: boolean
  scrape_mode: "tavily" | "fetch" | "both"
}

export interface AdvisoryRecommendation {
  id?: string
  source_id: string
  trading_symbol: string
  instrument_key: string | null
  signal: "BUY" | "SELL" | "HOLD" | "NEUTRAL"
  target_price: number | null
  stop_loss: number | null
  horizon: string | null
  rationale: string | null
  source_url: string | null
  published_at: string | null    // ISO timestamptz
  scraped_at?: string
  outcome?: "hit_target" | "hit_stop" | "expired" | "pending" | null
}

export interface AdvisoryConsensus {
  id?: string
  trading_symbol: string
  instrument_key: string | null
  consensus_date: string         // YYYY-MM-DD
  buy_count: number
  sell_count: number
  hold_count: number
  neutral_count: number
  total_sources: number
  weighted_score: number         // 0–100 (0=strong sell, 50=neutral, 100=strong buy)
  contributing_sources: string[] // advisory_sources.id[]
  advisory_score: number         // 0–25 component for scoring engine
  consensus_signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
  computed_at?: string
}

export interface AdvisoryTrackRecord {
  id?: string
  source_id: string
  period_days: 7 | 30
  total_calls: number
  hit_target: number
  hit_stop: number
  expired_neutral: number
  accuracy_pct: number | null
  track_record_multiplier: number  // 0.5–1.5
  evaluated_at?: string
}

// ── Intermediate pipeline types ────────────────────────────────────────────

/** Raw text fetched from a source before LLM extraction */
export interface RawSourceContent {
  source_id: string
  source_name: string
  url: string
  content: string                // raw HTML snippet or Tavily answer
  fetched_at: string             // ISO
}

/** LLM-extracted signal before symbol resolution */
export interface RawRecommendation {
  stock_name: string             // as mentioned in the article (may be company name)
  trading_symbol: string | null  // NSE symbol if mentioned explicitly
  signal: "BUY" | "SELL" | "HOLD" | "NEUTRAL"
  target_price: number | null
  stop_loss: number | null
  horizon: string | null
  rationale: string | null
  source_url: string | null
  published_at: string | null
}

/** Result of symbol resolution — maps raw stock name to instruments table */
export interface ResolvedRecommendation extends RawRecommendation {
  resolved_symbol: string       // confirmed NSE trading_symbol
  instrument_key: string        // NSE_EQ|ISIN format
  confidence: number            // 0–1 match confidence
}

/** Per-source weighted contribution to consensus */
export interface SourceContribution {
  source_id: string
  source_name: string
  weight: number                // base_weight × track_record_multiplier × recency_decay
  signal: "BUY" | "SELL" | "HOLD" | "NEUTRAL"
  published_at: string | null
}

/** Aggregated consensus inputs for one stock */
export interface ConsensusInput {
  trading_symbol: string
  instrument_key: string | null
  contributions: SourceContribution[]
}

/** Final result returned from computeConsensus() */
export interface ConsensusResult {
  trading_symbol: string
  instrument_key: string | null
  buy_count: number
  sell_count: number
  hold_count: number
  neutral_count: number
  total_sources: number
  weighted_score: number
  advisory_score: number
  consensus_signal: AdvisoryConsensus["consensus_signal"]
  contributing_sources: string[]
}
