import { NextResponse } from "next/server"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { recordPortfolioSnapshot } from "@/lib/portfolio-snapshot"

export async function POST() {
  // ── 0. Auth — use cookie-based client just for identity check ─────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  // ── 1. Resolve Upstox token — read user_settings via admin client ─────────
  // Using admin client (service role) for ALL DB operations:
  //   - bypasses RLS on `instruments` (which blocks anon mutations)
  //   - avoids creating a second Supabase client just for token lookup
  const admin = await createAdminClient()

  const { data: settingsRow } = await admin
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  const prefs = (settingsRow?.preferences as Record<string, string> | null) ?? {}
  const token = prefs.upstox_access_token || process.env.UPSTOX_ACCESS_TOKEN || ""

  if (!token) {
    return NextResponse.json(
      { status: "error", message: "No Upstox access token. Connect your account via Settings > Upstox Connection." },
      { status: 400 }
    )
  }

  // ── 2. Fetch holdings from Upstox ─────────────────────────────────────────
  let upstoxHoldings: Record<string, unknown>[] = []
  try {
    const res = await fetch(`${UPSTOX_CONFIG.baseUrl}/portfolio/long-term-holdings`, {
      headers: getUpstoxHeaders(token),
      cache: "no-store",
    })
    const data = await res.json()
    console.log(`[sync] Upstox response status: ${res.status}, holdings count: ${(data.data || []).length}`)
    if (!res.ok) {
      return NextResponse.json(
        { status: "error", message: data.message || `Upstox API error (${res.status})` },
        { status: res.status }
      )
    }
    upstoxHoldings = data.data || []
  } catch (e) {
    console.error("[sync] Failed to reach Upstox API:", e)
    return NextResponse.json(
      { status: "error", message: "Failed to reach Upstox API" },
      { status: 500 }
    )
  }

  if (upstoxHoldings.length === 0) {
    return NextResponse.json({ status: "success", count: 0, message: "No holdings found in your Upstox account" })
  }

  // ── 3. Get or create portfolio row (admin bypasses RLS + FK to users table) ─
  let { data: portfolio } = await admin
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!portfolio) {
    // Ensure a users row exists (portfolios.user_id FK → users.id, not auth.users)
    await admin
      .from("users")
      .upsert({ id: user.id, email: user.email }, { onConflict: "id" })

    const { data: newPortfolio, error } = await admin
      .from("portfolios")
      .insert({ user_id: user.id, source: "upstox", meta: {}, fetched_at: new Date().toISOString() })
      .select("id")
      .single()
    if (error || !newPortfolio) {
      console.error("[sync] Failed to create portfolio:", error)
      return NextResponse.json({ status: "error", message: "Failed to create portfolio row" }, { status: 500 })
    }
    portfolio = newPortfolio
  } else {
    await admin
      .from("portfolios")
      .update({ fetched_at: new Date().toISOString() })
      .eq("id", portfolio.id)
  }

  // ── 4. Build payload arrays ───────────────────────────────────────────────
  const instruments = upstoxHoldings.map((h) => {
    const isin        = (h.isin as string) || ""
    const symbol      = (h.trading_symbol as string) || (h.tradingsymbol as string) || isin
    const companyName = (h.company_name as string) || symbol
    // Upstox holdings use "instrument_key" (e.g. NSE_EQ|INE002A01018), not "instrument_token"
    const instrumentKey = (h.instrument_key as string) || symbol
    return {
      instrument_key: instrumentKey,
      trading_symbol: symbol,
      name: companyName,
      isin,
      exchange: (h.exchange as string) || "",
      segment: (h.instrument_type as string) || (h.segment as string) || "",
      metadata: h,
    }
  })

  // ── Preserve user-set segments before we wipe holdings ──────────────────
  const { data: existingHoldingsRows } = await admin
    .from("holdings")
    .select("instrument_key, segment")
    .eq("portfolio_id", portfolio!.id)
  const existingSegments = new Map<string, string | null>(
    (existingHoldingsRows ?? []).map((row) => [row.instrument_key as string, row.segment as string | null])
  )

  const holdingsPayload = upstoxHoldings.map((h) => {
    const isin          = (h.isin as string) || ""
    const symbol        = (h.trading_symbol as string) || (h.tradingsymbol as string) || isin
    const companyName   = (h.company_name as string) || symbol
    // Upstox uses "instrument_key" field — do NOT fall back to instrument_token
    const instrumentKey = (h.instrument_key as string) || symbol
    const qty           = (h.quantity as number) || 0
    const avgPrice      = (h.average_price as number) || 0
    // For existing holdings, keep the user-set segment; only use Upstox value for brand-new ones
    const derivedSegment = (h.instrument_type as string) || null
    const segment = existingSegments.has(instrumentKey)
      ? (existingSegments.get(instrumentKey) ?? derivedSegment)
      : derivedSegment
    return {
      portfolio_id:    portfolio!.id,
      instrument_key:  instrumentKey,
      trading_symbol:  symbol,
      company_name:    companyName,
      quantity:        qty,
      avg_price:       avgPrice,
      invested_amount: qty * avgPrice,
      ltp:             (h.last_price as number) || 0,
      unrealized_pl:   (h.pnl as number) || 0,
      segment,
      raw:             h,
    }
  })

  // ── 5. Bulk upsert instruments (admin bypasses RLS "no mutations" policy) ──
  const { error: instrError } = await admin
    .from("instruments")
    .upsert(instruments, { onConflict: "instrument_key" })
  if (instrError) {
    console.error("[sync] instruments upsert error:", instrError.message)
    // non-fatal: holdings still sync even if instrument metadata fails
  }

  // ── 6. Delete old holdings + bulk insert fresh ones ───────────────────────
  const { error: deleteError } = await admin
    .from("holdings")
    .delete()
    .eq("portfolio_id", portfolio.id)
  if (deleteError) {
    console.error("[sync] holdings delete error:", deleteError.message)
  }

  const { error: holdingsError } = await admin.from("holdings").insert(holdingsPayload)

  if (holdingsError) {
    console.error("[sync] holdings insert error:", holdingsError.message)
    return NextResponse.json(
      { status: "error", message: "Failed to save holdings: " + holdingsError.message },
      { status: 500 }
    )
  }

  console.log(`[sync] Synced ${holdingsPayload.length} holdings for user ${user.id}`)

  // ── 7. Record daily portfolio value snapshot ──────────────────────────────
  await recordPortfolioSnapshot(admin, {
    portfolioId: portfolio.id,
    userId:      user.id,
    holdings:    holdingsPayload,
  })

  return NextResponse.json({
    status: "success",
    count: holdingsPayload.length,
    message: `${holdingsPayload.length} holdings synced from Upstox`,
  })
}

