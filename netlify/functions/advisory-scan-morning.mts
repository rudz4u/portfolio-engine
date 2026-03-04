import type { Config } from "@netlify/functions"

/**
 * Advisory Intelligence Scan — Shared Handler
 *
 * Called by 4 scheduled functions (morning/midday/afternoon/evening).
 * POSTs to /api/cron/advisory-scan which runs the full pipeline:
 *   scrape → extract → resolve → consensus → track-record evaluation
 */
export async function runAdvisoryScan() {
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL || "https://investbuddyai.com"

  if (!serviceKey) {
    console.error("[advisory-scan] Missing SUPABASE_SERVICE_ROLE_KEY")
    return
  }

  const url = `${appUrl}/api/cron/advisory-scan`
  console.log(`[advisory-scan] Triggering scan at ${url} — ${new Date().toISOString()}`)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      console.log("[advisory-scan] Scan complete:", JSON.stringify(data))
    } else {
      console.error(`[advisory-scan] Scan returned ${res.status}:`, JSON.stringify(data))
    }
  } catch (err) {
    console.error("[advisory-scan] Fetch error:", err)
  }
}

// ── 8:00 AM IST = 2:30 AM UTC ─────────────────────────────────────────────
export default async function handler() { await runAdvisoryScan() }
export const config: Config = { schedule: "30 2 * * 1-5" }
