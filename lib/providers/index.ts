/**
 * Provider factory.
 *
 * Usage:
 *   import { getProvider } from "@/lib/providers"
 *   const provider = getProvider("upstox")   // or "zerodha" once implemented
 *   const orders = await provider.getOrderBook()
 *
 * Adding a new broker:
 *   1. Create lib/providers/<name>.ts implementing BrokerProvider
 *   2. Add a case to the switch below
 *   3. That's it — all API routes and UI automatically support it
 */

import { ProviderError, BrokerProvider } from "./types"
import { UpstoxProvider } from "./upstox"

export * from "./types"

export function getProvider(source = "upstox"): BrokerProvider {
  switch (source.toLowerCase()) {
    case "upstox":
      return new UpstoxProvider()
    // case "zerodha": return new ZerodhaProvider()
    // case "groww":   return new GrowwProvider()
    default:
      throw new ProviderError(source, `Unknown broker provider: "${source}"`, 400)
  }
}
