/**
 * Records a daily portfolio value snapshot.
 * Called after every holdings sync (user-initiated or cron).
 * Enforces one row per portfolio per day via ON CONFLICT DO UPDATE.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

export interface SnapshotInput {
  portfolioId:    string
  userId:         string
  holdings:       Array<{
    ltp:             number
    quantity:        number
    avg_price:       number
    invested_amount: number
    unrealized_pl:   number
  }>
}

export async function recordPortfolioSnapshot(
  client: SupabaseClient<any>,
  input: SnapshotInput
): Promise<void> {
  const { portfolioId, userId, holdings } = input

  const total_invested = holdings.reduce((s, h) => s + (Number(h.invested_amount) || 0), 0)
  const total_value    = holdings.reduce((s, h) => s + (Number(h.ltp) * Number(h.quantity) || 0), 0)
  const total_pnl      = total_value - total_invested
  const pnl_pct        = total_invested > 0 ? (total_pnl / total_invested) * 100 : 0

  // Use today's date in IST (UTC+5:30)
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istNow = new Date(now.getTime() + istOffset)
  const snapshot_date = istNow.toISOString().slice(0, 10) // "YYYY-MM-DD"

  const row = {
    portfolio_id:   portfolioId,
    user_id:        userId,
    snapshot_date,
    total_invested,
    total_value,
    total_pnl,
    pnl_pct,
    holdings_count: holdings.length,
  }

  // Upsert: update day's snapshot if sync runs multiple times in one day
  const { error } = await client
    .from("portfolio_snapshots")
    .upsert(row, { onConflict: "portfolio_id,snapshot_date" })

  if (error) {
    // Non-fatal: snapshot failure shouldn't break sync
    console.error("[snapshot] Failed to record portfolio snapshot:", error.message)
  } else {
    console.log(`[snapshot] Recorded: ${snapshot_date} invested=${total_invested.toFixed(0)} value=${total_value.toFixed(0)}`)
  }
}
