"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  X,
  ChevronDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn, formatCurrency, formatNumber } from "@/lib/utils"
import { BROKER_LIST, type BrokerFormat } from "@/lib/import/broker-formats"

/** Sentinel value used when the user selects "✨ AI Fill" in column mapping.
 *  Must match AI_FILL_SENTINEL in lib/import/parser.ts */
const AI_FILL_SENTINEL = "__ai_fill__"

/** Fields where server-side AI enrichment can fill missing values */
const AI_FILLABLE_FIELDS = new Set(["company_name", "trading_symbol", "ltp", "invested_amount", "unrealized_pl"])

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface ParseResponse {
  headers: string[]
  preview: Record<string, string>[]
  totalRows: number
  mapping: Record<string, string>
  meta: Record<string, string>
  broker: string
}

interface ConfirmResponse {
  status: string
  portfolioId: string
  count: number
  message: string
}

type Step = "broker" | "upload" | "mapping" | "confirm"

const STEPS: { id: Step; label: string }[] = [
  { id: "broker", label: "Select Broker" },
  { id: "upload", label: "Upload File" },
  { id: "mapping", label: "Map Columns" },
  { id: "confirm", label: "Import" },
]

const INTERNAL_FIELDS = [
  { key: "isin", label: "ISIN", required: false },
  { key: "company_name", label: "Company Name", required: true },
  { key: "trading_symbol", label: "Trading Symbol", required: false },
  { key: "quantity", label: "Quantity", required: true },
  { key: "avg_price", label: "Average Price", required: false },
  { key: "ltp", label: "Current Price (LTP)", required: false },
  { key: "invested_amount", label: "Invested Amount", required: false },
  { key: "unrealized_pl", label: "Unrealised P&L", required: false },
]

/* ─── Main Component ───────────────────────────────────────────────────────── */

