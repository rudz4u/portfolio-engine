import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

/**
 * POST /api/cron/digest
 * Service-role-protected endpoint called by the daily-sync Netlify scheduled
 * function after syncing holdings. Sends morning portfolio digest emails to
 * every user who has notif_daily_digest = "true" in their preferences.
 *
 * Required header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? ""
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!supabaseUrl) {
    return NextResponse.json({ error: "Missing SUPABASE_URL" }, { status: 500 })
  }

  // Admin client (bypasses RLS)
  const supabase = createServiceClient(supabaseUrl, serviceKey)

  // Resolve env-level Brevo key (admin fallback)
  const envBrevoKey = process.env.BREVO_API_KEY ?? ""

  // Fetch all user_settings rows where notif_daily_digest = "true"
  const { data: settingsRows, error: sErr } = await supabase
    .from("user_settings")
    .select("user_id, preferences")

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  const eligible = (settingsRows ?? []).filter((row) => {
    const prefs = (row.preferences as Record<string, string>) || {}
    return prefs.notif_daily_digest === "true"
  })

  if (eligible.length === 0) {
    return NextResponse.json({ status: "ok", message: "No users with digest enabled", sent: 0 })
  }

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of eligible) {
    const prefs = (row.preferences as Record<string, string>) || {}

    // Resolve Brevo key: user's own key first, then env-level fallback
    const brevoKey = prefs.brevo_key || envBrevoKey
    if (!brevoKey) { skipped++; continue }

    // Resolve recipient email
    const emailList = (prefs.notification_emails || "")
      .split(",")
      .map((e: string) => e.trim())
      .filter(Boolean)

    // Fetch auth user email as fallback
    let toEmail = emailList[0] || ""
    if (!toEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id)
      toEmail = authUser?.user?.email ?? ""
    }
    if (!toEmail) { skipped++; continue }

    // Fetch portfolio summary
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", row.user_id)
      .single()

    if (!portfolio) { skipped++; continue }

    const { data: holdings } = await supabase
      .from("holdings")
      .select("instrument_key, company_name, trading_symbol, invested_amount, unrealized_pl, quantity")
      .eq("portfolio_id", portfolio.id)
      .not("instrument_key", "eq", "Total")

    const rows = holdings ?? []
    const totalInvested = rows.reduce((s, h) => s + (h.invested_amount || 0), 0)
    const totalPnL = rows.reduce((s, h) => s + (h.unrealized_pl || 0), 0)
    const currentValue = totalInvested + totalPnL
    const pnlPercent = totalInvested > 0 ? totalPnL / totalInvested : 0
    const count = rows.filter((h) => h.quantity > 0).length

    function displayName(h: { instrument_key: string; company_name?: string | null; trading_symbol?: string | null }) {
      if (h.company_name) return h.company_name
      if (h.trading_symbol) return h.trading_symbol
      const raw = h.instrument_key || ""
      return raw.includes("|") ? raw.split("|")[1] : raw
    }

    const active = rows.filter((h) => h.unrealized_pl != null && h.quantity && h.quantity > 0)
    const topGainers = [...active]
      .sort((a, b) => (b.unrealized_pl || 0) - (a.unrealized_pl || 0))
      .slice(0, 3)
      .map((h) => ({ name: displayName(h), pnl: h.unrealized_pl || 0 }))
    const topLosers = [...active]
      .sort((a, b) => (a.unrealized_pl || 0) - (b.unrealized_pl || 0))
      .slice(0, 3)
      .map((h) => ({ name: displayName(h), pnl: h.unrealized_pl || 0 }))

    const { data: recentOrdersRaw } = await supabase
      .from("orders")
      .select("side, instrument_key, quantity, status")
      .eq("user_id", row.user_id)
      .order("created_at", { ascending: false })
      .limit(3)

    const toName = toEmail.split("@")[0]
    const fmt = (n: number) =>
      new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
    const pnlSign = totalPnL >= 0 ? "+" : ""
    const pnlColor = totalPnL >= 0 ? "#10b981" : "#ef4444"
    const date = new Date().toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    })

    const gainersHtml = topGainers.map((g) =>
      `<tr><td style="padding:3px 6px">${g.name}</td><td style="padding:3px 6px;color:#10b981;text-align:right">+${fmt(g.pnl)}</td></tr>`
    ).join("")
    const losersHtml = topLosers.map((l) =>
      `<tr><td style="padding:3px 6px">${l.name}</td><td style="padding:3px 6px;color:#ef4444;text-align:right">${fmt(l.pnl)}</td></tr>`
    ).join("")
    const ordersHtml = (recentOrdersRaw ?? []).map((o) =>
      `<tr><td style="padding:3px 6px">${o.side} ${o.instrument_key}</td><td style="padding:3px 6px;text-align:right">${o.quantity} — ${o.status}</td></tr>`
    ).join("")

    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;margin:0;padding:0;background:#f1f5f9">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px">
    <h1 style="margin:0;color:#fff;font-size:22px">BrokerAI — Morning Digest</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,.8);font-size:13px">${date}</p>
  </div>
  <div style="padding:20px 28px">
    <p style="margin:0 0 16px;font-size:14px;color:#475569">Hi ${toName}, here&rsquo;s your portfolio snapshot:</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase">Invested</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a">${fmt(totalInvested)}</p>
      </div>
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase">Value</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a">${fmt(currentValue)}</p>
      </div>
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:8px;padding:14px">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase">P&amp;L</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${pnlColor}">${pnlSign}${fmt(totalPnL)}</p>
        <p style="margin:2px 0 0;font-size:12px;color:${pnlColor}">${pnlSign}${(pnlPercent * 100).toFixed(2)}%</p>
      </div>
    </div>
  </div>
  <div style="padding:8px 28px 20px;border-top:1px solid #e2e8f0">
    <div style="display:flex;gap:20px;flex-wrap:wrap">
      <div style="flex:1;min-width:180px">
        <h3 style="margin:16px 0 6px;font-size:13px;color:#10b981">▲ Top Gainers</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${gainersHtml}</tbody></table>
      </div>
      <div style="flex:1;min-width:180px">
        <h3 style="margin:16px 0 6px;font-size:13px;color:#ef4444">▼ Top Losers</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${losersHtml}</tbody></table>
      </div>
    </div>
  </div>
  ${(recentOrdersRaw ?? []).length > 0 ? `<div style="padding:8px 28px 20px;border-top:1px solid #e2e8f0">
    <h3 style="margin:16px 0 6px;font-size:13px;color:#475569">Recent Orders</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${ordersHtml}</tbody></table>
  </div>` : ""}
  <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:12px;color:#94a3b8">${count} active holdings · <a href="https://investbuddyai.com/dashboard" style="color:#6366f1">Open Dashboard</a></p>
  </div>
</div>
</body></html>`

    const subject = `Portfolio Digest ${date}: ${pnlSign}${fmt(totalPnL)} (${pnlSign}${(pnlPercent * 100).toFixed(2)}%)`

    try {
      const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "api-key": brevoKey,
        },
        body: JSON.stringify({
          sender: { name: "InvestBuddy AI", email: "noreply@investbuddyai.com" },
          to: [{ email: toEmail, name: toName }],
          subject,
          htmlContent: html,
        }),
      })

      if (emailRes.ok) {
        sent++
        // Log for audit
        try {
          await supabase.from("analysis_reports").insert({
            user_id: row.user_id,
            report_type: "daily_digest",
            data: { sent_to: toEmail, sent_at: new Date().toISOString() },
          })
        } catch { /* ignore audit log errors */ }
      } else {
        const err = await emailRes.json().catch(() => ({}))
        errors.push(`${toEmail}: ${err.message ?? emailRes.status}`)
      }
    } catch (e: unknown) {
      errors.push(`${toEmail}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({
    status: "ok",
    eligible: eligible.length,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  })
}
