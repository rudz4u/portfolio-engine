import type { Config } from "@netlify/functions"

/**
 * Netlify Scheduled Function — Daily Digest Emailer
 * Runs Mon–Fri every hour at :30 UTC, which aligns to :00 IST
 * (IST = UTC + 5:30), covering the window 6:00 AM–1:00 PM IST.
 *
 * The digest route (/api/cron/digest) reads each user's digest_send_time
 * preference (e.g. "08:00") and only sends the email when the current IST
 * hour matches. Users without a preference default to 10:00 IST.
 *
 * Required env vars (set in Netlify dashboard):
 *   NEXT_PUBLIC_APP_URL        — e.g. https://investbuddyai.com
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (NOT the anon key)
 */
export default async function handler() {
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL || "https://investbuddyai.com"
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    console.error("[digest-emailer] Missing SUPABASE_SERVICE_ROLE_KEY")
    return
  }

  const digestUrl = `${appUrl}/api/cron/digest`
  console.log(`[digest-emailer] Triggering digest at ${digestUrl}`)

  try {
    const res = await fetch(digestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({}),
    })

    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      console.log("[digest-emailer] Digest response:", JSON.stringify(data))
    } else {
      console.error(`[digest-emailer] Digest returned ${res.status}:`, JSON.stringify(data))
    }
  } catch (err) {
    console.error("[digest-emailer] Fetch error:", err)
  }
}

export const config: Config = {
  // Every hour at :30 UTC = :00 IST, Mon–Fri. Covers 6 AM–1 PM IST.
  schedule: "30 0-7 * * 1-5",
}
