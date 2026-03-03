import { NextResponse } from "next/server"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"
import { createClient } from "@/lib/supabase/server"
import { resolveUpstoxToken } from "@/lib/upstox-token"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  const token = await resolveUpstoxToken()
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "No Upstox access token. Connect via Settings > Upstox Connection." },
      { status: 400 }
    )
  }

  // ── 1. Fetch holdings from Upstox (1 network call) ───────────────────────
  let upstoxHoldings: Record<string, unknown>[] = []
  try {
    const res = await fetch(`${UPSTOX_CONFIG.baseUrl}/portfolio/long-term-holdings`, {
      headers: getUpstoxHeaders(token),
      cache: "no-store",
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { status: "error", message: data.message || "Upstox API error" },
        { status: res.status }
      )
    }
    upstoxHoldings = data.data || []
  } catch {
    return NextResponse.json(
      { status: "error", message: "Failed to reach Upstox API" },
      { status: 500 }
    )
  }

  if (upstoxHoldings.length === 0) {
    return NextResponse.json({ status: "success", count: 0, message: "No holdings found in Upstox account" })
  }

  // ── 2. Get or create portfolio row (1 DB call) ───────────────────────────
  let { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!portfolio) {
    const { data: newPortfolio, error } = await supabase
      .from("portfolios")
      .insert({ user_id: user.id, source: "upstox", meta: {}, fetched_at: new Date().toISOString() })
      .select("id")
      .single()
    if (error || !newPortfolio) {
      return NextResponse.json({ status: "error", message: "Failed to create portfolio" }, { status: 500 })
    }
    portfolio = newPortfolio
  } else {
    await supabase
      .from("portfolios")
      .update({ fetched_at: new Date().toISOString() })
      .eq("id", portfolio.id)
  }

  // ── 3. Build payload arrays ──────────────────────────────────────────────
  const instruments = upstoxHoldings.map((h) => {
    const isin = h.isin as string
    const symbol = (h.trading_symbol as string) || isin
    const instrumentKey = (h.instrument_token as string) || symbol
    return {
      instrument_key: instrumentKey,
      trading_symbol: symbol,
      name: (h.company_name as string) || symbol,
      isin,
      exchange: (h.exchange as string) || "",
      metadata: {},
    }
  })

  const holdings = upstoxHoldings.map((h) => {
    const isin = h.isin as string
    const symbol = (h.trading_symbol as string) || isin
    const instrumentKey = (h.instrument_token as string) || symbol
    const qty = h.quantity as number
    const avgPrice = h.average_price as number
    return {
      portfolio_id: portfolio!.id,
      instrument_key: instrumentKey,
      quantity: qty,
      avg_price: avgPrice,
      invested_amount: qty * avgPrice,
      ltp: (h.last_price as number) || 0,
      unrealized_pl: (h.pnl as number) || 0,
      raw: h,
    }
  })

  // ── 4. Bulk upsert instruments (1 DB call) ───────────────────────────────
  const { error: instrError } = await supabase
    .from("instruments")
    .upsert(instruments, { onConflict: "instrument_key" })

  if (instrError) {
    console.error("[sync] instruments upsert error:", instrError)
    // non-fatal: continue with holdings
  }

  // ── 5. Delete old holdings + bulk insert fresh ones (2 DB calls) ─────────
  // Delete-then-insert ensures stale positions (sold stocks) are removed.
  await supabase.from("holdings").delete().eq("portfolio_id", portfolio.id)

  const { error: holdingsError } = await supabase.from("holdings").insert(holdings)

  if (holdingsError) {
    console.error("[sync] holdings insert error:", holdingsError)
    return NextResponse.json(
      { status: "error", message: "Failed to save holdings: " + holdingsError.message },
      { status: 500 }
    )
  }

  console.log(`[sync] Synced ${holdings.length} holdings for user ${user.id}`)

  return NextResponse.json({
    status: "success",
    count: holdings.length,
    message: `${holdings.length} holdings synced from Upstox`,
  })
}

