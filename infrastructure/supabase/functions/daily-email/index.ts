import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// This edge function is called by pg_cron daily at 4:00 AM UTC (9:30 AM IST) Mon-Fri
// It sends portfolio digest emails to all users with email_digest = "true"

const BREVO_URL = "https://api.brevo.com/v3/smtp/email"

async function sendEmail(
  toEmail: string,
  toName: string,
  subject: string,
  htmlContent: string,
  apiKey: string
): Promise<boolean> {
  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: "InvestBuddy AI", email: "noreply@investbuddyai.com" },
      to: [{ email: toEmail, name: toName }],
      subject,
      htmlContent,
    }),
  })
  return res.ok
}

function buildSubject(totalPnL: number, pnlPct: number, date: string): string {
  const sign = totalPnL >= 0 ? "+" : ""
  const fmt = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(totalPnL))
  return `Portfolio Digest ${date}: ${sign}${fmt} (${sign}${pnlPct.toFixed(2)}%)`
}

function buildHtml(
  userName: string,
  totalInvested: number,
  currentValue: number,
  totalPnL: number,
  pnlPct: number,
  count: number,
  topGainers: Array<{ instrument_key: string; unrealized_pl: number }>,
  topLosers: Array<{ instrument_key: string; unrealized_pl: number }>,
  date: string
): string {
  const pnlColor = totalPnL >= 0 ? "#10b981" : "#ef4444"
  const sign = totalPnL >= 0 ? "+" : ""
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

  const gainersHtml = topGainers.slice(0, 3).map((h) =>
    `<tr><td style="padding:4px 8px">${h.instrument_key}</td><td style="padding:4px 8px;color:#10b981;text-align:right">+${fmt(h.unrealized_pl)}</td></tr>`
  ).join("")

  const losersHtml = topLosers.slice(0, 3).map((h) =>
    `<tr><td style="padding:4px 8px">${h.instrument_key}</td><td style="padding:4px 8px;color:#ef4444;text-align:right">${fmt(h.unrealized_pl)}</td></tr>`
  ).join("")

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
  <div style="background:#0f172a;padding:24px 28px">
    <h1 style="margin:0;color:#f8fafc;font-size:20px;font-weight:700">InvestBuddy AI</h1>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">Portfolio Digest — ${date}</p>
  </div>
  <div style="padding:24px 28px;border-bottom:1px solid #e2e8f0">
    <p style="margin:0 0 16px;color:#475569;font-size:14px">Good morning, <strong>${userName}</strong>.</p>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase">Invested</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0f172a">${fmt(totalInvested)}</p>
      </div>
      <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase">Current Value</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0f172a">${fmt(currentValue)}</p>
      </div>
      <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase">Total P&amp;L</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${pnlColor}">${sign}${fmt(totalPnL)}</p>
        <p style="margin:2px 0 0;font-size:12px;color:${pnlColor}">${sign}${pnlPct.toFixed(2)}%</p>
      </div>
    </div>
  </div>
  <div style="padding:20px 28px;border-bottom:1px solid #e2e8f0">
    <div style="display:flex;gap:24px;flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <h3 style="margin:0 0 8px;font-size:13px;color:#10b981;font-weight:600">▲ Top Gainers</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${gainersHtml}</tbody></table>
      </div>
      <div style="flex:1;min-width:200px">
        <h3 style="margin:0 0 8px;font-size:13px;color:#ef4444;font-weight:600">▼ Top Losers</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${losersHtml}</tbody></table>
      </div>
    </div>
  </div>
  <div style="padding:16px 28px;background:#f8fafc">
    <p style="margin:0;font-size:12px;color:#94a3b8">
      ${count} active holdings &nbsp;·&nbsp;
      <a href="https://brokerai.rudz.in/dashboard" style="color:#6366f1;text-decoration:none">Open Dashboard</a>
      &nbsp;·&nbsp;
      <a href="https://brokerai.rudz.in/settings" style="color:#94a3b8;text-decoration:none">Unsubscribe</a>
    </p>
  </div>
</div>
</body></html>`
}

serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? ""

  if (!brevoKey) {
    return new Response(
      JSON.stringify({ status: "skipped", message: "BREVO_API_KEY not configured" }),
      { headers: { "Content-Type": "application/json" } }
    )
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey)

  // Get all users with email_digest enabled
  const { data: settings, error: settingsErr } = await supabaseAdmin
    .from("user_settings")
    .select("user_id, preferences")

  if (settingsErr) {
    return new Response(JSON.stringify({ status: "error", error: settingsErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const digestUsers = (settings ?? []).filter((s) => {
    const prefs = s.preferences as Record<string, string> | null
    return prefs?.email_digest === "true"
  })

  if (digestUsers.length === 0) {
    return new Response(
      JSON.stringify({ status: "ok", message: "No users with digest enabled", sent: 0 }),
      { headers: { "Content-Type": "application/json" } }
    )
  }

  const date = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  let sent = 0
  const errors: string[] = []

  for (const setting of digestUsers) {
    try {
      const prefs = setting.preferences as Record<string, string> | null
      const userBrevoKey = prefs?.brevo_key || brevoKey

      // Get user email from auth.users via admin
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(setting.user_id)
      const toEmail = prefs?.notification_email || authUser?.user?.email || ""
      if (!toEmail) continue

      const userName = toEmail.split("@")[0]

      // Get portfolio
      const { data: portfolio } = await supabaseAdmin
        .from("portfolios")
        .select("id")
        .eq("user_id", setting.user_id)
        .single()

      if (!portfolio) continue

      const { data: holdings } = await supabaseAdmin
        .from("holdings")
        .select("instrument_key, invested_amount, unrealized_pl, quantity")
        .eq("portfolio_id", portfolio.id)
        .not("instrument_key", "eq", "Total")

      const rows = holdings ?? []
      const totalInvested = rows.reduce((s, h) => s + (h.invested_amount || 0), 0)
      const totalPnL = rows.reduce((s, h) => s + (h.unrealized_pl || 0), 0)
      const currentValue = totalInvested + totalPnL
      const pnlPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
      const count = rows.filter((h) => h.quantity > 0).length

      const sorted = [...rows].filter((h) => h.unrealized_pl != null && h.quantity > 0)
      const topGainers = [...sorted].sort((a, b) => (b.unrealized_pl || 0) - (a.unrealized_pl || 0)).slice(0, 3)
      const topLosers = [...sorted].sort((a, b) => (a.unrealized_pl || 0) - (b.unrealized_pl || 0)).slice(0, 3)

      const subject = buildSubject(totalPnL, pnlPct, date)
      const html = buildHtml(userName, totalInvested, currentValue, totalPnL, pnlPct, count, topGainers, topLosers, date)

      const ok = await sendEmail(toEmail, userName, subject, html, userBrevoKey)
      if (ok) {
        sent++
      } else {
        errors.push(`Failed for ${toEmail}`)
      }
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return new Response(
    JSON.stringify({ status: "success", sent, errors, total: digestUsers.length }),
    { headers: { "Content-Type": "application/json" } }
  )
})
