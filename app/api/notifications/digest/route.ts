import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface BrevoResult {
  messageId?: string
  error?: string
}

async function sendBrevoEmail(
  toEmail: string,
  toName: string,
  subject: string,
  htmlContent: string,
  apiKey: string
): Promise<BrevoResult> {
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
    return { error: `Network error reaching Brevo: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Brevo sometimes returns HTML on 5xx — don't assume JSON
  let data: Record<string, unknown> = {}
  try {
    data = await res.json()
  } catch {
    return { error: `Brevo returned non-JSON response (HTTP ${res.status}). Check your BREVO_API_KEY env var.` }
  }

  if (!res.ok) {
    const msg = (data.message as string) || (data.error as string) || `Brevo HTTP ${res.status}`
    return { error: `Brevo rejected email: ${msg}` }
  }
  return { messageId: data.messageId as string | undefined }
}

function buildDigestHtml(summary: {
  userName: string
  totalInvested: number
  currentValue: number
  totalPnL: number
  pnlPercent: number
  count: number
  topGainers: Array<{ display_name: string; unrealized_pl: number }>
  topLosers: Array<{ display_name: string; unrealized_pl: number }>
  recentOrders: Array<{ side: string; instrument_key: string; meta: Record<string, string>; quantity: number; status: string }>
  date: string
}): string {
  const pnlColor = summary.totalPnL >= 0 ? "#10b981" : "#ef4444"
  const pnlSign = summary.totalPnL >= 0 ? "+" : ""
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

  const gainersHtml = summary.topGainers
    .slice(0, 3)
    .map(
      (h) =>
        `<tr><td style="padding:4px 8px">${h.display_name}</td><td style="padding:4px 8px;color:#10b981;text-align:right">+${fmt(h.unrealized_pl)}</td></tr>`
    )
    .join("")

  const losersHtml = summary.topLosers
    .slice(0, 3)
    .map(
      (h) =>
        `<tr><td style="padding:4px 8px">${h.display_name}</td><td style="padding:4px 8px;color:#ef4444;text-align:right">${fmt(h.unrealized_pl)}</td></tr>`
    )
    .join("")

  const ordersHtml = summary.recentOrders.length
    ? summary.recentOrders
        .slice(0, 3)
        .map((o) => {
          const sym = o.meta?.trading_symbol || o.instrument_key
          const sideColor = o.side === "BUY" ? "#10b981" : "#ef4444"
          return `<tr><td style="padding:4px 8px"><span style="color:${sideColor};font-weight:600">${o.side}</span> ${sym}</td><td style="padding:4px 8px;text-align:right">${o.quantity} @ ${o.status}</td></tr>`
        })
        .join("")
    : `<tr><td colspan="2" style="padding:4px 8px;color:#94a3b8">No recent orders</td></tr>`

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <!-- Header -->
    <div style="background:#0f172a;padding:24px 28px">
      <h1 style="margin:0;color:#f8fafc;font-size:20px;font-weight:700">InvestBuddy AI</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">Portfolio Digest &mdash; ${summary.date}</p>
    </div>

    <!-- KPIs -->
    <div style="padding:24px 28px;border-bottom:1px solid #e2e8f0">
      <p style="margin:0 0 16px;color:#475569;font-size:14px">Good morning, <strong>${summary.userName}</strong>. Here's your portfolio snapshot.</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Invested</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0f172a">${fmt(summary.totalInvested)}</p>
        </div>
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Current Value</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0f172a">${fmt(summary.currentValue)}</p>
        </div>
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Total P&amp;L</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${pnlColor}">${pnlSign}${fmt(summary.totalPnL)}</p>
          <p style="margin:2px 0 0;font-size:12px;color:${pnlColor}">${pnlSign}${(summary.pnlPercent * 100).toFixed(2)}%</p>
        </div>
      </div>
    </div>

    <!-- Movers -->
    <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0">
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <h3 style="margin:0 0 8px;font-size:13px;color:#10b981;font-weight:600">▲ Top Gainers</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tbody>${gainersHtml}</tbody>
          </table>
        </div>
        <div style="flex:1;min-width:200px">
          <h3 style="margin:0 0 8px;font-size:13px;color:#ef4444;font-weight:600">▼ Top Losers</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tbody>${losersHtml}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Recent Orders -->
    <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0">
      <h3 style="margin:0 0 8px;font-size:13px;color:#475569;font-weight:600">Recent Orders</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tbody>${ordersHtml}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;background:#f8fafc">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        ${summary.count} active holdings &nbsp;·&nbsp;
        <a href="https://investbuddyai.com/dashboard" style="color:#6366f1;text-decoration:none">Open Dashboard</a>
        &nbsp;·&nbsp;
        <a href="https://investbuddyai.com/settings" style="color:#94a3b8;text-decoration:none">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: settingsRow } = await supabase
    .from("user_settings").select("preferences").eq("user_id", user.id).single()
  const prefs = (settingsRow?.preferences as Record<string, string> | null) || {}

  const brevoKey = prefs.brevo_key || process.env.BREVO_API_KEY || ""
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@investbuddyai.com"
  const senderName  = process.env.BREVO_SENDER_NAME  || "InvestBuddy AI"

  const emailList = (prefs.notification_emails || "").split(",").map((e: string) => e.trim()).filter(Boolean)
  const recipientEmail = emailList[0] || user.email || ""

  return NextResponse.json({
    status: "ok",
    diagnostics: {
      brevo_key_source:   prefs.brevo_key ? "user_settings" : process.env.BREVO_API_KEY ? "env_var" : "MISSING",
      brevo_key_set:      !!brevoKey,
      sender_email:       senderEmail,
      sender_name:        senderName,
      recipient_email:    recipientEmail,
      notification_emails_configured: emailList.length > 0,
      tip: !brevoKey
        ? "Set BREVO_API_KEY in Netlify env vars, or add your key in Settings → API Keys."
        : `Sender domain '${senderEmail.split("@")[1]}' must be verified in Brevo → Senders, Domains & Dedicated IPs → Domains. Or set BREVO_SENDER_EMAIL env var to an already-verified sender.`,
    },
  })
}

export async function POST(request: Request) {
  try {
    return await handleDigest(request)
  } catch (err) {
    console.error("[digest] Unhandled error:", err)
    return NextResponse.json(
      { error: `Internal error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

async function handleDigest(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: settingsRowPre } = await supabase
    .from("user_settings")
    .select("preferences")
    .eq("user_id", user.id)
    .single()

  const prefsPre = (settingsRowPre?.preferences as Record<string, string> | null) || {}

  // Allow user-supplied Brevo key first, fall back to server env
  const brevoKey = prefsPre.brevo_key || process.env.BREVO_API_KEY || ""

  if (!brevoKey) {
    return NextResponse.json(
      { error: "No Brevo API key configured. Add BREVO_API_KEY in Netlify env vars or save your own key in Settings → API Keys." },
      { status: 400 }
    )
  }

  // --- Rate limit: max 3 test digests per user per calendar day (UTC) ---
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count: sentToday } = await supabase
    .from("analysis_reports")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("report_type", "test_digest")
    .gte("created_at", todayStart.toISOString())

  if ((sentToday ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Daily limit reached. You can send at most 3 test digests per day." },
      { status: 429 }
    )
  }

  // reuse prefsPre (already fetched above)
  const prefs = prefsPre
  // Use first address from notification_emails list, fall back to account email
  const emailList = (prefs.notification_emails || "")
    .split(",")
    .map((e: string) => e.trim())
    .filter(Boolean)
  const toEmail = emailList[0] || user.email || ""
  const toName = user.email?.split("@")[0] ?? "User"

  if (!toEmail) {
    return NextResponse.json({ error: "No recipient email configured" }, { status: 400 })
  }

  // Build portfolio summary
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!portfolio) {
    return NextResponse.json({ error: "No portfolio found" }, { status: 404 })
  }

  const { data: holdings } = await supabase
    .from("holdings")
    .select("instrument_key, company_name, trading_symbol, invested_amount, unrealized_pl, quantity, segment")
    .eq("portfolio_id", portfolio.id)
    .not("instrument_key", "eq", "Total")

  const rows = holdings ?? []
  const totalInvested = rows.reduce((s, h) => s + (h.invested_amount || 0), 0)
  const totalPnL = rows.reduce((s, h) => s + (h.unrealized_pl || 0), 0)
  const currentValue = totalInvested + totalPnL
  const pnlPercent = totalInvested > 0 ? totalPnL / totalInvested : 0
  const count = rows.filter((h) => h.quantity > 0).length

  // Helper: prefer company_name > trading_symbol > instrument_key (strip exchange prefix)
  function displayName(h: { instrument_key: string; company_name?: string | null; trading_symbol?: string | null }): string {
    if (h.company_name) return h.company_name
    if (h.trading_symbol) return h.trading_symbol
    // strip "NSE_EQ|" / "BSE_EQ|" prefix if present
    const raw = h.instrument_key || ""
    return raw.includes("|") ? raw.split("|")[1] : raw
  }

  const sorted = [...rows].filter((h) => h.unrealized_pl != null && h.quantity > 0)
  const topGainers = sorted
    .sort((a, b) => (b.unrealized_pl || 0) - (a.unrealized_pl || 0))
    .slice(0, 3)
    .map((h) => ({ display_name: displayName(h), unrealized_pl: h.unrealized_pl || 0 }))
  const topLosers = [...rows]
    .filter((h) => h.unrealized_pl != null && h.quantity > 0)
    .sort((a, b) => (a.unrealized_pl || 0) - (b.unrealized_pl || 0))
    .slice(0, 3)
    .map((h) => ({ display_name: displayName(h), unrealized_pl: h.unrealized_pl || 0 }))

  const { data: recentOrdersRaw } = await supabase
    .from("orders")
    .select("side, instrument_key, quantity, status, meta")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3)

  const recentOrders = (recentOrdersRaw ?? []).map((o) => ({
    side: o.side,
    instrument_key: o.instrument_key,
    quantity: o.quantity,
    status: o.status,
    meta: (o.meta as Record<string, string>) || {},
  }))

  const date = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const html = buildDigestHtml({
    userName: toName,
    totalInvested,
    currentValue,
    totalPnL,
    pnlPercent,
    count,
    topGainers,
    topLosers,
    recentOrders,
    date,
  })

  const pnlSign = totalPnL >= 0 ? "+" : ""
  const fmtShort = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

  const subject = `Portfolio Digest ${date}: ${pnlSign}${fmtShort(totalPnL)} (${pnlSign}${(pnlPercent * 100).toFixed(2)}%)`

  const result = await sendBrevoEmail(toEmail, toName, subject, html, brevoKey)

  if (result.error) {
    return NextResponse.json(
      { error: result.error, hint: "Check that BREVO_SENDER_EMAIL is a verified sender domain in your Brevo account, and your BREVO_API_KEY is valid." },
      { status: 400 }
    )
  }

  // Log test send for rate-limiting (best-effort, non-critical)
  try {
    await supabase.from("analysis_reports").insert({
      user_id: user.id,
      report_type: "test_digest",
      data: { sent_to: toEmail, message_id: result.messageId, sent_at: new Date().toISOString() },
    })
  } catch { /* ignore */ }

  const remaining = 2 - (sentToday ?? 0)
  return NextResponse.json({
    status: "success",
    message: `Digest sent to ${toEmail}. ${remaining > 0 ? `${remaining} test${remaining === 1 ? "" : "s"} remaining today.` : "Daily limit reached."}`,
    messageId: result.messageId,
  })
}
