/**
 * POST /api/portfolio/import/parse
 *
 * Accepts a multipart form upload (file + broker ID).
 * Parses the file and returns:
 *   - headers (column names found)
 *   - preview rows (first 10)
 *   - auto-detected column mapping
 *   - metadata (if extracted)
 *
 * The client then shows a preview + column-mapping UI before confirming.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BROKER_FORMATS } from "@/lib/import/broker-formats"
import { parseXlsx, parseCsv, parsePdf, autoMapColumns } from "@/lib/import/parser"

// Allow up to 15 MB request body for file uploads
export const maxDuration = 60
export const dynamic = "force-dynamic"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  // ── Auth ──
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Parse multipart form data ──
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const brokerId = (formData.get("broker") as string) || "other"

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 })
  }

  const format = BROKER_FORMATS[brokerId] || BROKER_FORMATS.other

  // ── Determine file type from extension ──
  const fileName = file.name.toLowerCase()
  const ext = fileName.split(".").pop() || ""

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    let parsed

    if (ext === "xlsx" || ext === "xls") {
      parsed = parseXlsx(buffer, format)
    } else if (ext === "csv") {
      parsed = parseCsv(buffer.toString("utf-8"))
    } else if (ext === "pdf") {
      parsed = await parsePdf(buffer)
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: .${ext}. Please upload .xlsx, .csv, or .pdf` },
        { status: 400 }
      )
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in the file. Please check the file and try again." },
        { status: 400 }
      )
    }

    // Auto-detect column mapping
    const mapping = autoMapColumns(parsed.headers, format)

    return NextResponse.json({
      headers: parsed.headers,
      preview: parsed.rows.slice(0, 15),
      totalRows: parsed.rows.length,
      mapping,
      meta: parsed.meta,
      broker: brokerId,
    })
  } catch (e) {
    console.error("[import/parse] Error parsing file:", e)
    const message = e instanceof Error ? e.message : "Failed to parse file"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
