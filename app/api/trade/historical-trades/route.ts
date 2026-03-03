/**
 * GET /api/trade/historical-trades
 *
 * Returns paginated historical trades from the connected broker.
 * Upstox covers up to 3 financial years via /v2/charges/historical-trades.
 *
 * Query params:
 *   source      — broker identifier (default: "upstox")
 *   start_date  — YYYY-MM-DD (required)
 *   end_date    — YYYY-MM-DD (required)
 *   segment     — EQ | FO | COM | CD | MF (default: "EQ")
 *   page        — page number, 1-based (default: 1)
 *   page_size   — records per page (default: 50)
 */

import { NextResponse } from "next/server"
import { getProvider, ProviderError } from "@/lib/providers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const source     = searchParams.get("source")     ?? "upstox"
  const startDate  = searchParams.get("start_date")
  const endDate    = searchParams.get("end_date")
  const segment    = searchParams.get("segment")    ?? "EQ"
  const pageNumber = parseInt(searchParams.get("page")      ?? "1",  10)
  const pageSize   = parseInt(searchParams.get("page_size") ?? "50", 10)

  if (!startDate || !endDate) {
    return NextResponse.json(
      { status: "error", message: "start_date and end_date are required (YYYY-MM-DD)" },
      { status: 400 },
    )
  }

  try {
    const provider = getProvider(source)
    const result = await provider.getHistoricalTrades(
      startDate,
      endDate,
      segment,
      pageNumber,
      pageSize,
    )

    return NextResponse.json({
      status: "success",
      provider: { id: provider.id, name: provider.name },
      ...result,
    })
  } catch (err) {
    if (err instanceof ProviderError) {
      return NextResponse.json(
        { status: "error", provider: source, message: err.message },
        { status: err.status ?? 500 },
      )
    }
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json(
      { status: "error", provider: source, message },
      { status: 500 },
    )
  }
}
