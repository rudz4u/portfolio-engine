import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { createClient } from "@/lib/supabase/server"
import { gunzipSync } from "zlib"

const CDN_URLS: Record<string, string> = {
  NSE: "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz",
  BSE: "https://assets.upstox.com/market-quote/instruments/exchange/BSE.json.gz",
}

interface UpstoxInstrument {
  instrument_key:  string
  trading_symbol:  string
  short_name?:     string
  name?:           string
  exchange:        string
  isin?:           string
  segment?:        string
  instrument_type?: string
  lot_size?:       number
  tick_size?:      number
  metadata?:       Record<string, unknown>
}

/**
 * POST /api/instruments/seed
 *
 * Downloads NSE + BSE equity instrument master from Upstox CDN and upserts
 * into the instruments table. Protected — must be authenticated.
 * Only seeds EQ (equity) instruments, not derivatives.
 *
 * Run once, or re-run to refresh names/symbols.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = await createAdminClient()
  const summary: Record<string, number> = {}
  const errors: string[] = []

  for (const [exchange, url] of Object.entries(CDN_URLS)) {
    try {
      console.log(`[seed] Downloading instruments for ${exchange}...`)
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) {
        errors.push(`${exchange}: HTTP ${res.status}`)
        continue
      }

      const buf         = Buffer.from(await res.arrayBuffer())
      const decompressed = gunzipSync(buf)
      const instruments  = JSON.parse(decompressed.toString("utf-8")) as UpstoxInstrument[]

      // Filter to equity only
      const equityOnly = instruments.filter(
        (i) => (i.segment?.includes("EQ") || i.instrument_type === "EQ") &&
                i.instrument_key && i.trading_symbol
      )

      const BATCH = 500
      let count = 0
      for (let i = 0; i < equityOnly.length; i += BATCH) {
        const batch = equityOnly.slice(i, i + BATCH).map((inst) => ({
          instrument_key: inst.instrument_key,
          trading_symbol: inst.trading_symbol,
          name:           inst.name || inst.short_name || inst.trading_symbol,
          short_name:     inst.short_name || inst.trading_symbol,
          exchange:       inst.exchange || exchange,
          isin:           inst.isin || null,
          segment:        inst.segment || `${exchange}_EQ`,
          lot_size:       inst.lot_size || 1,
          metadata:       {
            tick_size:       inst.tick_size,
            instrument_type: inst.instrument_type,
          },
        }))

        const { error } = await admin
          .from("instruments")
          .upsert(batch, { onConflict: "instrument_key" })

        if (error) {
          console.error(`[seed] Batch upsert error (${exchange}):`, error.message)
          errors.push(`${exchange} batch ${i / BATCH}: ${error.message}`)
        } else {
          count += batch.length
        }
      }

      summary[exchange] = count
      console.log(`[seed] ${exchange}: ${count} equity instruments upserted`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[seed] Failed for ${exchange}:`, msg)
      errors.push(`${exchange}: ${msg}`)
    }
  }

  return NextResponse.json({
    status: errors.length === 0 ? "success" : "partial",
    summary,
    errors: errors.length > 0 ? errors : undefined,
    total: Object.values(summary).reduce((a, b) => a + b, 0),
  })
}

/**
 * GET /api/instruments/seed
 * Returns the count of instruments currently in the table.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = await createAdminClient()
  const { count } = await admin
    .from("instruments")
    .select("*", { count: "exact", head: true })

  return NextResponse.json({ count: count ?? 0, seeded: (count ?? 0) > 0 })
}
