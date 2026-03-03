"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react"

/* ─── Segments ─────────────────────────────────────────────────────────── */

export const SEGMENTS = [
  "Defence", "EV", "Technology", "Green Energy", "PSU", "BFSI",
  "Healthcare", "Pharma", "Infrastructure", "FMCG", "Auto",
  "Metals", "Energy", "IT", "Others",
]

const SEGMENT_COLORS: Record<string, string> = {
  Defence:        "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  EV:             "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Technology:     "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  "Green Energy": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  PSU:            "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  BFSI:           "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Healthcare:     "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  Pharma:         "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  Infrastructure: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  FMCG:           "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  Auto:           "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  Metals:         "bg-stone-100 text-stone-800 dark:bg-stone-900/40 dark:text-stone-300",
  Energy:         "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  IT:             "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  Others:         "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

const SEGMENT_DOT: Record<string, string> = {
  Defence: "bg-blue-400", EV: "bg-green-400", Technology: "bg-purple-400",
  "Green Energy": "bg-emerald-400", PSU: "bg-orange-400", BFSI: "bg-yellow-400",
  Healthcare: "bg-pink-400", Pharma: "bg-rose-400", Infrastructure: "bg-cyan-400",
  FMCG: "bg-teal-400", Auto: "bg-indigo-400", Metals: "bg-stone-400",
  Energy: "bg-amber-400", IT: "bg-violet-400", Others: "bg-gray-400",
}

/* ─── Raw helpers ───────────────────────────────────────────────────────── */

export function getTradingSymbol(h: Record<string, unknown>): string {
  const raw = h.raw as Record<string, unknown> | null
  return (raw?.trading_symbol as string) || (raw?.tradingsymbol as string) || (h.instrument_key as string)
}

export function getCompanyName(h: Record<string, unknown>): string {
  const raw = h.raw as Record<string, unknown> | null
  return (raw?.company_name as string) || ""
}

function getExchange(h: HoldingRow): string {
  const raw = h.raw as Record<string, unknown> | null
  const ex = (raw?.exchange as string) || ""
  if (ex.startsWith("NSE")) return "NSE"
  if (ex.startsWith("BSE")) return "BSE"
  return ex
}

function getDayChangePct(h: HoldingRow): number {
  const raw = h.raw as Record<string, unknown> | null
  return (raw?.day_change_percentage as number) || 0
}

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface HoldingRow {
  id: string
  instrument_key: string
  quantity: number
  avg_price: number
  ltp: number
  invested_amount: number
  unrealized_pl: number
  segment: string | null
  raw: Record<string, unknown> | null
}

type SortKey =
  | "symbol" | "qty" | "avg_price" | "ltp"
  | "current_value" | "invested" | "pnl" | "pnl_pct"
  | "day_change" | "segment"

type SortDir = "asc" | "desc"
interface SortConfig { key: SortKey; dir: SortDir }

function getSortValue(h: HoldingRow, key: SortKey): string | number {
  switch (key) {
    case "symbol":        return getTradingSymbol(h as unknown as Record<string, unknown>).toLowerCase()
    case "qty":           return h.quantity || 0
    case "avg_price":     return h.avg_price || 0
    case "ltp":           return h.ltp || 0
    case "current_value": return (h.quantity || 0) * (h.ltp || 0)
    case "invested":      return h.invested_amount || 0
    case "pnl":           return h.unrealized_pl || 0
    case "pnl_pct": {
      const inv = h.invested_amount || 0
      return inv > 0 ? ((h.unrealized_pl || 0) / inv) * 100 : 0
    }
    case "day_change":    return getDayChangePct(h)
    case "segment":       return (h.segment || "Others").toLowerCase()
    default:              return 0
  }
}

/* ─── Sortable header ───────────────────────────────────────────────────── */

function SortHeader({
  label, sortKey, config, onSort, className = "", align = "right",
}: {
  label: string
  sortKey: SortKey
  config: SortConfig | null
  onSort: (k: SortKey) => void
  className?: string
  align?: "left" | "right"
}) {
  const active = config?.key === sortKey
  const Icon = active
    ? config!.dir === "asc" ? ChevronUp : ChevronDown
    : ArrowUpDown

  return (
    <th
      className={`py-2 px-2 font-medium cursor-pointer select-none group whitespace-nowrap ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-0.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
        <span>{label}</span>
        <Icon
          className={`h-3 w-3 shrink-0 transition-opacity ${
            active ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50"
          }`}
        />
      </div>
    </th>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────── */

interface Props { holdings: HoldingRow[] }

export default function PortfolioTable({ holdings: initial }: Props) {
  const [holdings, setHoldings] = useState<HoldingRow[]>(initial)
  const [editingSegment, setEditingSegment] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({
    key: "invested",
    dir: "desc",
  })

  function toggleSort(key: SortKey) {
    setSortConfig((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      return { key, dir: key === "symbol" || key === "segment" ? "asc" : "desc" }
    })
  }

  const sorted = useMemo(() => {
    if (!sortConfig) return holdings
    return [...holdings].sort((a, b) => {
      const va = getSortValue(a, sortConfig.key)
      const vb = getSortValue(b, sortConfig.key)
      if (va < vb) return sortConfig.dir === "asc" ? -1 : 1
      if (va > vb) return sortConfig.dir === "asc" ? 1 : -1
      return 0
    })
  }, [holdings, sortConfig])

  async function updateSegment(holdingId: string, segment: string) {
    setSaving(holdingId)
    setEditingSegment(null)
    try {
      const res = await fetch(`/api/holdings/${holdingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment }),
      })
      if (res.ok) {
        setHoldings((prev) =>
          prev.map((h) => (h.id === holdingId ? { ...h, segment } : h))
        )
      }
    } finally {
      setSaving(null)
    }
  }

  if (holdings.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-10">
        No holdings found. Go to{" "}
        <a href="/settings" className="underline">Settings</a> to connect Upstox and sync.
      </p>
    )
  }

  return (
    <>
      {editingSegment && (
        <div className="fixed inset-0 z-10" onClick={() => setEditingSegment(null)} />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <SortHeader label="Symbol"      sortKey="symbol"        config={sortConfig} onSort={toggleSort} align="left" className="text-left py-2 pr-4 pl-1" />
              <SortHeader label="Qty"         sortKey="qty"           config={sortConfig} onSort={toggleSort} />
              <SortHeader label="Avg Price"   sortKey="avg_price"     config={sortConfig} onSort={toggleSort} className="hidden md:table-cell" />
              <SortHeader label="LTP"         sortKey="ltp"           config={sortConfig} onSort={toggleSort} className="hidden md:table-cell" />
              <SortHeader label="Curr. Value" sortKey="current_value" config={sortConfig} onSort={toggleSort} className="hidden lg:table-cell" />
              <SortHeader label="Invested"    sortKey="invested"      config={sortConfig} onSort={toggleSort} className="hidden lg:table-cell" />
              <SortHeader label="P&amp;L"     sortKey="pnl"           config={sortConfig} onSort={toggleSort} />
              <SortHeader label="Day Chg%"    sortKey="day_change"    config={sortConfig} onSort={toggleSort} className="hidden xl:table-cell" />
              <SortHeader label="Segment"     sortKey="segment"       config={sortConfig} onSort={toggleSort} className="hidden lg:table-cell" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => {
              const pnl      = h.unrealized_pl || 0
              const invested = h.invested_amount || 0
              const ltp      = h.ltp || 0
              const qty      = h.quantity || 0
              const curVal   = qty * ltp
              const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0
              const dayChg   = getDayChangePct(h)
              const segment  = h.segment || "Others"
              const symbol   = getTradingSymbol(h as unknown as Record<string, unknown>)
              const company  = getCompanyName(h as unknown as Record<string, unknown>)
              const exchange = getExchange(h)
              const isSaving = saving === h.id

              return (
                <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">

                  {/* Symbol + Exchange + Company */}
                  <td className="py-3 pr-4 pl-1">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/portfolio/${encodeURIComponent(h.instrument_key)}`}
                        className="font-semibold hover:text-primary hover:underline underline-offset-2 transition-colors"
                      >
                        {symbol}
                      </Link>
                      {exchange && (
                        <span className="text-[10px] font-medium px-1.5 py-0 rounded border border-border text-muted-foreground leading-4">
                          {exchange}
                        </span>
                      )}
                    </div>
                    {company && (
                      <div className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">
                        {company}
                      </div>
                    )}
                  </td>

                  {/* Qty */}
                  <td className="text-right py-3 px-2 tabular-nums">{qty}</td>

                  {/* Avg Price */}
                  <td className="text-right py-3 px-2 tabular-nums hidden md:table-cell">
                    ₹{(h.avg_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* LTP */}
                  <td className="text-right py-3 px-2 tabular-nums hidden md:table-cell">
                    {ltp ? `₹${ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </td>

                  {/* Current Value */}
                  <td className="text-right py-3 px-2 tabular-nums font-medium hidden lg:table-cell">
                    {curVal > 0 ? formatCurrency(curVal) : "—"}
                  </td>

                  {/* Invested */}
                  <td className="text-right py-3 px-2 tabular-nums hidden lg:table-cell">
                    {formatCurrency(invested)}
                  </td>

                  {/* P&L + % */}
                  <td className={`text-right py-3 px-2 ${pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                    <div className="tabular-nums font-medium whitespace-nowrap">
                      {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                    </div>
                    <div className="text-xs tabular-nums">
                      {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                    </div>
                  </td>

                  {/* Day Change % */}
                  <td className={`text-right py-3 px-2 text-xs font-medium tabular-nums hidden xl:table-cell ${
                    dayChg >= 0 ? "text-green-600" : "text-red-500"
                  }`}>
                    {dayChg !== 0 ? `${dayChg >= 0 ? "+" : ""}${dayChg.toFixed(2)}%` : "—"}
                  </td>

                  {/* Segment (editable) */}
                  <td className="text-right py-3 pl-2 pr-1 hidden lg:table-cell">
                    <div className="relative inline-block">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingSegment(editingSegment === h.id ? null : h.id)
                        }}
                        disabled={isSaving}
                        title="Click to change segment"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium
                          transition-opacity ${isSaving ? "opacity-50" : "hover:opacity-80 cursor-pointer"}
                          ${SEGMENT_COLORS[segment] || SEGMENT_COLORS.Others}`}
                      >
                        {isSaving ? "…" : segment}
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>

                      {editingSegment === h.id && (
                        <div
                          className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover shadow-lg text-left py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {SEGMENTS.map((seg) => (
                            <button
                              key={seg}
                              onClick={() => updateSegment(h.id, seg)}
                              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors
                                ${seg === segment ? "font-semibold text-primary" : ""}`}
                            >
                              <span className={`h-2 w-2 rounded-full shrink-0 ${SEGMENT_DOT[seg] || "bg-gray-400"}`} />
                              {seg}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-3 lg:hidden">
        More columns (Avg Price, LTP, Curr. Value, Invested, Segment) visible on larger screens.
      </p>
    </>
  )
}
