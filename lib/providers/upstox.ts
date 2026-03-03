/**
 * Upstox broker provider.
 *
 * Implements BrokerProvider using the Upstox v2 REST API.
 * Requires a valid access token, resolved via resolveUpstoxToken().
 *
 * Important Upstox constraints:
 *  - Order book / trade book only contain TODAY's session data.
 *  - Order history (lifecycle) is also session-scoped.
 *  - There is no official historical order API — past orders are stored in our
 *    own Supabase `orders` table by the execute route.
 */

import { UPSTOX_CONFIG, getUpstoxHeaders } from "@/lib/upstox"
import { resolveUpstoxToken } from "@/lib/upstox-token"
import {
  BrokerProvider,
  NormalizedOrder,
  NormalizedTrade,
  OrderHistoryEntry,
  ProviderError,
} from "./types"

/* ─── Raw Upstox response shapes ──────────────────────────────────────── */

interface UpstoxOrderRaw {
  exchange: string
  product: string
  price: number
  quantity: number
  status: string
  tag: string | null
  validity: string
  average_price: number
  disclosed_quantity: number
  exchange_order_id: string | null
  exchange_timestamp: string | null
  instrument_token: string
  is_amo: boolean
  status_message: string | null
  order_id: string
  order_request_id: string
  order_type: string
  parent_order_id: string | null
  trading_symbol: string
  tradingsymbol: string
  order_timestamp: string
  filled_quantity: number
  pending_quantity?: number
  transaction_type: string
  trigger_price: number
  placed_by: string
  variety: string
  order_ref_id?: string
}

interface UpstoxTradeRaw {
  exchange: string
  product: string
  trading_symbol: string
  tradingsymbol: string
  instrument_token: string
  order_type: string
  transaction_type: string
  quantity: number
  exchange_order_id: string
  order_id: string
  exchange_timestamp: string
  average_price: number
  trade_id: string
  order_ref_id: string
  order_timestamp: string
}

/* ─── normalisation helpers ────────────────────────────────────────────── */

function normalizeOrder(raw: UpstoxOrderRaw): NormalizedOrder {
  // Upstox order timestamps come as "YYYY-MM-DD HH:MM:SS" — convert to ISO
  const toISO = (ts: string | null) =>
    ts ? new Date(ts.replace(" ", "T")).toISOString() : null

  return {
    provider:          "upstox",
    order_id:          raw.order_id,
    exchange_order_id: raw.exchange_order_id,
    trading_symbol:    raw.trading_symbol || raw.tradingsymbol,
    instrument_key:    raw.instrument_token,
    exchange:          raw.exchange,
    transaction_type:  raw.transaction_type as "BUY" | "SELL",
    order_type:        raw.order_type as NormalizedOrder["order_type"],
    product:           raw.product,
    validity:          raw.validity,
    quantity:          raw.quantity,
    filled_quantity:   raw.filled_quantity,
    pending_quantity:  raw.pending_quantity ?? (raw.quantity - raw.filled_quantity),
    price:             raw.price,
    average_price:     raw.average_price,
    trigger_price:     raw.trigger_price,
    status:            raw.status.toLowerCase() as NormalizedOrder["status"],
    status_message:    raw.status_message,
    is_amo:            raw.is_amo,
    tag:               raw.tag,
    variety:           raw.variety,
    order_timestamp:   toISO(raw.order_timestamp) ?? raw.order_timestamp,
    exchange_timestamp: toISO(raw.exchange_timestamp),
    raw,
  }
}

function normalizeTrade(raw: UpstoxTradeRaw): NormalizedTrade {
  const toISO = (ts: string | null) =>
    ts ? new Date(ts.replace(" ", "T")).toISOString() : null

  return {
    provider:          "upstox",
    trade_id:          raw.trade_id,
    order_id:          raw.order_id,
    trading_symbol:    raw.trading_symbol || raw.tradingsymbol,
    instrument_key:    raw.instrument_token,
    exchange:          raw.exchange,
    transaction_type:  raw.transaction_type as "BUY" | "SELL",
    order_type:        raw.order_type as NormalizedTrade["order_type"],
    product:           raw.product,
    quantity:          raw.quantity,
    average_price:     raw.average_price,
    order_timestamp:   toISO(raw.order_timestamp) ?? raw.order_timestamp,
    exchange_timestamp: toISO(raw.exchange_timestamp),
    raw,
  }
}

function normalizeHistoryEntry(raw: UpstoxOrderRaw): OrderHistoryEntry {
  const toISO = (ts: string | null) =>
    ts ? new Date(ts.replace(" ", "T")).toISOString() : null

  return {
    provider:          "upstox",
    order_id:          raw.order_id,
    status:            raw.status.toLowerCase() as OrderHistoryEntry["status"],
    status_message:    raw.status_message,
    filled_quantity:   raw.filled_quantity,
    average_price:     raw.average_price,
    order_request_id:  raw.order_request_id,
    order_timestamp:   toISO(raw.order_timestamp) ?? raw.order_timestamp,
    raw,
  }
}

/* ─── Provider class ───────────────────────────────────────────────────── */

export class UpstoxProvider implements BrokerProvider {
  readonly id   = "upstox"
  readonly name = "Upstox"

  /** GET an authenticated Upstox API endpoint; throws ProviderError on failure */
  private async apiGet<T>(path: string): Promise<T> {
    const token = await resolveUpstoxToken()
    if (!token) {
      throw new ProviderError(
        "upstox",
        "Upstox access token not connected. Go to Settings → Upstox to connect.",
        401,
      )
    }

    const url = `${UPSTOX_CONFIG.baseUrl}${path}`
    const res = await fetch(url, {
      headers: getUpstoxHeaders(token),
      cache: "no-store",
    })

    const json = await res.json()
    if (!res.ok) {
      const msg =
        json?.errors?.[0]?.message ??
        json?.message ??
        `Upstox API returned ${res.status}`
      throw new ProviderError("upstox", msg, res.status)
    }

    return json as T
  }

  async getOrderBook(): Promise<NormalizedOrder[]> {
    const json = await this.apiGet<{ data: UpstoxOrderRaw[] }>("/order/retrieve-all")
    const orders = json?.data
    if (!Array.isArray(orders)) return []
    return orders.map(normalizeOrder)
  }

  async getTradeBook(): Promise<NormalizedTrade[]> {
    const json = await this.apiGet<{ data: UpstoxTradeRaw[] }>(
      "/order/trades/get-trades-for-day",
    )
    const trades = json?.data
    if (!Array.isArray(trades)) return []
    return trades.map(normalizeTrade)
  }

  async getOrderHistory(orderId: string): Promise<OrderHistoryEntry[]> {
    if (!orderId) throw new ProviderError("upstox", "order_id is required")
    const encoded = encodeURIComponent(orderId)
    const json = await this.apiGet<{ data: UpstoxOrderRaw[] }>(
      `/order/history?order_id=${encoded}`,
    )
    const entries = json?.data
    if (!Array.isArray(entries)) return []
    return entries.map(normalizeHistoryEntry)
  }
}
