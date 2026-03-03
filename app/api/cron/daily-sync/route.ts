import { NextResponse } from "next/server"

/**
 * Manual trigger for daily sync — useful for ad-hoc runs or testing.
 * The same logic runs automatically via netlify/functions/daily-sync.mts Mon–Fri 10 AM IST.
 *
 * POST /api/cron/daily-sync
 * Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? ""
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

  // Require service-role bearer to prevent public invocation
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://brokerai.rudz.in"

  try {
    const res = await fetch(`${appUrl}/api/cron/sync-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: "sync-all error", detail: data }, { status: 502 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
