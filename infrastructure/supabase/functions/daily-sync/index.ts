import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

/**
 * Supabase Edge Function: daily-sync
 * Called by pg_cron at 4:30 AM UTC (10:00 AM IST) Mon–Fri.
 *
 * Architecture note:
 * ─────────────────────────────────────────────────────────────────────
 * Each user authenticates with Upstox through the OAuth flow in the app.
 * Their access token is stored in user_settings.preferences.upstox_access_token
 * after a successful OAuth callback.
 *
 * This function NEVER relies on a shared/static UPSTOX_ACCESS_TOKEN env var.
 * Instead it:
 *   1. Reads ALL user_settings rows from the DB
 *   2. For each user that has an upstox_access_token in their preferences,
 *      fetches their live holdings from Upstox API
 *   3. Upserts holdings into the holdings table (preserving user-set segments)
 *   4. Sends a morning digest email via Brevo
 *   5. Users WITHOUT a token are silently skipped — their token may expire or
 *      they may not have connected Upstox yet.
 * ─────────────────────────────────────────────────────────────────────
 */

const UPSTOX_BASE_URL = "https://api.upstox.com/v2"
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

interface UpstoxHolding {
  trading_symbol: string
  company_name: string
  exchange: string
  instrument_token: string
  isin: string
  quantity: number
  average_price: number
  last_price: number
  close_price: number
  pnl: number
  day_change: number
  day_change_percentage: number
}

/* ─── Email builder ─────────────────────────────────────────────────────── */

