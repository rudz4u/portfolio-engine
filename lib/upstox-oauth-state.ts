import { createHmac } from "crypto"

/** HMAC signing key derived from the Upstox client secret (server-only). */
export const STATE_SECRET =
  process.env.UPSTOX_CLIENT_SECRET ||
  process.env.UPSTOX_CLIENT_ID ||
  "upstox-oauth-state"

export const STATE_TTL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Creates an HMAC-signed, base64url-encoded state token that embeds the
 * user's Supabase ID.  Used in the Upstox OAuth `state` param so the
 * callback can verify identity server-side without a browser cookie.
 */
export function createOAuthState(userId: string): string {
  const ts = Date.now().toString()
  const msg = `${userId};${ts}`
  const sig = createHmac("sha256", STATE_SECRET).update(msg).digest("hex").slice(0, 32)
  return Buffer.from(`${msg};${sig}`).toString("base64url")
}

/**
 * Verifies the HMAC signature and TTL of a state token produced by
 * `createOAuthState`.  Returns the embedded userId on success, or null.
 */
export function parseOAuthState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8")
    const parts = decoded.split(";")
    if (parts.length !== 3) return null
    const [userId, tsStr, sig] = parts
    const msg = `${userId};${tsStr}`
    const expected = createHmac("sha256", STATE_SECRET)
      .update(msg)
      .digest("hex")
      .slice(0, 32)
    if (sig !== expected) return null
    const ts = parseInt(tsStr, 10)
    if (!ts || Date.now() - ts > STATE_TTL_MS) return null
    return userId
  } catch {
    return null
  }
}
