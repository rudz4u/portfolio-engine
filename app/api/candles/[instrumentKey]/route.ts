/**
 * GET /api/candles/[instrumentKey]
 *
 * Fetches historical OHLCV candle data from Upstox V3 for a single instrument.
 *
 * Query params:
 *   unit     — minutes | hours | days | weeks | months (default: days)
 *   interval — 1–300 for minutes, 1–5 for hours, 1 for others (default: 1)
 *   from     — YYYY-MM-DD start date
 *   to       — YYYY-MM-DD end date (default: today)
 *
 * Response: { status: "success", data: { candles: CandleData[], count: number } }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveUpstoxToken } from "@/lib/upstox-token"
import { fetchCandleData } from "@/lib/candles/fetch"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instrumentKey: string }> },
) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  const token = await resolveUpstoxToken()
  if (!token) {
    return NextResponse.json(
      { status: "error", message: "Connect your Upstox account in Settings to view candle data." },
      { status: 401 },
    )
  }

  const { instrumentKey } = await params
  // The instrument key arrives URL-encoded from the path — decode it
  const decodedKey = decodeURIComponent(instrumentKey)

  const { searchParams } = new URL(request.url)
  const unit = (searchParams.get("unit") ?? "days") as "minutes" | "hours" | "days" | "weeks" | "months"
  const interval = parseInt(searchParams.get("interval") ?? "1", 10)

  const toDate = searchParams.get("to") ?? new Date().toISOString().slice(0, 10)
  // Default from date based on unit
  const defaultLookback =
    unit === "minutes" ? 5 :
    unit === "hours" ? 30 :
    unit === "days" ? 180 :
    unit === "weeks" ? 365 : 1825
  const defaultFrom = new Date(Date.now() - defaultLookback * 86_400_000).toISOString().slice(0, 10)
  const fromDate = searchParams.get("from") ?? defaultFrom

  try {
    const candles = await fetchCandleData({
      instrumentKey: decodedKey,
      unit,
      interval,
      toDate,
      fromDate,
      accessToken: token,
    })

    return NextResponse.json({
      status: "success",
      data: {
        instrumentKey: decodedKey,
        unit,
        interval,
        fromDate,
        toDate,
        candles,
        count: candles.length,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch candle data"
    return NextResponse.json({ status: "error", message }, { status: 500 })
  }
}
