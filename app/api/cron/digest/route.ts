import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

// ─── Signal vocabulary (no "buy" / "sell" language in user-facing copy) ──────
type ConsensusSignal = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
type AnySignal = ConsensusSignal | "WATCH"

const SIG_LABEL: Record<AnySignal, string> = {
  STRONG_BUY: "High Opportunity",
  BUY:        "Opportunity",
  HOLD:       "Neutral",
  SELL:       "Review",
  STRONG_SELL:"High Review",
  WATCH:      "Monitor",
}
const SIG_TEXT: Record<AnySignal, string> = {
  STRONG_BUY: "#059669", BUY: "#059669",
  HOLD: "#2563eb",
  SELL: "#dc2626", STRONG_SELL: "#dc2626",
  WATCH: "#d97706",
}
const SIG_BG: Record<AnySignal, string> = {
  STRONG_BUY: "#d1fae5", BUY: "#d1fae5",
  HOLD: "#dbeafe",
  SELL: "#fee2e2", STRONG_SELL: "#fee2e2",
  WATCH: "#fef3c7",
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n)
}
function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`
}
function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * POST /api/cron/digest
 * Service-role-protected endpoint called by the Netlify scheduled function.
 * Sends enriched portfolio digest emails to every user who has
 * notif_daily_digest = "true" and whose preferred IST hour matches now.
 *
 * Email sections:
 *   1. Portfolio snapshot (Invested / Current Value / Unrealised P&L)
 *   2. Signal summary pills  (Opportunity / Neutral / Review counts)
 *   3. Portfolio Signals table  (top 10 holdings with advisory consensus)
 *   4. New Research Coverage  (advisory_recommendations scraped in last 48 h)
 *   5. Portfolio Movers  (top performers & underperformers)
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

  // Platform Brevo key — digest emails are always sent via the platform account
  const brevoKey = process.env.BREVO_API_KEY ?? ""
  if (!brevoKey) {
    return NextResponse.json({ error: "BREVO_API_KEY is not configured in environment variables" }, { status: 500 })
  }

  // Fetch all user_settings rows where notif_daily_digest = "true"
  const { data: settingsRows, error: sErr } = await supabase
    .from("user_settings")
    .select("user_id, preferences")

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  // Current IST time (IST = UTC + 5:30 → shift by 330 minutes)
  const nowUTC = new Date()
  const nowIST = new Date(nowUTC.getTime() + 330 * 60 * 1000)
  const currentISTHour   = nowIST.getUTCHours()
  const currentISTMinute = nowIST.getUTCMinutes()

  // Allow caller to bypass the time check (e.g. manual/test invocations)
  let skipTimeCheck = false
  try {
    const body = await req.json().catch(() => ({}))
    skipTimeCheck = body?.skip_time_check === true
  } catch { /* ignore parse errors */ }

  const eligible = (settingsRows ?? []).filter((row) => {
    const prefs = (row.preferences as Record<string, unknown>) || {}
    // Accept both string "true" (from fixed POST handler) and boolean true
    // (from older saves before the coercion fix was deployed).
    const digestEnabled = prefs.notif_daily_digest === "true" || prefs.notif_daily_digest === true
    if (!digestEnabled) return false

    if (skipTimeCheck) return true

    // Support up to 3 delivery slots; fall back to legacy single slot
    const slots: string[] = Array.isArray(prefs.digest_send_time_slots)
      ? (prefs.digest_send_time_slots as string[])
      : [(prefs.digest_send_time as string) || "10:00"]
    // Match both hour and minute so each 15-min slot fires exactly once
    return slots.some((t) => {
      const [h, m] = t.split(":")
      return parseInt(h, 10) === currentISTHour && parseInt(m, 10) === currentISTMinute
    })
  })

  if (eligible.length === 0) {
    return NextResponse.json({ status: "ok", message: "No users with digest enabled", sent: 0 })
  }

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of eligible) {
    const prefs = (row.preferences as Record<string, string>) || {}

    // Resolve recipient email
    const emailList = (prefs.notification_emails || "")
      .split(",")
      .map((e: string) => e.trim())
      .filter(Boolean)

    let toEmail = emailList[0] || ""
    if (!toEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id)
      toEmail = authUser?.user?.email ?? ""
    }
    if (!toEmail) {
      console.warn(`[digest] Skipping user ${row.user_id} — no email address found`)
      skipped++
      continue
    }

    // Portfolio
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", row.user_id)
      .single()

    if (!portfolio) {
      console.warn(`[digest] Skipping user ${row.user_id} — no portfolio found`)
      skipped++
      continue
    }

    const { data: holdings } = await supabase
      .from("holdings")
      .select("instrument_key, company_name, trading_symbol, invested_amount, unrealized_pl, quantity, avg_price, ltp")
      .eq("portfolio_id", portfolio.id)
      .not("instrument_key", "eq", "Total")

    const holdingRows = holdings ?? []
    const activeHoldings = holdingRows.filter((h) => (h.quantity as number) > 0)
    const tradingSymbols = activeHoldings
      .map((h) => h.trading_symbol as string)
      .filter(Boolean)

    // ── Portfolio KPIs ─────────────────────────────────────────────────────
    const totalInvested = holdingRows.reduce((s, h) => s + ((h.invested_amount as number) || 0), 0)
    const totalPnL      = holdingRows.reduce((s, h) => s + ((h.unrealized_pl  as number) || 0), 0)
    const currentValue  = totalInvested + totalPnL
    const pnlPct        = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
    const count         = activeHoldings.length

    // ── Advisory data (parallel) ───────────────────────────────────────────
    const today            = nowIST.toISOString().slice(0, 10)
    const fortyEightHoursAgo = new Date(nowUTC.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo       = new Date(nowUTC.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()

    let consensusRows: Array<{
      trading_symbol: string
      buy_count: number
      sell_count: number
      hold_count: number
      total_sources: number
      weighted_score: number
      consensus_signal: string
    }> = []

    let recentRecs: Array<{
      trading_symbol: string
      signal: string
      target_price: number | null
      rationale: string | null
      scraped_at: string
      advisory_sources: { name: string; tier: number } | null
    }> = []

    if (tradingSymbols.length > 0) {
      const [consensusRes, recsRes] = await Promise.all([
        supabase
          .from("advisory_consensus")
          .select("trading_symbol, buy_count, sell_count, hold_count, total_sources, weighted_score, consensus_signal")
          .eq("consensus_date", today)
          .in("trading_symbol", tradingSymbols),
        supabase
          .from("advisory_recommendations")
          .select("trading_symbol, signal, target_price, rationale, scraped_at, advisory_sources(name, tier)")
          .in("trading_symbol", tradingSymbols)
          .gte("scraped_at", sevenDaysAgo)
          .order("scraped_at", { ascending: false })
          .limit(200),
      ])
      consensusRows = (consensusRes.data ?? []) as typeof consensusRows
      recentRecs    = (recsRes.data    ?? []) as unknown as typeof recentRecs
    }

    // ── Build lookup maps ──────────────────────────────────────────────────
    const consensusMap = new Map(consensusRows.map((c) => [c.trading_symbol, c]))

    // Best (highest) analyst target price per symbol within last 7 days
    const targetPriceMap = new Map<string, number>()
    for (const rec of recentRecs) {
      if (rec.target_price) {
        const prev = targetPriceMap.get(rec.trading_symbol)
        if (!prev || rec.target_price > prev) targetPriceMap.set(rec.trading_symbol, rec.target_price)
      }
    }

    // New research alerts last 48 h — one entry per symbol+source pair
    const seen48h = new Set<string>()
    const newAlerts: typeof recentRecs = []
    for (const rec of recentRecs) {
      if (rec.scraped_at < fortyEightHoursAgo) continue
      const key = `${rec.trading_symbol}::${rec.advisory_sources?.name ?? "?"}`
      if (!seen48h.has(key)) {
        seen48h.add(key)
        newAlerts.push(rec)
      }
    }

    // ── Enrich holdings ────────────────────────────────────────────────────
    type EnrichedHolding = {
      symbol: string
      name: string
      pnl: number
      pnlPct: number
      ltp: number
      quantity: number
      signal: AnySignal
      totalSources: number
      targetPrice: number | null
    }

    const displayName = (h: { company_name?: unknown; trading_symbol?: unknown; instrument_key: unknown }) => {
      if (h.company_name) return String(h.company_name)
      if (h.trading_symbol) return String(h.trading_symbol)
      const raw = String(h.instrument_key || "")
      return raw.includes("|") ? raw.split("|")[1] : raw
    }

    const enriched: EnrichedHolding[] = activeHoldings.map((h) => {
      const sym      = String(h.trading_symbol || "")
      const pnl      = (h.unrealized_pl  as number) || 0
      const invested = (h.invested_amount as number) || 0
      const consensus = consensusMap.get(sym)
      return {
        symbol:       sym,
        name:         displayName(h),
        pnl,
        pnlPct:       invested > 0 ? (pnl / invested) * 100 : 0,
        ltp:          (h.ltp as number) || 0,
        quantity:     (h.quantity as number) || 0,
        signal:       (consensus?.consensus_signal as ConsensusSignal) ?? "WATCH",
        totalSources: consensus?.total_sources ?? 0,
        targetPrice:  targetPriceMap.get(sym) ?? null,
      }
    })

    // Sort: Opportunity → Review → Neutral → Monitor; within group by source count
    const sigOrder: Record<string, number> = {
      STRONG_BUY: 0, BUY: 1, STRONG_SELL: 2, SELL: 3, HOLD: 4, WATCH: 5,
    }
    enriched.sort((a, b) => {
      const d = (sigOrder[a.signal] ?? 5) - (sigOrder[b.signal] ?? 5)
      return d !== 0 ? d : b.totalSources - a.totalSources
    })

    // Summary counts for pills
    const oppCount  = enriched.filter((h) => h.signal === "BUY"  || h.signal === "STRONG_BUY").length
    const revCount  = enriched.filter((h) => h.signal === "SELL" || h.signal === "STRONG_SELL").length
    const neutCount = enriched.filter((h) => h.signal === "HOLD").length

    // Top movers
    const byPnL     = [...activeHoldings].sort((a, b) => ((b.unrealized_pl as number) || 0) - ((a.unrealized_pl as number) || 0))
    const topGainers = byPnL.slice(0, 3).filter((h) => ((h.unrealized_pl as number) || 0) > 0)
    const topLosers  = byPnL.slice(-3).reverse().filter((h) => ((h.unrealized_pl as number) || 0) < 0)

    // ── Display strings ────────────────────────────────────────────────────
    const toName   = toEmail.split("@")[0]
    const pnlSign  = totalPnL >= 0 ? "+" : ""
    const pnlColor = totalPnL >= 0 ? "#059669" : "#dc2626"
    const dateStr  = nowIST.toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    })
    const timeStr = `${String(nowIST.getUTCHours()).padStart(2, "0")}:${String(nowIST.getUTCMinutes()).padStart(2, "0")} IST`

    // ── HTML: Portfolio Signals table rows (top 10) ────────────────────────
    const signalRows = enriched.slice(0, 10).map((h) => {
      const label   = SIG_LABEL[h.signal]
      const tc      = SIG_TEXT[h.signal]
      const bc      = SIG_BG[h.signal]
      const pc      = h.pnlPct >= 0 ? "#059669" : "#dc2626"
      const arrow   = h.pnlPct >= 0 ? "▲" : "▼"
      const target  = h.targetPrice
        ? `<span style="color:#6366f1;font-weight:600">${fmt(h.targetPrice)}</span>`
        : `<span style="color:#cbd5e1">—</span>`
      const sources = h.totalSources > 0
        ? `<span style="color:#7c3aed;font-weight:600">${h.totalSources}</span>`
        : `<span style="color:#cbd5e1">—</span>`
      return `
