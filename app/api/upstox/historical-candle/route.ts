import { NextRequest, NextResponse } from "next/server"
import { getUpstoxHeaders } from "@/lib/upstox"
import { resolveUpstoxToken } from "@/lib/upstox-token"
import { createAdminClient } from "@/lib/supabase/server"

const UPSTOX_V3 = "https://api.upstox.com/v3"

/** Map legacy interval values to V3 unit + numeric interval */
function mapInterval(raw: string): { unit: string; interval: string } {
  const m = raw.match(/^(\d+)(minute|hour)s?$/i)
  if (m) {
    const num = m[1]
    const kind = m[2].toLowerCase()
    return { unit: kind === "minute" ? "minutes" : "hours", interval: num }
  }
  switch (raw.toLowerCase()) {
    case "week":  return { unit: "weeks",  interval: "1" }
    case "month": return { unit: "months", interval: "1" }
    case "day":
    default:      return { unit: "days",   interval: "1" }
  }
}

/**
 * GET /api/upstox/historical-candle
 * Query params:
 *   instrument_key  — e.g. "NSE_EQ|INFY" or bare symbol "INFY"
 *   interval        — day | week | month | 30minute | 1minute  (default: day)
 *   from            — YYYY-MM-DD  (default: 90 days ago)
 *   to              — YYYY-MM-DD  (default: today)
 *
 * If instrument_key doesn't contain "|", resolves it via the instruments table.
 * Upstox candle format: [timestamp_iso, open, high, low, close, volume, oi]
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  let instrumentKey = searchParams.get("instrument_key")
  const interval = searchParams.get("interval") ?? "day"

  const toDate =
    searchParams.get("to") ?? new Date().toISOString().slice(0, 10)

  const defaultFromDate = new Date()
  defaultFromDate.setDate(defaultFromDate.getDate() - 90)
  const fromDate =
    searchParams.get("from") ?? defaultFromDate.toISOString().slice(0, 10)

  if (!instrumentKey) {
    return NextResponse.json(
      { error: "instrument_key query parameter is required" },
      { status: 400 },
    )
  }

  // If the key is a bare symbol (no "|"), resolve it to a valid Upstox instrument key
  // via the instruments table ISIN.  Upstox needs keys like NSE_EQ|INE704P01025.
  if (!instrumentKey.includes("|")) {
    const admin = await createAdminClient()

    // Try matching on instrument_key first (most holdings use bare symbols as key),
    // then fall back to trading_symbol ilike match.
    const { data: inst } = await admin
      .from("instruments")
      .select("instrument_key, isin, exchange")
      .or(`instrument_key.eq.${instrumentKey},trading_symbol.ilike.${instrumentKey}`)
      .limit(1)
      .single()

    if (inst?.isin) {
      // Construct proper Upstox key from ISIN
      instrumentKey = `NSE_EQ|${inst.isin}`
    } else if (inst?.instrument_key?.includes("|")) {
      instrumentKey = inst.instrument_key
    } else {
      return NextResponse.json(
        { error: `Could not resolve instrument key for "${instrumentKey}". No ISIN found in instruments table.` },
        { status: 404 },
      )
    }
  }

  const token = await resolveUpstoxToken()
  if (!token) {
    return NextResponse.json(
      {
        error:
          "No Upstox access token. Connect your account in Settings to view historical data.",
      },
      { status: 401 },
    )
  }

  // Upstox V3 path: /historical-candle/{key}/{unit}/{interval}/{to}/{from}
  const encodedKey = encodeURIComponent(instrumentKey!)
  const { unit, interval: numInterval } = mapInterval(interval)
  const url = `${UPSTOX_V3}/historical-candle/${encodedKey}/${unit}/${numInterval}/${toDate}/${fromDate}`

  try {
    const res = await fetch(url, {
      headers: getUpstoxHeaders(token),
      // No caching — market data changes daily
      cache: "no-store",
    })

    const json = await res.json()

    if (!res.ok) {
      const errMsg =
        json?.errors?.[0]?.message ?? json?.message ?? "Upstox API error"
      return NextResponse.json({ error: errMsg }, { status: res.status })
    }

    // Upstox wraps in { status, data: { candles: [...] } }
    return NextResponse.json({ status: "success", data: json.data })
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Upstox API" },
      { status: 500 },
    )
  }
}
