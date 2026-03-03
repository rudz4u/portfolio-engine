import { NextRequest, NextResponse } from "next/server"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"
import { resolveUpstoxToken } from "@/lib/upstox-token"

/**
 * GET /api/upstox/historical-candle
 * Query params:
 *   instrument_key  — e.g. "NSE_EQ|INFY"  (will be URL-encoded before forwarding)
 *   interval        — day | week | month | 30minute | 1minute  (default: day)
 *   from            — YYYY-MM-DD  (default: 90 days ago)
 *   to              — YYYY-MM-DD  (default: today)
 *
 * Upstox candle format: [timestamp_iso, open, high, low, close, volume, oi]
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const instrumentKey = searchParams.get("instrument_key")
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

  // Upstox v2 path: /historical-candle/{encodedKey}/{interval}/{to}/{from}
  // The pipe character in instrument_key must be percent-encoded (%7C).
  const encodedKey = encodeURIComponent(instrumentKey)
  const url = `${UPSTOX_CONFIG.baseUrl}/historical-candle/${encodedKey}/${interval}/${toDate}/${fromDate}`

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