<tr style="border-bottom:1px solid #f1f5f9">
  <td style="padding:9px 8px 9px 0;font-size:13px;font-weight:700;color:#0f172a;white-space:nowrap">${esc(h.symbol)}</td>
  <td style="padding:9px 8px">
    <span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${bc};color:${tc};font-size:11px;font-weight:700;white-space:nowrap">${label}</span>
  </td>
  <td style="padding:9px 8px;font-size:13px;text-align:right;color:${pc};font-weight:600;white-space:nowrap">${arrow} ${fmtPct(h.pnlPct)}</td>
  <td style="padding:9px 8px;font-size:13px;text-align:right">${target}</td>
  <td style="padding:9px 0 9px 8px;font-size:12px;text-align:right">${sources}</td>
</tr>`
    }).join("")

    // ── HTML: New Research Coverage section ───────────────────────────────
    let alertsSection = ""
    if (newAlerts.length > 0) {
      const alertRows = newAlerts.slice(0, 8).map((r) => {
        const srcName = r.advisory_sources?.name ?? "Research Source"
        const rawSig  = r.signal || "HOLD"
        const alertLabel = rawSig === "BUY"  ? "Opportunity"
          : rawSig === "SELL" ? "Review" : "Neutral"
        const alertColor = rawSig === "BUY"  ? "#059669"
          : rawSig === "SELL" ? "#dc2626" : "#2563eb"
        const alertBg    = rawSig === "BUY"  ? "#d1fae5"
          : rawSig === "SELL" ? "#fee2e2" : "#dbeafe"
        const targetCell = r.target_price
          ? `<span style="color:#6366f1;font-weight:600">${fmt(r.target_price)}</span>`
          : `<span style="color:#cbd5e1">—</span>`
        const rationale  = r.rationale
          ? `<div style="font-size:11px;color:#64748b;margin-top:3px;line-height:1.4">${esc(r.rationale.slice(0, 100))}${r.rationale.length > 100 ? "…" : ""}</div>`
          : ""
        return `
