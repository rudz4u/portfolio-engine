/**
 * Broker provider abstraction.
 *
 * Every broker integration (Upstox, Zerodha, Groww …) must implement the
 * BrokerProvider interface so the rest of the application can remain
 * provider-agnostic.
 *
 * Rules:
 *  - All monetary values are in INR, unformatted numbers.
 *  - Timestamps are ISO-8601 strings.
 *  - Provider-specific raw data is preserved in the `raw` field for debugging.
 */

/* ─── Core normalised types ────────────────────────────────────────────── */

export type TransactionType = "BUY" | "SELL"
export type OrderType       = "MARKET" | "LIMIT" | "SL" | "SL-M"
export type OrderStatus =
  | "complete" | "open" | "rejected" | "cancelled"
  | "pending"  | "failed" | "partially_filled" | string

export interface NormalizedOrder {
  /** Provider that placed the order e.g. "upstox" */
  provider: string
  /** Unique order ID as given by the broker */
  order_id: string
  /** Exchange-assigned order ID */
  exchange_order_id: string | null
  /** Symbol shown in the UI e.g. "SBIN" */
  trading_symbol: string
  /** Instrument key used for future API calls e.g. "NSE_EQ|INE062A01020" */
  instrument_key: string
  exchange: string
  transaction_type: TransactionType
  order_type: OrderType
  product: string           // "D" | "I" | "CO" | "MTF"
  validity: string          // "DAY" | "IOC"
  quantity: number
  filled_quantity: number
  pending_quantity: number
  price: number             // placed price (0 for MARKET)
  average_price: number     // actual fill price
  trigger_price: number
  status: OrderStatus
  status_message: string | null
  is_amo: boolean
  tag: string | null
  variety: string
  order_timestamp: string   // ISO-8601
  exchange_timestamp: string | null
  /** Any extra provider-specific fields */
  raw?: unknown
}

export interface NormalizedTrade {
  provider: string
  trade_id: string
  order_id: string
  trading_symbol: string
  instrument_key: string
  exchange: string
  transaction_type: TransactionType
  order_type: OrderType
  product: string
  quantity: number
  average_price: number
  order_timestamp: string
  exchange_timestamp: string | null
  raw?: unknown
}

/** A single status step in the lifecycle of an order */
export interface OrderHistoryEntry {
  provider: string
  order_id: string
  status: OrderStatus
  status_message: string | null
  filled_quantity: number
  average_price: number
  order_request_id: string
  order_timestamp: string
  raw?: unknown
}

/** A historical trade record from the broker (up to 3 financial years) */
export interface HistoricalTrade {
  provider: string
  trade_id: string
  /** Date string "YYYY-MM-DD" */
  trade_date: string
  exchange: string
  /** "EQ" | "FO" | "COM" | "CD" | "MF" */
  segment: string
  transaction_type: "BUY" | "SELL"
  /** Upstox `symbol` field */
  trading_symbol: string
  scrip_name: string
  /** Upstox `instrument_token` field */
  instrument_key: string
  isin: string | null
  quantity: number
  price: number
  /** Total value = quantity × price */
  amount: number
  option_type: string | null
  strike_price: number | null
  expiry: string | null
  raw?: unknown
}

export interface HistoricalTradesPage {
  data: HistoricalTrade[]
  page_number: number
  page_size: number
  total_records: number
  total_pages: number
}

/* ─── Provider contract ────────────────────────────────────────────────── */

/**
 * All broker-specific implementations must satisfy this interface.
 * Methods that a provider doesn't support should throw a ProviderError.
 */
export interface BrokerProvider {
  /** Short stable identifier e.g. "upstox" */
  readonly id: string
  /** Human-readable name e.g. "Upstox" */
  readonly name: string

  /**
   * Today's full order book (all orders placed in the current session).
   * Upstox — GET /v2/order/retrieve-all
   */
  getOrderBook(): Promise<NormalizedOrder[]>

  /**
   * Today's executed trade book (individual fills).
   * Upstox — GET /v2/order/trades/get-trades-for-day
   */
  getTradeBook(): Promise<NormalizedTrade[]>

  /**
   * Full lifecycle of a single order (chronological list of status updates).
   * Upstox — GET /v2/order/history?order_id=...
   * Note: only available for orders placed during the CURRENT trading session.
   */
  getOrderHistory(orderId: string): Promise<OrderHistoryEntry[]>

  /**
   * Historical trades up to 3 financial years with pagination.
   * Upstox — GET /v2/charges/historical-trades
   */
  getHistoricalTrades(
    startDate: string,
    endDate: string,
    segment?: string,
    pageNumber?: number,
    pageSize?: number,
  ): Promise<HistoricalTradesPage>
}

/* ─── Provider error ───────────────────────────────────────────────────── */

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = "ProviderError"
  }
}
