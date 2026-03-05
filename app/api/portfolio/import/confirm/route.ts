/**
 * POST /api/portfolio/import/confirm
 *
 * Accepts the file again + confirmed column mapping + broker.
 * Parses, maps, and inserts holdings into a new portfolio.
 *
 * Body (multipart form):
 *   - file: the holdings file
 *   - broker: broker ID
 *   - mapping: JSON stringified { isin: "ColName", quantity: "ColName", ... }
 *   - portfolioName: optional name for the portfolio
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import { BROKER_FORMATS } from "@/lib/import/broker-formats"
import { parseXlsx, parseCsv, parsePdf, applyMapping } from "@/lib/import/parser"
import { recordPortfolioSnapshot } from "@/lib/portfolio-snapshot"

const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
  // ── Auth ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Parse form ──
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const brokerId = (formData.get("broker") as string) || "other"
  const mappingJson = formData.get("mapping") as string
  const portfolioName = (formData.get("portfolioName") as string) || null

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 400 })
  }
  if (!mappingJson) {
    return NextResponse.json({ error: "Column mapping is required" }, { status: 400 })
  }

  let columnMapping: Record<string, string>
  try {
    columnMapping = JSON.parse(mappingJson)
  } catch {
    return NextResponse.json({ error: "Invalid mapping format" }, { status: 400 })
  }

  // Must have at least quantity and one identifier column
  if (!columnMapping.quantity) {
    return NextResponse.json({ error: "Quantity column mapping is required" }, { status: 400 })
  }
  if (!columnMapping.company_name && !columnMapping.isin && !columnMapping.trading_symbol) {
    return NextResponse.json({ error: "At least one identifier column (ISIN, Company Name, or Symbol) is required" }, { status: 400 })
  }

  const format = BROKER_FORMATS[brokerId] || BROKER_FORMATS.other
  const admin = await createAdminClient()

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.toLowerCase().split(".").pop() || ""

    let parsed
    if (ext === "xlsx" || ext === "xls") {
      parsed = parseXlsx(buffer, format)
    } else if (ext === "csv") {
      parsed = parseCsv(buffer.toString("utf-8"))
    } else if (ext === "pdf") {
      parsed = await parsePdf(buffer)
    } else {
      return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 400 })
    }

    // Apply column mapping to get normalized holdings
    const holdings = applyMapping(parsed.rows, columnMapping)

    if (holdings.length === 0) {
      return NextResponse.json({ error: "No valid holdings found after mapping. Check your column mapping." }, { status: 400 })
    }

    // ── Ensure user row exists (portfolios FK → users.id) ──
    await admin
      .from("users")
      .upsert({ id: user.id, email: user.email }, { onConflict: "id" })

    // ── Create portfolio row ──
    const source = `${brokerId}_import`
    const { data: portfolio, error: portfolioError } = await admin
      .from("portfolios")
      .insert({
        user_id: user.id,
        source,
        name: portfolioName || `${format.label} Import`,
        description: `Imported from ${format.label} on ${new Date().toLocaleDateString("en-IN")}`,
        meta: {
          broker: brokerId,
          file_name: file.name,
          imported_at: new Date().toISOString(),
          total_holdings: holdings.length,
        },
        fetched_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (portfolioError || !portfolio) {
      console.error("[import/confirm] Failed to create portfolio:", portfolioError)
      return NextResponse.json({ error: "Failed to create portfolio" }, { status: 500 })
    }

    // ── Upsert instruments for holdings with ISINs ──
    const instruments = holdings
      .filter((h) => h.isin)
      .map((h) => ({
        instrument_key: h.isin || h.trading_symbol || h.company_name,
        trading_symbol: h.trading_symbol || h.company_name,
        name: h.company_name,
        isin: h.isin,
        exchange: "",
        segment: "",
        metadata: {},
      }))

    if (instruments.length > 0) {
      const { error: instrError } = await admin
        .from("instruments")
        .upsert(instruments, { onConflict: "instrument_key" })
      if (instrError) {
        console.error("[import/confirm] instruments upsert error:", instrError.message)
      }
    }

    // ── Insert holdings ──
    const holdingsPayload = holdings.map((h) => ({
      portfolio_id: portfolio.id,
      instrument_key: h.isin || h.trading_symbol || h.company_name,
      trading_symbol: h.trading_symbol || h.company_name,
      company_name: h.company_name,
      quantity: h.quantity,
      avg_price: h.avg_price,
      invested_amount: h.invested_amount,
      ltp: h.ltp,
      unrealized_pl: h.unrealized_pl,
      segment: null,
      raw: null,
    }))

    const { error: holdingsError } = await admin.from("holdings").insert(holdingsPayload)
    if (holdingsError) {
      console.error("[import/confirm] holdings insert error:", holdingsError.message)
      return NextResponse.json({ error: "Failed to save holdings: " + holdingsError.message }, { status: 500 })
    }

    // ── Record portfolio snapshot ──
    await recordPortfolioSnapshot(admin, {
      portfolioId: portfolio.id,
      userId: user.id,
      holdings: holdingsPayload,
    })

    console.log(`[import] Imported ${holdings.length} holdings for user ${user.id} from ${format.label}`)

    return NextResponse.json({
      status: "success",
      portfolioId: portfolio.id,
      count: holdings.length,
      message: `${holdings.length} holdings imported from ${format.label}`,
    })
  } catch (e) {
    console.error("[import/confirm] Error:", e)
    const message = e instanceof Error ? e.message : "Failed to import holdings"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
