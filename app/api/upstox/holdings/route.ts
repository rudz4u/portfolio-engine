import { NextResponse } from "next/server"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"
import { resolveUserOnlyUpstoxToken } from "@/lib/upstox-token"
import { createClient, createAdminClient } from "@/lib/supabase/server"

export async function GET() {
  // 1. Authenticate the current user — never serve personal data without auth.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  // 2. Try the user's own stored Upstox access token.
  //    resolveUserOnlyUpstoxToken() intentionally never falls back to the
  //    UPSTOX_ACCESS_TOKEN env var, so we can never leak the admin's holdings
  //    to another user.
  const token = await resolveUserOnlyUpstoxToken()

  if (token) {
    // 3a. Token available — fetch live holdings directly from Upstox.
    try {
      const res = await fetch(`${UPSTOX_CONFIG.baseUrl}/portfolio/long-term-holdings`, {
        headers: getUpstoxHeaders(token),
        next: { revalidate: 0 },
      })
      const data = await res.json()

      if (!res.ok) {
        return NextResponse.json(
          {
            status: "error",
            message: data.message || data.errors?.[0]?.message || "Upstox API error",
          },
          { status: res.status }
        )
      }

      return NextResponse.json({
        status: "success",
        data: data.data || [],
        count: (data.data || []).length,
        source: "upstox",
      })
    } catch {
      return NextResponse.json(
        { status: "error", message: "Failed to reach Upstox API" },
        { status: 500 }
      )
    }
  }

  // 3b. No user Upstox token — fall back to the user's latest imported portfolio
  //     stored in Supabase. Do NOT fall back to the UPSTOX_ACCESS_TOKEN env var.
  try {
    const admin = await createAdminClient()

    const { data: portfolio } = await admin
      .from("portfolios")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!portfolio) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "No Upstox access token found and no imported portfolio available. " +
            "Connect Upstox in Settings or import your holdings.",
        },
        { status: 400 }
      )
    }

    const { data: holdings, error } = await admin
      .from("holdings")
      .select("*")
      .eq("portfolio_id", portfolio.id)
      .not("instrument_key", "eq", "Total")
      .order("invested_amount", { ascending: false })

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 })
    }

    // Shape Supabase holdings to match the Upstox API response format so that
    // downstream consumers (trade page, assistant) work without changes.
    const shaped = (holdings ?? []).map((h) => {
      const raw = (h.raw as Record<string, unknown>) ?? {}
      return {
        trading_symbol:
          (h.trading_symbol as string) ||
          (raw.trading_symbol as string) ||
          (raw.tradingsymbol as string) ||
          (h.instrument_key as string),
        company_name:
          (h.company_name as string) || (raw.company_name as string) || "",
        quantity: h.quantity,
        average_price: (h.avg_price as number) ?? (raw.average_price as number) ?? 0,
        last_price: (h.ltp as number) ?? (raw.last_price as number) ?? 0,
        pnl: (h.unrealized_pl as number) ?? (raw.pnl as number) ?? 0,
        exchange:
          (raw.exchange as string) ||
          (h.instrument_key as string)?.split("|")[0] ||
          "NSE",
        isin: (raw.isin as string) || "",
        instrument_token:
          (h.instrument_key as string) || (raw.instrument_token as string) || "",
        day_change: (raw.day_change as number) ?? 0,
        day_change_percentage: (raw.day_change_percentage as number) ?? 0,
      }
    })

    return NextResponse.json({
      status: "success",
      data: shaped,
      count: shaped.length,
      source: "imported",
    })
  } catch {
    return NextResponse.json(
      {
        status: "error",
        message:
          "No Upstox access token found. Connect Upstox in Settings or import your holdings.",
      },
      { status: 400 }
    )
  }
}
