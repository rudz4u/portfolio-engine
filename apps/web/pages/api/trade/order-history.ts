/**
 * GET /api/trade/order-history?order_id=...&source=upstox
 *
 * Returns the lifecycle steps (state transitions) for a single order placed today.
 * Used to power the "Order Timeline" modal on the Trade page.
 *
 * Note: Brokers only expose lifecycle for orders in the CURRENT session.
 * For past-day orders stored in our `orders` Supabase table there is no broker
 * lifecycle — show only what we stored locally.
 */

import { NextRequest, NextResponse } from "next/server"
import { getProvider, ProviderError } from "@/lib/providers"

export async function GET(req: NextRequest) {
  const source  = req.nextUrl.searchParams.get("source")   ?? "upstox"
  const orderId = req.nextUrl.searchParams.get("order_id") ?? ""

  if (!orderId) {
    return NextResponse.json(
      { status: "error", message: "order_id query parameter is required" },
      { status: 400 },
    )
  }

  try {
    const provider = getProvider(source)
    const history  = await provider.getOrderHistory(orderId)

    return NextResponse.json({
      status: "success",
      provider: { id: provider.id, name: provider.name },
      order_id: orderId,
      count: history.length,
      data: history,
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
