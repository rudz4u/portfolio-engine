/**
 * Parse uploaded holdings files (XLSX, CSV, PDF) into a uniform row format.
 * Returns raw headers + rows so the caller can apply column mapping.
 */
import * as XLSX from "xlsx"
import type { BrokerFormat } from "./broker-formats"

export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]
  /** Metadata extracted from header area (e.g. account name, report date) */
  meta: Record<string, string>
}

export interface MappedHolding {
  isin: string
  company_name: string
  trading_symbol: string
  quantity: number
  avg_price: number
  ltp: number
  invested_amount: number
  unrealized_pl: number
}

// ── XLSX parsing ──────────────────────────────────────────────────────────────

export function parseXlsx(buffer: Buffer, format: BrokerFormat): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" })

  // Find the target sheet
  const sheetName =
    format.sheetName && workbook.SheetNames.includes(format.sheetName)
      ? format.sheetName
      : workbook.SheetNames[0]

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error("No sheet found in the uploaded file")

  // Convert to array-of-arrays (raw)
  const rawData: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  })

  if (rawData.length === 0) throw new Error("File appears to be empty")

  // Extract metadata from rows above the header (for known formats like Upstox)
  const meta: Record<string, string> = {}
  for (let i = 0; i < Math.min(format.headerRow, rawData.length); i++) {
    const row = rawData[i]
    if (row && row.length >= 2) {
      const key = String(row[0] || "").trim()
      const val = String(row[1] || "").trim()
      if (key && val) meta[key] = val
    }
  }

  // Identify header row
  const headerRowIndex = Math.min(format.headerRow, rawData.length - 1)
  const headers = rawData[headerRowIndex].map((h) => String(h || "").trim()).filter(Boolean)

  if (headers.length === 0) throw new Error("Could not find column headers in the file")

  // Parse data rows
  const rows: Record<string, string>[] = []
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const rowArr = rawData[i]
    if (!rowArr || rowArr.length === 0) continue

    // Skip rows that look like footers/disclaimers (first cell is very long text)
    const firstCell = String(rowArr[0] || "").trim()
    if (firstCell.length > 100) continue
    if (!firstCell) continue

    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = String(rowArr[idx] ?? "").trim()
    })
    rows.push(row)
  }

  return { headers, rows, meta }
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

export function parseCsv(text: string): ParsedFile {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error("CSV file appears to be empty or has no data rows")

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV split (handles quoted fields with commas)
    const values = csvSplitLine(lines[i])
    if (values.length === 0 || !values[0].trim()) continue

    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || "").trim().replace(/^"|"$/g, "")
    })
    rows.push(row)
  }

  return { headers, rows, meta: {} }
}

function csvSplitLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ── PDF parsing ───────────────────────────────────────────────────────────────

export async function parsePdf(buffer: Buffer): Promise<ParsedFile> {
  // Dynamic import to avoid loading pdf-parse on every request
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>
  const data = await pdfParse(buffer)
  const text: string = data.text

  // Try to extract tabular data from PDF text
  const lines: string[] = text.split("\n").map((l: string) => l.trim()).filter(Boolean)

  // Heuristic: find a line that looks like headers (contains "ISIN" or "Qty" or "Quantity")
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase()
    if (lower.includes("isin") || (lower.includes("qty") && lower.includes("name"))) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    // Can't auto-detect structure — return raw lines for manual mapping
    return {
      headers: ["Line"],
      rows: lines.slice(0, 200).map((l: string) => ({ Line: l })),
      meta: {},
    }
  }

  // Split header line by multiple spaces (common in PDF tables)
  const headers: string[] = lines[headerIdx].split(/\s{2,}/).map((h: string) => h.trim()).filter(Boolean)
  const rows: Record<string, string>[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts: string[] = lines[i].split(/\s{2,}/).map((p: string) => p.trim())
    if (parts.length < 2) continue
    // Skip footer rows
    if (parts[0].length > 100) continue

    const row: Record<string, string> = {}
    headers.forEach((header: string, idx: number) => {
      row[header] = parts[idx] || ""
    })
    rows.push(row)
  }

  return { headers, rows, meta: {} }
}

