import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// This edge function is called by pg_cron daily at 4:30 AM UTC (10:00 AM IST) Mon-Fri
// It syncs Upstox holdings for all users who have an access token stored in preferences.

const UPSTOX_BASE_URL = "https://api.upstox.com/v2"

interface UpstoxHolding {
  trading_symbol: string
  company_name: string
  exchange: string
  instrument_token: string
  isin: string
  quantity: number
  average_price: number
  last_price: number
  close_price: number
  pnl: number
  day_change: number
  day_change_percentage: number
}

serve(async (req) => {
  // Allow manual trigger via POST with optional Authorization check
  const authHeader = req.headers.get("Authorization") ?? ""
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  const expectedBearer = `Bearer ${serviceKey}`
  if (authHeader && authHeader !== expectedBearer) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
    )

    // Shared Upstox token from env (single-token deployment for now)
    const upstoxToken = Deno.env.get("UPSTOX_ACCESS_TOKEN")

    if (!upstoxToken) {
      return new Response(
        JSON.stringify({ status: "skipped", message: "UPSTOX_ACCESS_TOKEN not configured" }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // --- 1. Fetch holdings from Upstox ---
    let upstoxHoldings: UpstoxHolding[] = []
    const holdingsRes = await fetch(`${UPSTOX_BASE_URL}/portfolio/long-term-holdings`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${upstoxToken}`,
      },
    })

    if (!holdingsRes.ok) {
      const errBody = await holdingsRes.json().catch(() => ({}))
      return new Response(
        JSON.stringify({
          status: "error",
          message: `Upstox API error: ${holdingsRes.status}`,
          detail: errBody,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      )
    }

    const holdingsData = await holdingsRes.json()
    upstoxHoldings = holdingsData.data ?? []

    // --- 2. Resolve portfolio ids for all users using service role ---
    const { data: portfolios, error: portErr } = await supabaseAdmin
      .from("portfolios")
      .select("id, user_id")

    if (portErr) throw portErr
    if (!portfolios || portfolios.length === 0) {
      return new Response(
        JSON.stringify({ status: "ok", message: "No portfolios to sync", synced: 0 }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    let totalUpserted = 0

    for (const portfolio of portfolios) {
      if (!upstoxHoldings.length) continue

      // --- 3. Upsert holdings into DB ---
      const rows = upstoxHoldings.map((h) => ({
        portfolio_id: portfolio.id,
        instrument_key: h.trading_symbol,
        company_name: h.company_name,
        exchange: h.exchange,
        isin: h.isin,
        segment: h.exchange === "NSE" || h.exchange === "BSE" ? "Equity" : h.exchange,
        quantity: h.quantity,
        avg_price: h.average_price,
        last_price: h.last_price,
        close_price: h.close_price,
        invested_amount: h.quantity * h.average_price,
        current_value: h.quantity * h.last_price,
        unrealized_pl: h.pnl,
        day_change: h.day_change,
        day_change_pct: h.day_change_percentage,
        updated_at: new Date().toISOString(),
      }))

      const { error: upsertErr } = await supabaseAdmin
        .from("holdings")
        .upsert(rows, { onConflict: "portfolio_id,instrument_key" })

      if (upsertErr) {
        console.error(`Holdings upsert failed for portfolio ${portfolio.id}:`, upsertErr.message)
      } else {
        totalUpserted += rows.length
      }
    }

    // --- 4. Log the sync event ---
    await supabaseAdmin.from("analysis_reports").insert({
      user_id: portfolios[0]?.user_id,
      report_type: "daily_sync",
      data: {
        synced_holdings: totalUpserted,
        portfolios: portfolios.length,
        run_at: new Date().toISOString(),
      },
    }).catch(() => {}) // non-critical

    return new Response(
      JSON.stringify({
        status: "success",
        synced: totalUpserted,
        portfolios: portfolios.length,
        message: `Daily sync complete. ${totalUpserted} holdings upserted across ${portfolios.length} portfolio(s).`,
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ status: "error", error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})