<tr style="border-bottom:1px solid #f1f5f9">
  <td style="padding:9px 8px 9px 0;vertical-align:top;white-space:nowrap">
    <div style="font-size:13px;font-weight:700;color:#0f172a">${esc(r.trading_symbol)}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:2px">${esc(srcName)}</div>
  </td>
  <td style="padding:9px 8px;vertical-align:top">
    <span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${alertBg};color:${alertColor};font-size:11px;font-weight:700">${alertLabel}</span>${rationale}
  </td>
  <td style="padding:9px 0 9px 8px;text-align:right;vertical-align:top;white-space:nowrap">${targetCell}</td>
</tr>`
      }).join("")

      alertsSection = `
  <!-- NEW RESEARCH COVERAGE -->
  <tr>
    <td style="padding:0 32px 24px;background:#fff">
      <div style="border-top:1px solid #f1f5f9;padding-top:20px">
        <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#0f172a">
          📰 New Research Coverage
          <span style="margin-left:6px;padding:2px 10px;border-radius:20px;background:#fef3c7;color:#d97706;font-size:11px;font-weight:700">${newAlerts.length} update${newAlerts.length > 1 ? "s" : ""} · last 48 h</span>
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:7px 8px 7px 0;text-align:left;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Stock &amp; Source</th>
              <th style="padding:7px 8px;text-align:left;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">View &amp; Rationale</th>
              <th style="padding:7px 0 7px 8px;text-align:right;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Target</th>
            </tr>
          </thead>
          <tbody>${alertRows}</tbody>
        </table>
      </div>
    </td>
  </tr>`
    }

    // ── HTML: Portfolio Movers section ────────────────────────────────────
    const gainersRows = topGainers.map((h) => {
      const inv = (h.invested_amount as number) || 0
      const pnl = (h.unrealized_pl  as number) || 0
      const p   = inv > 0 ? (pnl / inv) * 100 : 0
      return `