// ── Column mapping ─────────────────────────────────────────────────────────────

/**
 * Auto-detect which file columns map to our fields based on broker format
 * and smart heuristics. Returns a map: internalField → fileColumnHeader
 */
export function autoMapColumns(
  headers: string[],
  format: BrokerFormat
): Record<string, string> {
  const mapping: Record<string, string> = {}
  const lowerHeaders = headers.map((h) => h.toLowerCase())

  const fields = ["isin", "company_name", "trading_symbol", "quantity", "avg_price", "ltp", "invested_amount", "unrealized_pl"] as const

  for (const field of fields) {
    const candidates = format.columnMap[field] || []

    // Try exact match from broker format
    for (const candidate of candidates) {
      const idx = lowerHeaders.indexOf(candidate.toLowerCase())
      if (idx !== -1) {
        mapping[field] = headers[idx]
        break
      }
    }

    // Fallback: fuzzy matching on common patterns
    if (!mapping[field]) {
      const fuzzyMap: Record<string, string[]> = {
        isin: ["isin"],
        company_name: ["name", "scrip", "company", "stock"],
        trading_symbol: ["symbol", "trading", "ticker", "scrip code"],
        quantity: ["qty", "quantity", "shares", "net qty", "balance"],
        avg_price: ["avg", "average", "buy price", "cost"],
        ltp: ["ltp", "last", "current price", "cmp", "rate", "market price"],
        invested_amount: ["invested", "cost value", "buy value"],
        unrealized_pl: ["p&l", "pnl", "profit", "unrealised", "unrealized", "gain", "return"],
      }

      const fuzzyPatterns = fuzzyMap[field] || []
      for (let i = 0; i < lowerHeaders.length; i++) {
        if (Object.values(mapping).includes(headers[i])) continue // already used
        for (const pat of fuzzyPatterns) {
          if (lowerHeaders[i].includes(pat)) {
            mapping[field] = headers[i]
            break
          }
        }
        if (mapping[field]) break
      }
    }
  }

  return mapping
}

/**
 * Apply column mapping to parsed rows, producing uniform MappedHolding objects.
 */
export function applyMapping(
  rows: Record<string, string>[],
  columnMapping: Record<string, string>
): MappedHolding[] {
  return rows
    .map((row) => {
      const qty = parseNum(row[columnMapping.quantity])
      if (qty <= 0) return null // Skip zero-quantity rows

      const avgPrice = parseNum(row[columnMapping.avg_price])
      const ltp = parseNum(row[columnMapping.ltp])
      const invested = parseNum(row[columnMapping.invested_amount]) || qty * avgPrice
      const pnl = parseNum(row[columnMapping.unrealized_pl]) || (ltp > 0 ? qty * ltp - invested : 0)

      // Clean up scrip name: remove suffixes like "-EQ", "-EQ2/-", etc.
      const rawName = row[columnMapping.company_name] || row[columnMapping.trading_symbol] || ""
      const companyName = rawName.replace(/[-\s]*(EQ\d*|BE|RE\.\d+|RS\d+|SM|IL|BZ)[/\-]*$/i, "").trim() || rawName

      return {
        isin: (row[columnMapping.isin] || "").trim(),
        company_name: companyName,
        trading_symbol: (row[columnMapping.trading_symbol] || rawName).replace(/\s+/g, "").trim(),
        quantity: qty,
        avg_price: avgPrice,
        ltp,
        invested_amount: invested,
        unrealized_pl: pnl,
      }
    })
    .filter((h): h is MappedHolding => h !== null)
}

function parseNum(val: string | undefined): number {
  if (!val) return 0
  const cleaned = val.replace(/[₹,\s]/g, "")
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
