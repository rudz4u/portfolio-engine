"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export const SEGMENTS = [
  "Defence", "EV", "Technology", "Green Energy", "PSU", "BFSI",
  "Healthcare", "Pharma", "Infrastructure", "FMCG", "Auto",
  "Metals", "Energy", "IT", "Others",
]

const SEGMENT_COLORS: Record<string, string> = {
  Defence: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  EV: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Technology: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  "Green Energy": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  PSU: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  BFSI: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  Healthcare: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  Pharma: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  Infrastructure: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  FMCG: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  Auto: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  Metals: "bg-stone-100 text-stone-800 dark:bg-stone-900/40 dark:text-stone-300",
  Energy: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  IT: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  Others: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

/** Pull trading_symbol from the raw Upstox API response stored in the holding */
export function getTradingSymbol(h: Record<string, unknown>): string {
  const raw = h.raw as Record<string, unknown> | null
  return (raw?.trading_symbol as string) || (raw?.tradingsymbol as string) || (h.instrument_key as string)
}

export function getCompanyName(h: Record<string, unknown>): string {
  const raw = h.raw as Record<string, unknown> | null
  return (raw?.company_name as string) || ""
}

interface HoldingRow {
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

interface Props {
  holdings: HoldingRow[]
}

export default function PortfolioTable({ holdings: initial }: Props) {
  const [holdings, setHoldings] = useState<HoldingRow[]>(initial)
  const [editingSegment, setEditingSegment] = useState<string | null>(null) // holding id
  const [saving, setSaving] = useState<string | null>(null)

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
      {/* Close any open dropdown on outside click */}
      {editingSegment && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setEditingSegment(null)}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-2 pr-4 font-medium">Symbol</th>
              <th className="text-right py-2 px-2 font-medium">Qty</th>
              <th className="text-right py-2 px-2 font-medium">Avg Price</th>
              <th className="text-right py-2 px-2 font-medium hidden md:table-cell">LTP</th>
              <th className="text-right py-2 px-2 font-medium">Invested</th>
              <th className="text-right py-2 px-2 font-medium">P&amp;L</th>
              <th className="text-right py-2 pl-2 font-medium hidden lg:table-cell">
                Segment
                <span className="ml-1 text-xs font-normal text-muted-foreground">(click to edit)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const pnl = h.unrealized_pl || 0
              const invested = h.invested_amount || 0
              const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
              const segment = h.segment || "Others"
              const symbol = getTradingSymbol(h as unknown as Record<string, unknown>)
              const company = getCompanyName(h as unknown as Record<string, unknown>)
              const isSaving = saving === h.id

              return (
                <tr
                  key={h.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {/* Symbol + company name */}
                  <td className="py-2.5 pr-4">
                    <Link
                      href={`/portfolio/${encodeURIComponent(h.instrument_key)}`}
                      className="font-medium hover:text-primary hover:underline underline-offset-2 transition-colors"
                    >
                      {symbol}
                    </Link>
                    {company && symbol !== company && (
                      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {company}
                      </div>
                    )}
                  </td>

                  <td className="text-right py-2.5 px-2">{h.quantity}</td>

                  <td className="text-right py-2.5 px-2">
                    ₹{(h.avg_price || 0).toFixed(2)}
                  </td>

                  <td className="text-right py-2.5 px-2 hidden md:table-cell">
                    {h.ltp ? `₹${h.ltp.toFixed(2)}` : "—"}
                  </td>

                  <td className="text-right py-2.5 px-2">
                    {formatCurrency(invested)}
                  </td>

                  <td className={`text-right py-2.5 px-2 ${pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                    <div>{pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}</div>
                    <div className="text-xs">
                      {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                    </div>
                  </td>

                  {/* Editable segment */}
                  <td className="text-right py-2.5 pl-2 hidden lg:table-cell">
                    <div className="relative inline-block">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingSegment(editingSegment === h.id ? null : h.id)
                        }}
                        disabled={isSaving}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
                          transition-opacity ${isSaving ? "opacity-50" : "hover:opacity-80 cursor-pointer"}
                          ${SEGMENT_COLORS[segment] || SEGMENT_COLORS.Others}`}
                      >
                        {isSaving ? "…" : segment}
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>

                      {editingSegment === h.id && (
                        <div
                          className="absolute right-0 z-20 mt-1 w-40 rounded-md border bg-popover shadow-lg text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {SEGMENTS.map((seg) => (
                            <button
                              key={seg}
                              onClick={() => updateSegment(h.id, seg)}
                              className={`block w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors
                                ${seg === segment ? "font-semibold" : ""}`}
                            >
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
    </>
  )
}
