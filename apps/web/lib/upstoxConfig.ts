/**
 * Upstox API Configuration
 *
 * Centralizes all Upstox-related constants and helpers.
 * Sandbox tokens are read from env vars OR from Supabase user_settings.
 *
 * IMPORTANT:
 * - Sandbox orders use: https://api-sandbox.upstox.com
 * - Live orders use:    https://api-hft.upstox.com (high-frequency trading endpoint)
 * - Live non-order APIs: https://api.upstox.com
 */

export const IS_SANDBOX = process.env.UPSTOX_SANDBOX !== 'false'

// Base URLs differ between sandbox and live
export const UPSTOX_SANDBOX_BASE = 'https://api-sandbox.upstox.com'
export const UPSTOX_ORDER_BASE = 'https://api-hft.upstox.com'
export const UPSTOX_API_BASE = 'https://api.upstox.com'

// Order base URL switches based on mode
const ORDER_BASE = IS_SANDBOX ? UPSTOX_SANDBOX_BASE : UPSTOX_ORDER_BASE

export const UPSTOX_ENDPOINTS = {
    // Order endpoints — sandbox uses api-sandbox, live uses api-hft
    placeOrder: `${ORDER_BASE}/v2/order/place`,
    modifyOrder: `${ORDER_BASE}/v2/order/modify`,
    cancelOrder: `${ORDER_BASE}/v2/order/cancel`,
    placeOrderV3: `${ORDER_BASE}/v3/order/place`,
    // Non-order endpoints (live-only, use regular api base)
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
