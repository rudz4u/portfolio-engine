import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

async function sendBrevoEmail(
  toEmail: string,
  toName: string,
  subject: string,
  htmlContent: string,
  apiKey: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!apiKey) {
    return { success: false, error: "No Brevo API key configured. Add your key in Settings → API Keys." }
  }

  let res: Response
  try {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME || "InvestBuddy AI",
          email: process.env.BREVO_SENDER_EMAIL || "noreply@investbuddyai.com",
        },
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent,
      }),
    })
  } catch (err) {
    return {
      success: false,
      error: `Network error reaching Brevo: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Brevo sometimes returns HTML on 5xx — don't assume JSON
  let data: Record<string, unknown> = {}
  try {
    data = await res.json()
  } catch {
    return {
      success: false,
      error: `Brevo returned non-JSON response (HTTP ${res.status}). Check your BREVO_API_KEY.`,
    }
  }

  if (!res.ok) {
    const msg = (data.message as string) || (data.error as string) || `Brevo HTTP ${res.status}`
    const isKeyError =
      msg.toLowerCase().includes("key not found") ||
      msg.toLowerCase().includes("unauthorized") ||
      res.status === 401
    if (isKeyError) {
      return {
        success: false,
        error: `Invalid Brevo API key. Go to Brevo → Account → API Keys and copy your key, then set it in Settings → API Keys. Brevo said: ${msg}`,
      }
    }
    return { success: false, error: `Brevo rejected email: ${msg}` }
  }

  return { success: true, messageId: data.messageId as string | undefined }
}

function buildTestDigestHtml(userName: string, date: string): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n)

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <!-- Header -->
    <div style="background:#0f172a;padding:24px 28px">
      <h1 style="margin:0;color:#f8fafc;font-size:20px;font-weight:700">InvestBuddy AI</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">Test Portfolio Digest &mdash; ${date}</p>
    </div>

    <!-- KPIs -->
    <div style="padding:24px 28px;border-bottom:1px solid #e2e8f0">
      <p style="margin:0 0 16px;color:#475569;font-size:14px">Hello, <strong>${userName}</strong>. This is a test digest email.</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Invested</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0f172a">${fmt(100000)}</p>
        </div>
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Current Value</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0f172a">${fmt(105000)}</p>
        </div>
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Total P&amp;L</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#10b981">+${fmt(5000)}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#10b981">+5.00%</p>
        </div>
      </div>
    </div>

    <!-- Info -->
    <div style="padding:20px 28px;background:#f0fdf4;border-left:4px solid #10b981">
      <p style="margin:0;font-size:13px;color:#166534">
        <strong>✓ Test email successful!</strong> Your notification settings are working correctly.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;background:#f8fafc">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        <a href="https://investbuddyai.com/dashboard" style="color:#6366f1;text-decoration:none">Open Dashboard</a>
        &nbsp;·&nbsp;
        <a href="https://investbuddyai.com/settings/notifications" style="color:#6366f1;text-decoration:none">Notification Settings</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

/**
 * POST /api/notifications/send-test-digest
 * Sends a test digest email to verify notification setup
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const recipients = (body.recipients as string[]) || []

  if (!recipients.length) {
    return NextResponse.json(
      { error: "No recipients specified" },
      { status: 400 }
    )
  }

  // Get user settings for Brevo key
  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  const prefs = (settingsRow?.preferences as Record<string, string> | null) || {}
  const brevoKey = process.env.BREVO_API_KEY || prefs.brevo_key || ""

  if (!brevoKey) {
    return NextResponse.json(
      {
        error:
          "No Brevo API key configured. Please add your Brevo API key in Settings → AI & API Keys → Bring Your Own Keys section, or contact support.",
      },
      { status: 400 }
    )
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  })

  const htmlContent = buildTestDigestHtml(user.user_metadata?.full_name || user.email || "User", dateStr)

  const results: Array<{ email: string; success: boolean; messageId?: string; error?: string }> = []

  // Send to each recipient
  for (const recipientEmail of recipients) {
    const result = await sendBrevoEmail(
      recipientEmail,
      recipientEmail,
      "InvestBuddy AI — Test Portfolio Digest",
      htmlContent,
      brevoKey
    )

    results.push({
      email: recipientEmail,
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    })
  }

  const allSucceeded = results.every((r) => r.success)

  if (!allSucceeded) {
    const failedCount = results.filter((r) => !r.success).length
    const firstError = results.find((r) => !r.success)?.error || "Unknown error"
    return NextResponse.json(
      {
        error: `Failed to send to ${failedCount} recipient(s). ${firstError}`,
        results,
      },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: `Test digest sent to ${results.length} recipient(s)`,
    results,
  })
}