<tr style="border-bottom:1px solid #f0fdf4">
  <td style="padding:7px 6px 7px 0;font-size:12px;color:#0f172a">${esc(displayName(h))}</td>
  <td style="padding:7px 0;text-align:right;font-size:12px;font-weight:700;color:#059669;white-space:nowrap">+${fmt(pnl)}</td>
  <td style="padding:7px 0 7px 6px;text-align:right;font-size:11px;color:#059669;white-space:nowrap">+${p.toFixed(1)}%</td>
</tr>`
    }).join("")

    const losersRows = topLosers.map((h) => {
      const inv = (h.invested_amount as number) || 0
      const pnl = (h.unrealized_pl  as number) || 0
      const p   = inv > 0 ? (pnl / inv) * 100 : 0
      return `
<tr style="border-bottom:1px solid #fff1f2">
  <td style="padding:7px 6px 7px 0;font-size:12px;color:#0f172a">${esc(displayName(h))}</td>
  <td style="padding:7px 0;text-align:right;font-size:12px;font-weight:700;color:#dc2626;white-space:nowrap">${fmt(pnl)}</td>
  <td style="padding:7px 0 7px 6px;text-align:right;font-size:11px;color:#dc2626;white-space:nowrap">${p.toFixed(1)}%</td>
</tr>`
    }).join("")

    let moversSection = ""
    if (topGainers.length > 0 || topLosers.length > 0) {
      moversSection = `
  <!-- PORTFOLIO MOVERS -->
  <tr>
    <td style="padding:0 32px 24px;background:#fff">
      <div style="border-top:1px solid #f1f5f9;padding-top:20px">
        <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#0f172a">📈 Portfolio Movers</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${topGainers.length > 0 ? `
            <td width="${topLosers.length > 0 ? "48%" : "100%"}" valign="top">
              <div style="font-size:10px;font-weight:700;color:#059669;margin-bottom:8px;letter-spacing:0.5px;text-transform:uppercase">▲ Top Performers</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tbody>${gainersRows}</tbody></table>
            </td>` : ""}
            ${topGainers.length > 0 && topLosers.length > 0 ? `<td width="4%"></td>` : ""}
            ${topLosers.length > 0 ? `
            <td width="${topGainers.length > 0 ? "48%" : "100%"}" valign="top">
              <div style="font-size:10px;font-weight:700;color:#dc2626;margin-bottom:8px;letter-spacing:0.5px;text-transform:uppercase">▼ Underperformers</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tbody>${losersRows}</tbody></table>
            </td>` : ""}
          </tr>
        </table>
      </div>
    </td>
  </tr>`
    }

    // ── HTML: Signal summary pills ─────────────────────────────────────────
    const pillsSection = (oppCount > 0 || revCount > 0 || neutCount > 0) ? `
  <!-- SIGNAL SUMMARY PILLS -->
  <tr>
    <td style="padding:0 32px 20px;background:#fff">
      <table cellpadding="0" cellspacing="4"><tr>
        ${oppCount  > 0 ? `<td><span style="display:inline-block;padding:4px 14px;border-radius:20px;background:#d1fae5;color:#059669;font-size:12px;font-weight:700">${oppCount} Opportunity</span></td>` : ""}
        ${neutCount > 0 ? `<td><span style="display:inline-block;padding:4px 14px;border-radius:20px;background:#dbeafe;color:#2563eb;font-size:12px;font-weight:700">${neutCount} Neutral</span></td>` : ""}
        ${revCount  > 0 ? `<td><span style="display:inline-block;padding:4px 14px;border-radius:20px;background:#fee2e2;color:#dc2626;font-size:12px;font-weight:700">${revCount} Under Review</span></td>` : ""}
      </tr></table>
    </td>
  </tr>` : ""

    // ── Assemble full email HTML ───────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Portfolio Digest — InvestBuddy AI</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">
