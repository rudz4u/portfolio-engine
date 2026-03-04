/**
 * Advisory Track Record Evaluator
 *
 * Evaluates past recommendations against current prices to compute
 * outcome (hit_target / hit_stop / expired) and accuracy stats
 * per advisory source for 7-day and 30-day lookback windows.
 *
 * Called nightly by the advisory-scan cron.
 */

import type { AdvisoryTrackRecord } from "./types"

// Multiplier bounds: prevents over/under-weighting new sources
const MIN_MULTIPLIER = 0.50
const MAX_MULTIPLIER = 1.50
const NEUTRAL_MULTIPLIER = 1.00

/**
 * Map accuracy % to a track_record_multiplier.
 * Sources with < 5 resolved calls stay at 1.0 (insufficient data).
 *
 * Accuracy → Multiplier
 *   >= 70%  → 1.5  (excellent)
 *   >= 60%  → 1.3
 *   >= 50%  → 1.1  (baseline)
 *   >= 40%  → 0.9
 *   >= 30%  → 0.7
 *    < 30%  → 0.5  (poor)
 */
export function accuracyToMultiplier(
  accuracy_pct: number | null,
  resolved_calls: number
): number {
  if (resolved_calls < 5) return NEUTRAL_MULTIPLIER // not enough data yet

  if (accuracy_pct === null) return NEUTRAL_MULTIPLIER

  if (accuracy_pct >= 70) return MAX_MULTIPLIER
  if (accuracy_pct >= 60) return 1.30
  if (accuracy_pct >= 50) return 1.10
  if (accuracy_pct >= 40) return 0.90
  if (accuracy_pct >= 30) return 0.70
  return MIN_MULTIPLIER
}

/**
 * Evaluate pending recommendations and compute track records.
 * Returns upsert-ready AdvisoryTrackRecord[] for 7d and 30d windows.
 *
 * This function is called by the advisory-scan cron route which passes
 * current LTP data via a Map<trading_symbol, ltp>.
 */
export async function evaluateTrackRecords(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  currentPrices: Map<string, number>
): Promise<AdvisoryTrackRecord[]> {
  // ── 1. Fetch pending recommendations with a target or stop ─────────────
  const { data: pending } = await supabase
    .from("advisory_recommendations")
    .select("id, source_id, trading_symbol, signal, target_price, stop_loss, scraped_at, outcome")
    .is("outcome", null)
    .not("target_price", "is", null)

  if (!pending || pending.length === 0) return []

  const now = new Date().toISOString()
  const MAX_HORIZON_DAYS = 60 // expire calls older than 60 days

  // ── 2. Evaluate each pending recommendation ─────────────────────────────
  const updates: Array<{ id: string; outcome: string; outcome_at: string }> = []

  for (const rec of pending) {
    const ltp = currentPrices.get(rec.trading_symbol?.toUpperCase())
    if (!ltp) continue

    const target = rec.target_price as number | null
    const stop = rec.stop_loss as number | null
    const ageMs = Date.now() - new Date(rec.scraped_at as string).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)

    let outcome: string | null = null

    if (rec.signal === "BUY") {
      if (target && ltp >= target) outcome = "hit_target"
      else if (stop && ltp <= stop) outcome = "hit_stop"
    } else if (rec.signal === "SELL") {
      if (target && ltp <= target) outcome = "hit_target"
      else if (stop && ltp >= stop) outcome = "hit_stop"
    }

    if (!outcome && ageDays > MAX_HORIZON_DAYS) {
      outcome = "expired"
    }

    if (outcome) {
      updates.push({ id: rec.id as string, outcome, outcome_at: now })
    }
  }

  // ── 3. Persist outcomes ─────────────────────────────────────────────────
  for (const upd of updates) {
    await supabase
      .from("advisory_recommendations")
      .update({ outcome: upd.outcome, outcome_at: upd.outcome_at })
      .eq("id", upd.id)
  }

  // ── 4. Compute accuracy per source, for 7d and 30d windows ─────────────
  const { data: allSources } = await supabase
    .from("advisory_sources")
    .select("id")
    .eq("active", true)

  if (!allSources) return []

  const trackRecords: AdvisoryTrackRecord[] = []

  for (const source of allSources) {
    for (const periodDays of [7, 30] as const) {
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

      const { data: recs } = await supabase
        .from("advisory_recommendations")
        .select("outcome")
        .eq("source_id", source.id)
        .gte("scraped_at", since)
        .in("outcome", ["hit_target", "hit_stop", "expired"])

      if (!recs || recs.length === 0) continue

      const hit_target = recs.filter((r: { outcome: string | null }) => r.outcome === "hit_target").length
      const hit_stop = recs.filter((r: { outcome: string | null }) => r.outcome === "hit_stop").length
      const expired_neutral = recs.filter((r: { outcome: string | null }) => r.outcome === "expired").length
      const total_calls = recs.length
      const resolved_calls = hit_target + hit_stop
      const accuracy_pct =
        resolved_calls > 0
          ? Math.round((hit_target / resolved_calls) * 10000) / 100
          : null
      const track_record_multiplier = accuracyToMultiplier(accuracy_pct, resolved_calls)

      trackRecords.push({
        source_id: source.id,
        period_days: periodDays,
        total_calls,
        hit_target,
        hit_stop,
        expired_neutral,
        accuracy_pct,
        track_record_multiplier,
        evaluated_at: now,
      })
    }
  }

  return trackRecords
}
