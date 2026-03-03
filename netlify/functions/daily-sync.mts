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

  if (!supabaseUrl || !serviceKey) {
    console.error("[daily-sync] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return
  }

  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/daily-sync`

  console.log(`[daily-sync] Triggering edge function at ${edgeFunctionUrl}`)

  try {
    const res = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[daily-sync] Edge function returned ${res.status}: ${body}`)
      return
    }

    const data = await res.json()
    console.log("[daily-sync] Success:", JSON.stringify(data))
  } catch (err) {
    console.error("[daily-sync] Fetch error:", err)
  }
}

export const config: Config = {
  // 4:30 AM UTC = 10:00 AM IST. Runs Monday–Friday only.
  schedule: "30 4 * * 1-5",
}