function buildEmailHtml(
  holdings: UpstoxHolding[],
  portfolioName: string,
  runAt: string
): string {
  if (!holdings.length) {
    return `<p>No holdings found in your portfolio today (${runAt}).</p>`
  }

  const totalInvested = holdings.reduce((s, h) => s + h.quantity * h.average_price, 0)
  const totalValue    = holdings.reduce((s, h) => s + h.quantity * h.last_price, 0)
  const totalPnL      = holdings.reduce((s, h) => s + h.pnl, 0)
  const pnlPct        = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const pnlColor      = totalPnL >= 0 ? "#16a34a" : "#dc2626"

  const sorted    = [...holdings].sort((a, b) => b.pnl - a.pnl)
  const topGainers = sorted.slice(0, 5).filter((h) => h.pnl > 0)
  const topLosers  = [...holdings].sort((a, b) => a.pnl - b.pnl).slice(0, 5).filter((h) => h.pnl < 0)

  const rowStyle = "padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;"
  const thStyle  = "padding:8px 12px;background:#f9fafb;font-size:12px;color:#6b7280;text-align:left;font-weight:600;"

  const holdingRows = sorted
    .map((h) => {
      const pnlStr = `${h.pnl >= 0 ? "+" : ""}₹${Math.round(h.pnl)}`
      const color  = h.pnl >= 0 ? "#16a34a" : "#dc2626"
      const dayStr = `${h.day_change_percentage >= 0 ? "+" : ""}${h.day_change_percentage.toFixed(2)}%`
      return `<tr>
        <td style="${rowStyle}"><b>${h.trading_symbol}</b><br><span style="color:#9ca3af;font-size:11px;">${h.company_name}</span></td>
        <td style="${rowStyle}text-align:right;">${h.quantity}</td>
        <td style="${rowStyle}text-align:right;">₹${h.average_price.toFixed(1)}</td>
        <td style="${rowStyle}text-align:right;">₹${h.last_price.toFixed(1)}</td>
        <td style="${rowStyle}text-align:right;color:${color};font-weight:600;">${pnlStr}</td>
        <td style="${rowStyle}text-align:right;color:${color};">${dayStr}</td>
      </tr>`
    }).join("")

  const gainersHtml = topGainers.length
    ? topGainers.map((h) => `<li><b>${h.trading_symbol}</b> +₹${Math.round(h.pnl)} (+${((h.pnl / (h.quantity * h.average_price)) * 100).toFixed(1)}%)</li>`).join("")
    : "<li>None</li>"

  const losersHtml = topLosers.length
    ? topLosers.map((h) => `<li><b>${h.trading_symbol}</b> ₹${Math.round(h.pnl)} (${((h.pnl / (h.quantity * h.average_price)) * 100).toFixed(1)}%)</li>`).join("")
    : "<li>None</li>"

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>InvestBuddy AI Daily Briefing</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0f172a;padding:24px 28px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">📊 InvestBuddy AI Daily Briefing</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${runAt} IST &nbsp;·&nbsp; ${portfolioName}</p>
    </div>

    <!-- P&L Summary -->
    <div style="padding:20px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;gap:24px;">
      <div>
        <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Invested</div>
        <div style="font-size:22px;font-weight:700;color:#0f172a;">₹${(totalInvested / 100000).toFixed(2)}L</div>
      </div>
      <div>
        <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Current Value</div>
        <div style="font-size:22px;font-weight:700;color:#0f172a;">₹${(totalValue / 100000).toFixed(2)}L</div>
      </div>
      <div>
        <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Total P&amp;L</div>
        <div style="font-size:22px;font-weight:700;color:${pnlColor};">${totalPnL >= 0 ? "+" : ""}₹${Math.round(totalPnL)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)</div>
      </div>
    </div>

    <!-- Top Movers -->
    <div style="padding:20px 28px;border-bottom:1px solid #f3f4f6;">
      <div style="display:flex;gap:32px;">
        <div style="flex:1;">
          <h3 style="margin:0 0 8px;font-size:13px;color:#16a34a;font-weight:600;">▲ Top Gainers</h3>
          <ul style="margin:0;padding-left:16px;font-size:13px;line-height:1.8;">${gainersHtml}</ul>
        </div>
        <div style="flex:1;">
          <h3 style="margin:0 0 8px;font-size:13px;color:#dc2626;font-weight:600;">▼ Top Losers</h3>
          <ul style="margin:0;padding-left:16px;font-size:13px;line-height:1.8;">${losersHtml}</ul>
        </div>
      </div>
    </div>

    <!-- Full Holdings Table -->
    <div style="padding:20px 28px 0;">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a;">All Holdings (${holdings.length} stocks)</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${thStyle}">Symbol</th>
            <th style="${thStyle}text-align:right;">Qty</th>
            <th style="${thStyle}text-align:right;">Avg</th>
            <th style="${thStyle}text-align:right;">LTP</th>
            <th style="${thStyle}text-align:right;">P&amp;L</th>
            <th style="${thStyle}text-align:right;">Day%</th>
          </tr>
        </thead>
        <tbody>${holdingRows}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;font-size:11px;color:#9ca3af;border-top:1px solid #f3f4f6;margin-top:16px;">
      This is an automated daily briefing from InvestBuddy AI. Data sourced from your connected broker. Not financial advice.
      <br>View live dashboard → <a href="https://investbuddyai.com/dashboard" style="color:#6366f1;">investbuddyai.com</a>
    </div>
  </div>
</body>
</html>`
}

/* ─── Send email via Brevo ──────────────────────────────────────────────── */

async function sendBrevoEmail(
  toEmail: string,
  toName: string,
  subject: string,
  htmlContent: string,
  brevoKey: string
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify({
      sender: { name: "InvestBuddy AI", email: "noreply@brokerai.rudz.in" },
      to: [{ email: toEmail, name: toName }],
      subject,
      htmlContent,
    }),
  })
  return { ok: res.ok, status: res.status }
}

/* ─── Main handler ──────────────────────────────────────────────────────── */

serve(async (req) => {
  const runAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  console.log(`[daily-sync] Invoked at ${runAt} IST`)

  // Auth check — bearer must be the service role key (set by pg_cron)
  const authHeader = req.headers.get("Authorization") ?? ""
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  if (!serviceKey) {
    console.error("[daily-sync] SUPABASE_SERVICE_ROLE_KEY not set")
    return new Response(JSON.stringify({ error: "Misconfigured" }), { status: 500 })
  }
  if (authHeader && authHeader !== `Bearer ${serviceKey}`) {
    console.error("[daily-sync] Rejected — wrong bearer token")
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
  }

  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? ""

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
    )

    /* ── 1. Read all user settings — get per-user Upstox tokens ──────── */
    console.log("[daily-sync] Reading user settings…")
    const { data: allSettings, error: settingsErr } = await supabaseAdmin
      .from("user_settings")
      .select("user_id, preferences")

    if (settingsErr) throw new Error(`user_settings read failed: ${settingsErr.message}`)

    // Collect only users who have connected Upstox via OAuth
    const usersToSync: { userId: string; token: string }[] = []
    for (const row of allSettings ?? []) {
      const prefs = (row.preferences as Record<string, string>) || {}
      const token = prefs.upstox_access_token
      if (token) {
        usersToSync.push({ userId: row.user_id as string, token })
      }
    }

    if (usersToSync.length === 0) {
      console.log("[daily-sync] No users have connected Upstox — nothing to sync")
      return new Response(
        JSON.stringify({ status: "ok", message: "No users with Upstox connected", synced: 0, skipped: (allSettings ?? []).length }),
        { headers: { "Content-Type": "application/json" } }
      )
    }
    console.log(`[daily-sync] ${usersToSync.length} user(s) with Upstox token to sync`)

    /* ── 2. Sync each user ────────────────────────────────────────────── */
    let totalUpserted = 0
    let emailsSent    = 0
    let errored       = 0

    for (const { userId, token } of usersToSync) {
      console.log(`[daily-sync] Syncing user ${userId}…`)

      // 2a. Fetch live holdings from Upstox using this user's OAuth token
      const holdingsRes = await fetch(`${UPSTOX_BASE_URL}/portfolio/long-term-holdings`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      })

      if (!holdingsRes.ok) {
        const body = await holdingsRes.json().catch(() => ({}))
        console.error(`[daily-sync] Upstox error for user ${userId}: ${holdingsRes.status}`, JSON.stringify(body))
        // Token may be expired — don't crash the whole run, just skip this user
        errored++
        continue
      }

      const holdingsData  = await holdingsRes.json()
      const upstoxHoldings: UpstoxHolding[] = holdingsData.data ?? []
      console.log(`[daily-sync] Got ${upstoxHoldings.length} holdings for user ${userId}`)

      if (upstoxHoldings.length === 0) {
        console.log(`[daily-sync] No holdings for user ${userId} — skipping`)
        continue
      }

      // 2b. Ensure portfolio row exists
      let portfolioId: string | null = null
      let portfolioName = "My Portfolio"

      const { data: existingPort } = await supabaseAdmin
        .from("portfolios")
        .select("id, name")
        .eq("user_id", userId)
        .maybeSingle()

      if (existingPort) {
        portfolioId   = existingPort.id
        portfolioName = (existingPort as Record<string, string>).name || portfolioName
      } else {
        const { data: newPort, error: portErr } = await supabaseAdmin
          .from("portfolios")
          .insert({ user_id: userId, source: "upstox", fetched_at: new Date().toISOString() })
          .select("id")
          .single()
        if (portErr) {
          console.error(`[daily-sync] Could not create portfolio for user ${userId}: ${portErr.message}`)
          errored++
          continue
        }
        portfolioId = newPort.id
      }

      // Update portfolio fetch timestamp
      await supabaseAdmin
        .from("portfolios")
        .update({ fetched_at: new Date().toISOString() })
        .eq("id", portfolioId)

      // 2c. Preserve user-set segments
      const { data: existingRows } = await supabaseAdmin
        .from("holdings")
        .select("instrument_key, segment")
        .eq("portfolio_id", portfolioId)

      const userSegments: Record<string, string> = {}
      for (const r of existingRows ?? []) {
        if (r.segment && r.segment !== "Equity") {
          userSegments[r.instrument_key as string] = r.segment as string
        }
      }

      // 2d. Upsert holdings
      const rows = upstoxHoldings.map((h) => ({
        portfolio_id:    portfolioId,
        instrument_key:  h.trading_symbol,
        company_name:    h.company_name,
        exchange:        h.exchange,
        isin:            h.isin,
        // Respect user-set segment; default to exchange-based
        segment:         userSegments[h.trading_symbol] ?? (h.exchange === "NSE" || h.exchange === "BSE" ? "Equity" : h.exchange),
        quantity:        h.quantity,
        avg_price:       h.average_price,
        ltp:             h.last_price,
        close_price:     h.close_price,
        invested_amount: h.quantity * h.average_price,
        current_value:   h.quantity * h.last_price,
        unrealized_pl:   h.pnl,
        day_change:      h.day_change,
        day_change_pct:  h.day_change_percentage,
        // Store raw fields needed by the frontend (trading_symbol, day_change_percentage, etc.)
        raw: {
          trading_symbol:        h.trading_symbol,
          company_name:          h.company_name,
          exchange:              h.exchange,
          day_change_percentage: h.day_change_percentage,
        },
        updated_at: new Date().toISOString(),
      }))

      const { error: upsertErr } = await supabaseAdmin
        .from("holdings")
        .upsert(rows, { onConflict: "portfolio_id,instrument_key" })

      if (upsertErr) {
        console.error(`[daily-sync] Upsert failed for user ${userId}: ${upsertErr.message}`)
        errored++
        continue
      }

      totalUpserted += rows.length
      console.log(`[daily-sync] Upserted ${rows.length} holdings for user ${userId}`)

      // 2e. Send email digest via Brevo
      if (brevoKey) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
        const email = authUser?.user?.email
        const name  = (authUser?.user?.user_metadata?.full_name as string) || email || "Investor"
        if (email) {
          const totalPnL = upstoxHoldings.reduce((s, h) => s + h.pnl, 0)
          const pnlSign  = totalPnL >= 0 ? "+" : ""
          const subject  = `📊 InvestBuddy AI Morning Briefing — ${pnlSign}₹${Math.round(totalPnL)} today`
          const html     = buildEmailHtml(upstoxHoldings, portfolioName, runAt)
          const emailRes = await sendBrevoEmail(email, name, subject, html, brevoKey)
          if (emailRes.ok) {
            emailsSent++
            console.log(`[daily-sync] Email sent to ${email}`)
          } else {
            console.error(`[daily-sync] Email failed for ${email}: HTTP ${emailRes.status}`)
          }
        }
      }
    }

    /* ── 3. Log sync event ────────────────────────────────────────────── */
    await supabaseAdmin.from("analysis_reports").insert({
      user_id:     usersToSync[0]?.userId,
      report_type: "daily_sync",
      data: {
        synced_holdings: totalUpserted,
        emails_sent:     emailsSent,
        users_synced:    usersToSync.length - errored,
        users_errored:   errored,
        run_at:          new Date().toISOString(),
      },
    }).catch((e: unknown) => console.warn("[daily-sync] analysis_reports insert skipped:", e))

    const summary = `Synced ${totalUpserted} holdings for ${usersToSync.length - errored} user(s). Errors: ${errored}. Emails: ${emailsSent}.`
    console.log(`[daily-sync] Complete — ${summary}`)

    return new Response(
      JSON.stringify({
        status:       "success",
        synced:       totalUpserted,
        users:        usersToSync.length,
        errored,
        emails_sent:  emailsSent,
        message:      summary,
      }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[daily-sync] Unhandled error:", message)
    return new Response(
      JSON.stringify({ status: "error", error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

