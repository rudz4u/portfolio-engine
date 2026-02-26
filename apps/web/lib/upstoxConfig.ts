/**
 * Upstox API Configuration
 *
 * Centralizes all Upstox-related constants and helpers.
 * Sandbox tokens are read from env vars OR from Supabase user_settings.
 */

export const IS_SANDBOX = process.env.UPSTOX_SANDBOX !== 'false'

// Upstox uses api-hft.upstox.com for order operations (better latency)
// and api.upstox.com for everything else (profile, holdings, etc.)
export const UPSTOX_ORDER_BASE = 'https://api-hft.upstox.com'
export const UPSTOX_API_BASE = 'https://api.upstox.com'

// Sandbox-enabled endpoints (all use api-hft base)
export const UPSTOX_ENDPOINTS = {
    placeOrder: `${UPSTOX_ORDER_BASE}/v2/order/place`,
    modifyOrder: `${UPSTOX_ORDER_BASE}/v2/order/modify`,
    cancelOrder: `${UPSTOX_ORDER_BASE}/v2/order/cancel`,
    placeOrderV3: `${UPSTOX_ORDER_BASE}/v3/order/place`,
    // Live-only endpoints (use regular api base)
    profile: `${UPSTOX_API_BASE}/v2/user/profile`,
    holdings: `${UPSTOX_API_BASE}/v2/portfolio/long-term-holdings`,
    positions: `${UPSTOX_API_BASE}/v2/portfolio/positions`,
    fundMargin: `${UPSTOX_API_BASE}/v2/user/fund-margin`,
    orderBook: `${UPSTOX_API_BASE}/v2/order/retrieve-all`,
    orderHistory: `${UPSTOX_API_BASE}/v2/order/history`,
} as const

/**
 * Get the access token, preferring env var first.
 * In a multi-user setup, the per-user token from Supabase would override this.
 */
export function getAccessToken(): string | null {
    const token = process.env.UPSTOX_ACCESS_TOKEN
    if (!token || token === 'PASTE_YOUR_FULL_TOKEN_HERE') return null
    return token
}

/**
 * Standard Upstox API headers
 */
export function upstoxHeaders(accessToken: string): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
    }
}

/**
 * Sandbox-supported endpoint list (for UI display)
 */
export const SANDBOX_SUPPORTED = [
    { method: 'POST', path: '/v2/order/place', label: 'Place Order' },
    { method: 'PUT', path: '/v2/order/modify', label: 'Modify Order' },
    { method: 'DELETE', path: '/v2/order/cancel', label: 'Cancel Order' },
    { method: 'POST', path: '/v3/order/place', label: 'Place Order V3' },
    { method: 'POST', path: '/v2/order/place-multi', label: 'Place Multi Order' },
] as const

export const LIVE_ONLY_ENDPOINTS = [
    'GET /v2/user/profile',
    'GET /v2/portfolio/long-term-holdings',
    'GET /v2/portfolio/positions',
    'GET /v2/user/fund-margin',
] as const
