/**
 * GET /api/trade/order-book?source=upstox
 *
 * Returns today's live order book from the connected broker.
 * Falls back to "upstox" when ?source is omitted.
 */

import { NextRequest, NextResponse } from "next/server"
import { getProvider, ProviderError } from "@/lib/providers"

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source") ?? "upstox"

  try {
    const provider = getProvider(source)
    const orders = await provider.getOrderBook()

    return NextResponse.json({
      status: "success",
      provider: { id: provider.id, name: provider.name },
      count: orders.length,
      data: orders,
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
