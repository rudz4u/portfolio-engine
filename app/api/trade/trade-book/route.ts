/**
 * GET /api/trade/trade-book?source=upstox
 *
 * Returns today's executed trades (fills) from the connected broker.
 * Defaults to "upstox" when ?source is omitted.
 */

import { NextResponse } from "next/server"
import { getProvider, ProviderError } from "@/lib/providers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get("source") ?? "upstox"

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
