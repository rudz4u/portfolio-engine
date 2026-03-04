/**
 * GET  /api/advisory/trigger  — returns today's remaining manual scans (max 4)
 * POST /api/advisory/trigger  — runs the advisory scan pipeline (rate-limited 4×/day per user)
 *
 * Daily usage is tracked in user_settings.preferences.advisory_manual_triggers
 * JSONB column as { date: "YYYY-MM-DD", count: N }.
 * No schema migration needed — preferences is already an open JSONB column.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MAX_PER_DAY = 4

/** Read today's usage from the preferences JSONB. Returns { date, count }. */
function parseTriggerUsage(preferences: Record<string, unknown>): { date: string; count: number } {
  const raw = preferences?.advisory_manual_triggers as { date?: string; count?: number } | undefined
  const today = new Date().toISOString().slice(0, 10)
  if (!raw || raw.date !== today) return { date: today, count: 0 }
  return { date: today, count: raw.count ?? 0 }
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: settings } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle()

  const prefs = (settings?.preferences ?? {}) as Record<string, unknown>
  const usage = parseTriggerUsage(prefs)
  const remaining = Math.max(0, MAX_PER_DAY - usage.count)

  return NextResponse.json({ remaining, used: usage.count, max: MAX_PER_DAY, date: usage.date })
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // ── 1. Check daily rate limit ─────────────────────────────────────────
  const { data: settings } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .maybeSingle()

  const prefs = (settings?.preferences ?? {}) as Record<string, unknown>
  const usage = parseTriggerUsage(prefs)

  if (usage.count >= MAX_PER_DAY) {
    return NextResponse.json(
      { error: `Daily limit reached (${MAX_PER_DAY} manual scans per day)`, remaining: 0 },
      { status: 429 }
    )
  }

  // ── 2. Increment usage counter immediately (before scan, so double-clicks don't bypass) ──
  const newCount = usage.count + 1
  const newPrefs = {
    ...prefs,
    advisory_manual_triggers: { date: usage.date, count: newCount },
  }

  await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, preferences: newPrefs },
      { onConflict: "user_id" }
    )

  // ── 3. Trigger advisory scan pipeline ────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://brokerai.rudz.in"
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const scanStart = Date.now()
  let scanResult: Record<string, unknown> = {}
  let scanError: string | null = null

  try {
    const res = await fetch(`${appUrl}/api/cron/advisory-scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
    })
    scanResult = await res.json().catch(() => ({}))
    if (!res.ok) {
      scanError = `Scan returned HTTP ${res.status}`
    }
  } catch (err) {
    scanError = String(err)
  }

  return NextResponse.json({
    ok: !scanError,
    error: scanError,
    remaining: Math.max(0, MAX_PER_DAY - newCount),
    used: newCount,
    max: MAX_PER_DAY,
    elapsed_ms: Date.now() - scanStart,
    scan: scanResult,
  })
}
