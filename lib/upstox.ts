// Upstox API configuration
// Use getters for env vars that can change between deployments so the value
// is always read fresh from process.env at call time, not frozen at module load.
export const UPSTOX_CONFIG = {
  get clientId() { return process.env.UPSTOX_CLIENT_ID || "" },
  get clientSecret() { return process.env.UPSTOX_CLIENT_SECRET || "" },
  get redirectUri() { return process.env.UPSTOX_REDIRECT_URI || "https://investbuddyai.com/api/oauth/upstox/callback" },
  get accessToken() { return process.env.UPSTOX_ACCESS_TOKEN || "" },
  /**
   * Application-level Analytics Token — generated once from the Upstox Developer
   * Apps → Analytics tab. Valid for 1 year. Read-only; covers LTP, OHLC, historical
   * candles, market quotes, market status, option chain, and instrument search.
   * Does NOT require any user OAuth flow. Set UPSTOX_ANALYTICS_TOKEN in env.
   */
  get analyticsToken() { return process.env.UPSTOX_ANALYTICS_TOKEN || "" },
  get sandbox() { return process.env.UPSTOX_SANDBOX === "true" },
  baseUrl: "https://api.upstox.com/v2",
  authUrl: "https://api.upstox.com/v2/login/authorization/dialog",
  tokenUrl: "https://api.upstox.com/v2/login/authorization/token",
}

export function getUpstoxHeaders(accessToken?: string) {
  const token = accessToken || UPSTOX_CONFIG.accessToken
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  }
}

export interface UpstoxHolding {
  company_name: string
  instrument_token: string
  isin: string
  trading_symbol: string
  exchange: string
  quantity: number
  average_price: number
  last_price: number
  close_price: number
  pnl: number
  day_change: number
  day_change_percentage: number
}

export interface UpstoxProfile {
  email: string
  user_name: string
  user_id: string
  broker: string
}

export interface UpstoxFunds {
  equity: {
    used_margin: number
    available_margin: number
  }
  commodity: {
    used_margin: number
    available_margin: number
  }
}
