"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity } from "lucide-react"

interface CorrelationData {
  labels: string[]
  matrix: number[][]
  days?: number
}

interface Props {
  /** The list of segment names currently present in the portfolio */
  segments: string[]
}

// Background and text colours for a correlation cell.
function cellStyle(r: number, isDiag: boolean): React.CSSProperties {
  if (isDiag) {
    return { background: "rgba(99,102,241,0.22)", color: "#a5b4fc" }
  }
  const abs = Math.abs(r)
  const alpha = Math.min(abs * 0.85, 0.82)
  const bg =
    r >= 0
      ? `rgba(16,185,129,${alpha.toFixed(2)})`  // green for positive
      : `rgba(239,68,68,${alpha.toFixed(2)})`   // red for negative
  const textColor = abs > 0.4 ? "#fff" : "hsl(var(--foreground))"
  return { background: bg, color: textColor }
}

// Qualitative label for how strong |r| is.
function strengthLabel(r: number): string {
  const abs = Math.abs(r)
  if (abs >= 0.75) return "Strong"
  if (abs >= 0.45) return "Moderate"
  if (abs >= 0.2)  return "Weak"
  return "None"
}

export function SectorCorrelationHeatmap({ segments }: Props) {
  const [data, setData]     = useState<CorrelationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (segments.length === 0) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ segments: segments.join(",") })
    fetch(`/api/analytics/sector-correlation?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error)
        } else {
          setData(json as CorrelationData)
        }
      })
      .catch(() => setError("Failed to load correlation data."))
      .finally(() => setLoading(false))
  }, [segments.join(",")])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="col-span-full border border-white/10 bg-white/5 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/80">
            <Activity className="h-4 w-4 text-violet-400" />
            Sector Correlation Matrix
          </CardTitle>
          {data && (
            <span className="text-xs text-white/40">{data.days ?? 90}-day rolling window</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-white/40">
          Pearson correlation of daily returns across Nifty sector indices
        </p>
      </CardHeader>

      <CardContent>
        {loading && (
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
            {Array.from({ length: 36 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-sm bg-white/10" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-10">
            <p className="text-center text-sm text-white/50">{error}</p>
          </div>
        )}

        {!loading && !error && data && data.labels.length >= 2 && (
          <div className="overflow-x-auto">
            {/* Grid: N+1 columns (header col + N data cols) */}
            <div
              className="grid gap-px text-xs"
              style={{
                gridTemplateColumns: `minmax(90px,110px) repeat(${data.labels.length}, minmax(64px, 1fr))`,
                minWidth: 90 + data.labels.length * 68,
              }}
            >
              {/* Top-left empty cell */}
              <div />

              {/* Column headers */}
              {data.labels.map((label) => (
                <div
                  key={label}
                  className="flex items-end justify-center px-1 pb-1 text-center font-medium text-white/60"
                  title={label}
                >
                  <span className="truncate">{label}</span>
                </div>
              ))}

              {/* Rows */}
              {data.matrix.map((row, i) => (
                <>
                  {/* Row label */}
                  <div
                    key={`row-${i}`}
                    className="flex items-center pr-2 font-medium text-white/60"
                    title={data.labels[i]}
                  >
                    <span className="truncate">{data.labels[i]}</span>
                  </div>

                  {/* Correlation cells */}
                  {row.map((r, j) => {
                    const isDiag = i === j
                    return (
                      <div
                        key={`cell-${i}-${j}`}
                        className="flex flex-col items-center justify-center rounded-sm p-1 text-center leading-tight"
                        style={cellStyle(r, isDiag)}
                        title={
                          isDiag
                            ? data.labels[i]
                            : `${data.labels[i]} vs ${data.labels[j]}: ${r.toFixed(2)} (${strengthLabel(r)})`
                        }
                      >
                        <span className="font-semibold">{isDiag ? "1.0" : r.toFixed(2)}</span>
                        {!isDiag && (
                          <span className="mt-0.5 text-[9px] opacity-80">
                            {strengthLabel(r)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/40">
              <span className="font-medium text-white/60">Correlation strength:</span>
              {[
                { label: "Strong ≥ 0.75", color: "rgba(16,185,129,0.82)" },
                { label: "Moderate ≥ 0.45", color: "rgba(16,185,129,0.48)" },
                { label: "Weak ≥ 0.20", color: "rgba(16,185,129,0.22)" },
                { label: "Negative", color: "rgba(239,68,68,0.70)" },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: color }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && data && data.labels.length < 2 && (
          <div className="flex items-center justify-center py-10">
            <p className="text-center text-sm text-white/50">
              Not enough sectors with Nifty index equivalents to show correlation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
