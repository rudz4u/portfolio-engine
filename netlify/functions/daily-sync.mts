import type { Config } from "@netlify/functions"

/**
 * Netlify Scheduled Function — Daily Portfolio Sync
 * Runs Mon–Fri at 4:30 AM UTC (10:00 AM IST).
 * Calls /api/cron/sync-all which fetches Upstox holdings using the
 * UPSTOX_ACCESS_TOKEN env var set in the Netlify dashboard.
 *
 * Required env vars (set in Netlify dashboard):
 *   NEXT_PUBLIC_SUPABASE_URL   — your Supabase project URL
 *   SUPABASE_SECRET_KEY         — secret key (NOT the publishable key)
 *   UPSTOX_ACCESS_TOKEN         — Upstox API access token for the account
 */
export default async function handler() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SECRET_KEY
  // The live Next.js app URL — used to call /api/cron/digest after sync
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL || "https://investbuddyai.com"

  if (!supabaseUrl || !serviceKey) {
    console.error("[daily-sync] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY")
    return
  }

  // ── 1. Sync holdings for all users via Next.js cron endpoint ───────────────
  const syncAllUrl = `${appUrl}/api/cron/sync-all`
  console.log(`[daily-sync] Triggering sync-all at ${syncAllUrl}`)

  try {
    const res = await fetch(syncAllUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[daily-sync] sync-all returned ${res.status}: ${body}`)
      // Still attempt digest even if sync had issues (use cached DB values)
    } else {
      const data = await res.json()
      console.log("[daily-sync] sync-all success:", JSON.stringify(data))
    }
  } catch (err) {
    console.error("[daily-sync] sync-all fetch error:", err)
  }

  console.log("[daily-sync] Holdings sync complete. Digest emails are handled by the digest-emailer scheduled function.")
}

export const config: Config = {
  // 4:30 AM UTC = 10:00 AM IST. Runs Monday–Friday only.
  schedule: "40 6 * * 1-5",
}