export default function ImportWizard({
  portfolioId,
  onSuccess,
}: {
  portfolioId?: string
  onSuccess?: () => void
} = {}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // State
  const [step, setStep] = useState<Step>("broker")
  const [broker, setBroker] = useState<BrokerFormat | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [portfolioName, setPortfolioName] = useState("")
  const [importResult, setImportResult] = useState<ConfirmResponse | null>(null)

  const currentStepIdx = STEPS.findIndex((s) => s.id === step)

  // ── Broker selection ──
  const handleBrokerSelect = (b: BrokerFormat) => {
    setBroker(b)
    setError(null)
    setStep("upload")
  }

  // ── File upload + parse ──
  const processFile = useCallback(
    async (f: File) => {
      setFile(f)
      setError(null)
      setParsing(true)
      try {
        const fd = new FormData()
        fd.append("file", f)
        fd.append("broker", broker?.id || "other")
        const res = await fetch("/api/portfolio/import/parse", { method: "POST", body: fd })
        const data = await res.json()
        if (!res.ok) { setError(data.error || "Failed to parse file"); setParsing(false); return }
        setParseResult(data)
        setMapping(data.mapping || {})
        setPortfolioName((prev) => prev || `${broker?.label || "Imported"} Portfolio`)
        setParsing(false)
        setStep("mapping")
      } catch {
        setError("Failed to upload file. Please try again.")
        setParsing(false)
      }
    },
    [broker]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) processFile(f)
    },
    [processFile]
  )

  // ── Confirm import ──
  const handleConfirmImport = useCallback(async () => {
    if (!file || !broker) return
    setImporting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("broker", broker.id)
      formData.append("mapping", JSON.stringify(mapping))
      formData.append("portfolioName", portfolioName)
      if (portfolioId) formData.append("updatePortfolioId", portfolioId)

      const res = await fetch("/api/portfolio/import/confirm", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to import holdings")
        setImporting(false)
        return
      }

      setImportResult(data)
      setStep("confirm")
      setImporting(false)
    } catch {
      setError("Import failed. Please try again.")
      setImporting(false)
    }
  }, [file, broker, mapping, portfolioName, portfolioId])

  // ── Navigation ──
  const goBack = () => {
    setError(null)
    const idx = currentStepIdx
    if (idx > 0) setStep(STEPS[idx - 1].id)
  }

  return (
    <div className="space-y-6">
      {/* ── Step indicator ──────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold transition-colors",
                i < currentStepIdx
                  ? "bg-primary text-primary-foreground"
                  : i === currentStepIdx
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i < currentStepIdx ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm font-medium hidden sm:inline",
                i === currentStepIdx ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="w-6 h-px bg-border mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* ── Error banner ──────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20"
          >
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step content ──────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {step === "broker" && (
          <StepBrokerSelect
            key="broker"
            onSelect={handleBrokerSelect}
          />
        )}

        {step === "upload" && broker && (
          <StepUpload
            key="upload"
            broker={broker}
            file={file}
            parsing={parsing}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            onFileDrop={processFile}
            onBack={goBack}
          />
        )}

        {step === "mapping" && parseResult && (
          <StepMapping
            key="mapping"
            parseResult={parseResult}
            mapping={mapping}
            setMapping={setMapping}
            portfolioName={portfolioName}
            setPortfolioName={setPortfolioName}
            isUpdate={!!portfolioId}
            importing={importing}
            onConfirm={handleConfirmImport}
            onBack={goBack}
          />
        )}

        {step === "confirm" && importResult && (
          <StepDone
            key="confirm"
            result={importResult}
            onViewPortfolio={() => {
              if (onSuccess) {
                router.refresh()
                onSuccess()
              } else {
                router.push(`/portfolio?pid=${importResult.portfolioId}`)
              }
            }}
            onImportAnother={() => {
              setStep("broker")
              setBroker(null)
              setFile(null)
              setParseResult(null)
              setMapping({})
              setImportResult(null)
              setPortfolioName("")
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Step 1: Broker Selection ──────────────────────────────────────────────── */

function StepBrokerSelect({ onSelect }: { onSelect: (b: BrokerFormat) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Choose Your Broker</CardTitle>
          <CardDescription>
            Select the platform you exported your holdings from
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {BROKER_LIST.map((b) => (
              <button
                key={b.id}
                onClick={() => onSelect(b)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border",
                  "hover:border-primary/50 hover:bg-primary/5 transition-all duration-150",
                  "text-center cursor-pointer"
                )}
              >
                <div className="h-10 w-20 rounded-lg bg-muted/40 flex items-center justify-center px-1 overflow-hidden">
                  {b.logoUrl ? (
                    <img src={b.logoUrl} alt={b.label} className="h-6 w-auto max-w-[68px] object-contain" />
                  ) : (
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                  )}
                </div>
                <span className="text-sm font-medium">{b.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ─── Step 2: Upload File ───────────────────────────────────────────────────── */

function StepUpload({
  broker,
  file,
  parsing,
  fileInputRef,
  onFileChange,
  onFileDrop,
  onBack,
}: {
  broker: BrokerFormat
  file: File | null
  parsing: boolean
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileDrop: (f: File) => void
  onBack: () => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const acceptTypes = broker.fileTypes.map((t) => `.${t}`).join(",")

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Export guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            How to Export from {broker.label}
            {broker.exportGuideUrl && (
              <a
                href={broker.exportGuideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-sm font-normal hover:underline inline-flex items-center gap-1"
              >
                Open {broker.label} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {broker.exportSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-muted-foreground pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* File upload area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Holdings File</CardTitle>
          <CardDescription>
            Supported formats: {broker.fileTypes.map((t) => `.${t}`).join(", ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            onChange={onFileChange}
            className="hidden"
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => !parsing && fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !parsing && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!parsing) setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              if (parsing) return
              const f = e.dataTransfer.files?.[0]
              if (f) onFileDrop(f)
            }}
            className={cn(
              "w-full flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed",
              "transition-all duration-150 cursor-pointer select-none",
              parsing
                ? "border-primary/30 bg-primary/5"
                : isDragging
                  ? "border-primary bg-primary/10 scale-[1.01]"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
            )}
          >
            {parsing ? (
              <>
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Parsing file...</p>
              </>
            ) : file ? (
              <>
                <FileSpreadsheet className="h-10 w-10 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · Click to change
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">
                    Max 10 MB · {broker.fileTypes.map((t) => `.${t}`).join(", ")}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between mt-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ─── Step 3: Column Mapping + Preview ──────────────────────────────────────── */

function StepMapping({
  parseResult,
  mapping,
  setMapping,
  portfolioName,
  setPortfolioName,
  isUpdate,
  importing,
  onConfirm,
  onBack,
}: {
  parseResult: ParseResponse
  mapping: Record<string, string>
  setMapping: (m: Record<string, string>) => void
  portfolioName: string
  setPortfolioName: (n: string) => void
  isUpdate: boolean
  importing: boolean
  onConfirm: () => void
  onBack: () => void
}) {
  const { headers, preview, totalRows, meta } = parseResult

  const updateMapping = (field: string, column: string) => {
    setMapping({ ...mapping, [field]: column || "" })
  }

  // Validation
  const hasQuantity = !!mapping.quantity
  const hasIdentifier = !!(mapping.company_name || mapping.isin || mapping.trading_symbol)
  const canImport = hasQuantity && hasIdentifier
  const hasAiFill = Object.values(mapping).some((v) => v === AI_FILL_SENTINEL)

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Meta info */}
      {Object.keys(meta).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">File Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {Object.entries(meta).slice(0, 6).map(([k, v]) => (
                <div key={k}>
                  <span className="text-muted-foreground">{k}:</span>{" "}
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Column mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Map Columns</CardTitle>
          <CardDescription>
            Match your file&apos;s columns to the required fields.
            {totalRows > 0 && ` Found ${totalRows} holdings.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Portfolio name / update indicator */}
          {isUpdate ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium w-36 shrink-0 text-muted-foreground">Mode</span>
              <span className="text-sm px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary font-medium">
                Updating existing portfolio
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium w-36 shrink-0">Portfolio Name</label>
              <input
                type="text"
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="My Portfolio"
              />
            </div>
          )}

          <div className="h-px bg-border" />

          {/* Column mapping dropdowns */}
          <div className="grid gap-3">
            {INTERNAL_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <label className="text-sm font-medium w-36 shrink-0">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </label>
                <div className="relative flex-1">
                  <select
                    value={mapping[field.key] || ""}
                    onChange={(e) => updateMapping(field.key, e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border bg-transparent text-sm appearance-none pr-8",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50",
                      !mapping[field.key] && field.required && "border-destructive/50"
                    )}
                  >
                    <option value="">— Skip —</option>
                    {AI_FILLABLE_FIELDS.has(field.key) && (
                      <option value={AI_FILL_SENTINEL}>✨ AI Fill</option>
                    )}
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                {mapping[field.key] === AI_FILL_SENTINEL && (
                  <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                    AI
                  </span>
                )}
              </div>
            ))}
          </div>

          {!canImport && (
            <p className="text-sm text-destructive/80">
              Please map at least Quantity and one identifier (Company Name, ISIN, or Symbol)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Preview</CardTitle>
          <CardDescription>
            Showing {Math.min(preview.length, 10)} of {totalRows} rows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {headers.slice(0, 8).map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {headers.slice(0, 8).map((h) => (
                      <td key={h} className="py-2 px-3 whitespace-nowrap">
                        {row[h] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          disabled={!canImport || importing}
          onClick={onConfirm}
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : hasAiFill ? (
            <>
              ✨ Import with AI Enrichment
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Import {totalRows} Holdings
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

/* ─── Step 4: Success ───────────────────────────────────────────────────────── */

function StepDone({
  result,
  onViewPortfolio,
  onImportAnother,
}: {
  result: ConfirmResponse
  onViewPortfolio: () => void
  onImportAnother: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold">
            {result.status === "updated" ? "Portfolio Updated!" : "Import Successful!"}
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            {result.message}.
          </p>
          <div className="flex gap-3 mt-2">
            <Button onClick={onViewPortfolio}>
              View Portfolio
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={onImportAnother}>
              Import Another
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
