import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { HoldingOverride, HoldingGoal, HOLDING_GOALS } from "@/lib/types/investor-profile"

export const dynamic = "force-dynamic"

const VALID_GOALS: readonly string[] = [
  "growth", "income", "swing_trade", "short_term_trade",
  "value_hold", "sector_bet", "speculative", "learning",
] satisfies readonly HoldingGoal[]

const VALID_SIGNAL_OVERRIDES = ["force_hold", "force_watch", null] as const

/**
 * GET /api/holdings/overrides
 * Returns all holding overrides for the authenticated user.
 * Optional ?instrument_key= query param to filter to one stock.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const instrumentKey = request.nextUrl.searchParams.get("instrument_key")

  let query = supabase
    .from("holding_overrides")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (instrumentKey) {
    query = query.eq("instrument_key", instrumentKey)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ overrides: data as HoldingOverride[] })
}

/**
 * POST /api/holdings/overrides
 * Create or upsert a holding override for a specific instrument.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { instrument_key, trading_symbol } = body

  if (!instrument_key || !trading_symbol) {
    return NextResponse.json(
      { error: "instrument_key and trading_symbol are required" },
      { status: 400 },
    )
  }

  // Validate optional fields
  if (body.goal && !VALID_GOALS.includes(body.goal)) {
    return NextResponse.json({ error: `Invalid goal: ${body.goal}` }, { status: 400 })
  }
  if (body.custom_signal_override && !VALID_SIGNAL_OVERRIDES.includes(body.custom_signal_override)) {
    return NextResponse.json({ error: "Invalid custom_signal_override" }, { status: 400 })
  }
  if (body.target_price != null && (typeof body.target_price !== "number" || body.target_price <= 0)) {
    return NextResponse.json({ error: "target_price must be a positive number" }, { status: 400 })
  }
  if (body.stop_loss_price != null && (typeof body.stop_loss_price !== "number" || body.stop_loss_price <= 0)) {
    return NextResponse.json({ error: "stop_loss_price must be a positive number" }, { status: 400 })
  }
  if (body.max_allocation_pct != null && (typeof body.max_allocation_pct !== "number" || body.max_allocation_pct < 1 || body.max_allocation_pct > 50)) {
    return NextResponse.json({ error: "max_allocation_pct must be between 1 and 50" }, { status: 400 })
  }

  const row = {
    user_id: user.id,
    instrument_key,
    trading_symbol,
    goal: body.goal ?? null,
    goal_notes: body.goal_notes ?? null,
    target_price: body.target_price ?? null,
    stop_loss_price: body.stop_loss_price ?? null,
    trailing_stop_pct: body.trailing_stop_pct ?? null,
    strategy_preset_id: body.strategy_preset_id ?? null,
    custom_signal_override: body.custom_signal_override ?? null,
    max_allocation_pct: body.max_allocation_pct ?? null,
    risk_note: body.risk_note ?? null,
    hold_until: body.hold_until ?? null,
    min_hold_months: body.min_hold_months ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("holding_overrides")
    .upsert(row, { onConflict: "user_id,instrument_key" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ override: data as HoldingOverride })
}

/**
 * DELETE /api/holdings/overrides?instrument_key=...
 * Remove a holding override for a specific instrument.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const instrumentKey = request.nextUrl.searchParams.get("instrument_key")
  if (!instrumentKey) {
    return NextResponse.json({ error: "instrument_key is required" }, { status: 400 })
  }

  const { error } = await supabase
    .from("holding_overrides")
    .delete()
    .eq("user_id", user.id)
    .eq("instrument_key", instrumentKey)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
