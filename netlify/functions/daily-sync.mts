import type { Config } from "@netlify/functions"

/**
 * Netlify Scheduled Function — Daily Portfolio Sync
 * Runs Mon–Fri at 4:30 AM UTC (10:00 AM IST).
 * Calls the Supabase Edge Function which:
 *   1. Fetches latest holdings from Upstox API
 *   2. Upserts rows into the `holdings` table
 *   3. Logs a daily_sync entry in analysis_reports
 *
 * Required env vars (set in Netlify dashboard):
 *   NEXT_PUBLIC_SUPABASE_URL   — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (NOT the anon key)
 */
export default async function handler() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  // The live Next.js app URL — used to call /api/cron/digest after sync
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL || "https://brokerai.rudz.in"

  if (!supabaseUrl || !serviceKey) {
    console.error("[daily-sync] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
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

  // ── 2. Send morning digest emails to opted-in users ──────────────────────
  const digestUrl = `${appUrl}/api/cron/digest`
  console.log(`[daily-sync] Triggering digest at ${digestUrl}`)

  try {
    const digestRes = await fetch(digestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    const digestData = await digestRes.json().catch(() => ({}))
    if (digestRes.ok) {
      console.log("[daily-sync] Digest sent:", JSON.stringify(digestData))
    } else {
      console.error(`[daily-sync] Digest returned ${digestRes.status}:`, JSON.stringify(digestData))
    }
  } catch (err) {
    console.error("[daily-sync] Digest fetch error:", err)
  }
}

export const config: Config = {
  // 4:30 AM UTC = 10:00 AM IST. Runs Monday–Friday only.
  schedule: "30 4 * * 1-5",
}
