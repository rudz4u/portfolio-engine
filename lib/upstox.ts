// Upstox API configuration
export const UPSTOX_CONFIG = {
  clientId: process.env.UPSTOX_CLIENT_ID || "",
  clientSecret: process.env.UPSTOX_CLIENT_SECRET || "",
  redirectUri: process.env.UPSTOX_REDIRECT_URI || "",
  accessToken: process.env.UPSTOX_ACCESS_TOKEN || "",
  sandbox: process.env.UPSTOX_SANDBOX === "true",
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
