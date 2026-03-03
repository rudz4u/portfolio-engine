import { NextResponse } from "next/server"
import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"
import { createClient } from "@/lib/supabase/server"
import { resolveUpstoxToken } from "@/lib/upstox-token"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  let body: {
    instrument_key: string
    quantity: number
    side: "BUY" | "SELL"
    order_type: "MARKET" | "LIMIT"
    price?: number
    trading_symbol?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 })
  }

  const { instrument_key, quantity, side, order_type, price, trading_symbol } = body

  if (!instrument_key || !quantity || !side || !order_type) {
    return NextResponse.json(
      { status: "error", message: "Missing required fields: instrument_key, quantity, side, order_type" },
      { status: 400 }
    )
  }

  if (order_type === "LIMIT" && !price) {
    return NextResponse.json(
      { status: "error", message: "Price is required for LIMIT orders" },
      { status: 400 }
    )
  }

  // Check if access token configured
  const token = await resolveUpstoxToken()
  let externalOrderId: string | null = null
  let orderStatus = "SANDBOX_SIMULATED"
  let meta: Record<string, unknown> = {}

  if (token) {
    // Place order via Upstox paper/sandbox API
    try {
      const orderPayload = {
        quantity,
        product: "D", // Delivery
        validity: "DAY",
        price: order_type === "LIMIT" ? price : 0,
        tag: "portfolio-engine",
        instrument_token: instrument_key,
        order_type,
        transaction_type: side,
        disclosed_quantity: 0,
        trigger_price: 0,
        is_amo: false,
      }

      const res = await fetch(`${UPSTOX_CONFIG.baseUrl}/order/place`, {
        method: "POST",
        headers: {
          ...getUpstoxHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderPayload),
      })

      const data = await res.json()
      meta = { upstox_response: data }

      if (res.ok && data.data?.order_id) {
        externalOrderId = data.data.order_id
        orderStatus = "PLACED"
      } else {
        // Upstox returned an error — still record locally as FAILED
        orderStatus = "FAILED"
        meta.error = data.message || data.errors?.[0]?.message || "Upstox placement failed"
      }
    } catch (e) {
      orderStatus = "FAILED"
      meta.error = "Network error reaching Upstox API"
    }
  } else {
    // No access token — pure sandbox simulation
    externalOrderId = `SIM-${Date.now()}`
    meta = { simulated: true, note: "No UPSTOX_ACCESS_TOKEN set. Order simulated locally." }
  }

  // Save order to DB
  const { data: savedOrder, error: dbError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      instrument_key,
      side,
      quantity,
      price: price ?? null,
      status: orderStatus,
      external_order_id: externalOrderId,
      meta: {
        ...meta,
        order_type,
        trading_symbol: trading_symbol ?? instrument_key,
      },
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json(
      { status: "error", message: "Order executed but failed to save: " + dbError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    status: "success",
    order_id: savedOrder.id,
    external_order_id: externalOrderId,
    order_status: orderStatus,
    message:
      orderStatus === "PLACED"
        ? "Order placed via Upstox"
        : orderStatus === "SANDBOX_SIMULATED"
        ? "Order simulated (no Upstox token)"
        : "Order failed at Upstox — recorded locally",
  })
}
