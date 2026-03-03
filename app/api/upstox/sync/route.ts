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
      { status: "error", message: "No Upstox access token. Paste your token in Settings > Upstox Connection." },
      { status: 400 }
    )
  }

  // Fetch holdings from Upstox
  let upstoxHoldings: Record<string, unknown>[] = []
  try {
    const res = await fetch(`${UPSTOX_CONFIG.baseUrl}/portfolio/long-term-holdings`, {
      headers: getUpstoxHeaders(token),
      next: { revalidate: 0 },
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { status: "error", message: data.message || "Upstox error" },
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

  // Get or create portfolio row
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
      return NextResponse.json(
        { status: "error", message: "Failed to create portfolio" },
        { status: 500 }
      )
    }
    portfolio = newPortfolio
  } else {
    // Update fetched_at
    await supabase
      .from("portfolios")
      .update({ fetched_at: new Date().toISOString() })
      .eq("id", portfolio.id)
  }

  // Upsert instruments + holdings
  let synced = 0
  for (const h of upstoxHoldings) {
    const isin = h.isin as string
    const symbol = (h.trading_symbol as string) || isin
    const instrumentKey = (h.instrument_token as string) || symbol

    // Upsert instrument
    await supabase
      .from("instruments")
      .upsert(
        {
          instrument_key: instrumentKey,
          trading_symbol: symbol,
          name: h.company_name as string,
          isin,
          exchange: h.exchange as string,
          metadata: {},
        },
        { onConflict: "instrument_key" }
      )

    // Check existing holding
    const { data: existing } = await supabase
      .from("holdings")
      .select("id")
      .eq("portfolio_id", portfolio.id)
      .eq("instrument_key", instrumentKey)
      .single()

    const holdingData = {
      portfolio_id: portfolio.id,
      instrument_key: instrumentKey,
      quantity: h.quantity as number,
      avg_price: h.average_price as number,
      invested_amount: (h.quantity as number) * (h.average_price as number),
      ltp: h.last_price as number,
      unrealized_pl: h.pnl as number,
      raw: h,
    }

    if (existing) {
      await supabase.from("holdings").update(holdingData).eq("id", existing.id)
    } else {
      await supabase.from("holdings").insert(holdingData)
    }
    synced++
  }

  return NextResponse.json({
    status: "success",
    count: synced,
    message: `${synced} holdings synced from Upstox`,
  })
}
