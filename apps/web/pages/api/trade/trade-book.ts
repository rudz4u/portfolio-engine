/**
 * GET /api/trade/trade-book?source=upstox
 *
 * Returns today's live trade book (executed fills) from the connected broker.
 */

import { NextRequest, NextResponse } from "next/server"
import { getProvider, ProviderError } from "@/lib/providers"

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") ?? "upstox"

  try {
    const provider = getProvider(source)
    const trades = await provider.getTradeBook()

    return NextResponse.json({
      status: "success",
      provider: { id: provider.id, name: provider.name },
      count: trades.length,
      data: trades,
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