<tr><td align="center" style="padding:24px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.09)">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:28px 32px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:4px">InvestBuddy AI</div>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.2px">Portfolio Digest</h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.7)">Hi ${esc(toName)} &nbsp;·&nbsp; ${dateStr} &nbsp;·&nbsp; ${timeStr}</p>
        </td>
        <td align="right" valign="middle">
          <div style="background:rgba(255,255,255,.13);border-radius:8px;padding:10px 16px;text-align:center;min-width:56px">
            <div style="font-size:10px;color:rgba(255,255,255,.55);margin-bottom:3px;letter-spacing:0.5px">Holdings</div>
            <div style="font-size:26px;font-weight:700;color:#fff;line-height:1">${count}</div>
          </div>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- PORTFOLIO KPI STRIP -->
  <tr>
    <td style="padding:20px 32px 16px;background:#fff">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="33%" style="padding-right:8px">
          <div style="background:#f8fafc;border-radius:8px;padding:14px 12px">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Invested</div>
            <div style="font-size:17px;font-weight:700;color:#0f172a">${fmt(totalInvested)}</div>
          </div>
        </td>
        <td width="33%" style="padding:0 4px">
          <div style="background:#f8fafc;border-radius:8px;padding:14px 12px">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Current Value</div>
            <div style="font-size:17px;font-weight:700;color:#0f172a">${fmt(currentValue)}</div>
          </div>
        </td>
        <td width="34%" style="padding-left:8px">
          <div style="background:#f8fafc;border-radius:8px;padding:14px 12px">
            <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Unrealised P&amp;L</div>
            <div style="font-size:17px;font-weight:700;color:${pnlColor}">${pnlSign}${fmt(totalPnL)}</div>
            <div style="font-size:11px;color:${pnlColor};margin-top:2px">${pnlSign}${pnlPct.toFixed(2)}%</div>
          </div>
        </td>
      </tr></table>
    </td>
  </tr>

  ${pillsSection}

  ${enriched.length > 0 ? `
  <!-- PORTFOLIO SIGNALS TABLE -->
  <tr>
    <td style="padding:0 32px 24px;background:#fff">
      <div style="border-top:1px solid #f1f5f9;padding-top:20px">
        <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#0f172a">📊 Portfolio Signals</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
              <th style="padding:8px 8px 8px 0;text-align:left;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Symbol</th>
              <th style="padding:8px;text-align:left;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Signal</th>
              <th style="padding:8px;text-align:right;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Return</th>
              <th style="padding:8px;text-align:right;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Analyst Target</th>
              <th style="padding:8px 0 8px 8px;text-align:right;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Sources</th>
            </tr>
          </thead>
          <tbody>${signalRows}</tbody>
        </table>
        <p style="margin:8px 0 0;font-size:10px;color:#cbd5e1">Signals derived from advisory consensus. Not investment advice.</p>
      </div>
    </td>
  </tr>` : ""}

  ${alertsSection}

  ${moversSection}

  <!-- FOOTER -->
  <tr>
    <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle">
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5">${count} active holdings &nbsp;·&nbsp; ${timeStr}</p>
          <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;line-height:1.5">For informational purposes only. Not investment advice.<br>Consult a SEBI-registered Investment Adviser before acting on any signal.</p>
        </td>
        <td align="right" valign="middle" style="padding-left:16px;white-space:nowrap">
          <a href="https://investbuddyai.com/dashboard" style="display:inline-block;padding:9px 20px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">Open Dashboard →</a>
        </td>
      </tr></table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`

    const subject = `Digest ${dateStr}: ${pnlSign}${fmt(totalPnL)} (${pnlSign}${pnlPct.toFixed(2)}%)${newAlerts.length > 0 ? ` · ${newAlerts.length} new research` : ""}`

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
        try {
          await supabase.from("analysis_reports").insert({
            user_id: row.user_id,
            instrument_key: "daily_digest",
            report: { sent_to: toEmail, sent_at: new Date().toISOString() },
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
