"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Activity, AlertTriangle, TrendingUp, Minus, Hash } from "lucide-react"

interface CorrelationData {
  labels: string[]
  matrix: number[][]
  days?: number
}

interface Props {
  segments: string[]
}

/* ─── Classification helpers ──────────────────────────────────── */

type CorrelClass = "strong-pos" | "moderate-pos" | "independent" | "moderate-neg" | "strong-neg"

function classify(r: number): CorrelClass {
  if (r >= 0.65)  return "strong-pos"
  if (r >= 0.35)  return "moderate-pos"
  if (r >= -0.35) return "independent"
  if (r >= -0.65) return "moderate-neg"
  return "strong-neg"
}

const CLASS_META: Record<
  CorrelClass,
  { label: string; shortLabel: string; bgClass: string; textClass: string; borderClass: string; dot: string }
> = {
  "strong-pos":   { label: "Moves Together",      shortLabel: "Together", bgClass: "bg-emerald-500/15", textClass: "text-emerald-400", borderClass: "border-emerald-500/25", dot: "bg-emerald-400" },
  "moderate-pos": { label: "Often Aligned",        shortLabel: "Aligned",  bgClass: "bg-teal-500/10",    textClass: "text-teal-400",    borderClass: "border-teal-500/20",    dot: "bg-teal-400" },
  "independent":  { label: "Independent",          shortLabel: "Neutral",  bgClass: "bg-white/[0.03]",   textClass: "text-white/40",    borderClass: "border-white/8",        dot: "bg-white/30" },
  "moderate-neg": { label: "Often Opposite",       shortLabel: "Opposite", bgClass: "bg-amber-500/10",   textClass: "text-amber-400",   borderClass: "border-amber-500/20",   dot: "bg-amber-400" },
  "strong-neg":   { label: "Strongly Opposite",    shortLabel: "Diverges", bgClass: "bg-red-500/10",     textClass: "text-red-400",     borderClass: "border-red-500/20",     dot: "bg-red-400" },
}

/* ─── Plain-English insight generator ────────────────────────── */

interface PairInsight {
  a: string
  b: string
  r: number
  cls: CorrelClass
  headline: string
  detail: string
}

function buildInsights(labels: string[], matrix: number[][]): PairInsight[] {
  const pairs: PairInsight[] = []
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const r = matrix[i][j]
      const cls = classify(r)
      const a = labels[i], b = labels[j]
      const map: Record<CorrelClass, [string, string]> = {
        "strong-pos":   [`${a} & ${b} move together`,           `These sectors tend to rise and fall at the same time. Holding both gives less protection when markets turn.`],
        "moderate-pos": [`${a} & ${b} are often aligned`,       `They frequently trend in the same direction, but not always. Some diversification benefit here.`],
        "independent":  [`${a} & ${b} move independently`,      `These sectors don't follow each other — a good diversification pair for your portfolio.`],
        "moderate-neg": [`${a} & ${b} often go opposite`,       `When one gains, the other tends to dip. Holding both can help smooth out your portfolio swings.`],
        "strong-neg":   [`${a} & ${b} move in opposite ways`,   `These sectors frequently move in opposite directions — a natural hedge inside your portfolio.`],
      }
      const [headline, detail] = map[cls]
      pairs.push({ a, b, r, cls, headline, detail })
    }
  }
  return pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r))
}

/* ─── Component ────────────────────────────────────────────────── */

export function SectorCorrelationHeatmap({ segments }: Props) {
  const [data, setData]             = useState<CorrelationData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showNumbers, setShowNumbers] = useState(false)
  const [expandedPair, setExpandedPair] = useState<string | null>(null)

  useEffect(() => {
    if (segments.length === 0) return
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ segments: segments.join(",") })
    fetch(`/api/analytics/sector-correlation?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error)
        else setData(json as CorrelationData)
      })
      .catch(() => setError("Failed to load sector data."))
      .finally(() => setLoading(false))
  }, [segments.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps

  const insights = useMemo(
    () => (data ? buildInsights(data.labels, data.matrix) : []),
    [data],
  )

  const counts = useMemo(() => {
    const c: Record<CorrelClass, number> = {
      "strong-pos": 0, "moderate-pos": 0, "independent": 0, "moderate-neg": 0, "strong-neg": 0,
    }
    insights.forEach((p) => c[p.cls]++)
    return c
  }, [insights])

  return (
    <Card className="col-span-full border border-white/10 bg-white/5 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/80">
              <Activity className="h-4 w-4 text-violet-400" />
              How Your Sectors Move Together
            </CardTitle>
            <p className="mt-1 text-xs text-white/40">
              Based on {data?.days ?? 90} days of Nifty index returns · tap any card for an explanation
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs text-white/40 hover:text-white"
            onClick={() => setShowNumbers((v) => !v)}
          >
            <Hash className="h-3 w-3" />
            {showNumbers ? "Hide numbers" : "Show numbers"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl bg-white/7" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm text-white/60">{error}</p>
          </div>
        )}

        {/* Main content */}
        {!loading && !error && data && data.labels.length >= 2 && (
          <>
            {/* Summary legend pills */}
            <div className="flex flex-wrap gap-2">
              {(["strong-pos","moderate-pos","independent","moderate-neg","strong-neg"] as CorrelClass[])
                .filter((cls) => counts[cls] > 0)
                .map((cls) => {
                  const m = CLASS_META[cls]
                  return (
                    <span
                      key={cls}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${m.bgClass} ${m.textClass} ${m.borderClass}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                      {counts[cls]}× {m.label}
                    </span>
                  )
                })}
            </div>

            {/* Key relationship cards */}
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                Key Relationships
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {insights.slice(0, 6).map((p) => {
                  const m = CLASS_META[p.cls]
                  const pairKey = `${p.a}|${p.b}`
                  const isOpen = expandedPair === pairKey
                  return (
                    <button
                      key={pairKey}
                      type="button"
                      onClick={() => setExpandedPair(isOpen ? null : pairKey)}
                      className={`text-left rounded-xl border px-4 py-3 transition-all hover:brightness-125 ${m.bgClass} ${m.borderClass}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold leading-snug ${m.textClass}`}>
                            {p.headline}
                          </p>
                          {isOpen && (
                            <p className="mt-2 text-xs text-white/50 leading-relaxed">{p.detail}</p>
                          )}
                          {!isOpen && (
                            <p className="mt-0.5 text-xs text-white/30">Tap to learn more</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${m.bgClass} ${m.textClass} ${m.borderClass}`}
                          >
                            {m.shortLabel}
                          </span>
                          {showNumbers && (
                            <span className="text-[10px] text-white/30 tabular-nums">r={p.r.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Full numeric matrix (advanced toggle) */}
            {showNumbers && (
              <div>
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  Full Matrix (advanced)
                </p>
                <div className="overflow-x-auto">
                  <div
                    className="grid gap-px text-xs"
                    style={{
                      gridTemplateColumns: `minmax(80px,100px) repeat(${data.labels.length}, minmax(56px,1fr))`,
                    }}
                  >
                    <div />
                    {data.labels.map((label) => (
                      <div key={label} className="pb-1 text-center text-[10px] font-medium text-white/35 truncate">
                        {label}
                      </div>
                    ))}
                    {data.matrix.map((row, i) => (
                      <>
                        <div key={`lbl-${i}`} className="flex items-center pr-2 text-[10px] font-medium text-white/35 truncate">
                          {data.labels[i]}
                        </div>
                        {row.map((r, j) => {
                          const isDiag = i === j
                          const m = isDiag ? null : CLASS_META[classify(r)]
                          return (
                            <div
                              key={`${i}-${j}`}
                              className={`flex items-center justify-center rounded-sm p-1.5 text-[10px] font-semibold tabular-nums ${
                                isDiag ? "bg-violet-500/15 text-violet-300" : `${m!.bgClass} ${m!.textClass}`
                              }`}
                            >
                              {isDiag ? "—" : r.toFixed(2)}
                            </div>
                          )
                        })}
                      </>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Plain-English portfolio interpretation */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                What this means for you
              </p>
              {counts["strong-pos"] + counts["moderate-pos"] > counts["independent"] + counts["moderate-neg"] + counts["strong-neg"] ? (
                <p className="text-xs text-white/40 leading-relaxed">
                  Many of your sectors tend to{" "}
                  <span className="text-amber-400 font-medium">move in the same direction</span>.
                  {" "}If markets fall broadly, most of your portfolio may be affected at once. Consider diversifying into sectors that don't track each other closely.
                </p>
              ) : counts["independent"] >= Math.floor(insights.length / 2) ? (
                <p className="text-xs text-white/40 leading-relaxed">
                  Your portfolio sectors are largely{" "}
                  <span className="text-emerald-400 font-medium">independent of each other</span>{" "}
                  — good diversification. A fall in one sector won&apos;t necessarily drag the others down.
                </p>
              ) : (
                <p className="text-xs text-white/40 leading-relaxed">
                  Your portfolio has a{" "}
                  <span className="text-teal-400 font-medium">mixed diversification profile</span>.
                  {" "}Some sectors move together while others provide balance — a healthy spread.
                </p>
              )}
            </div>
          </>
        )}

        {!loading && !error && data && data.labels.length < 2 && (
          <p className="py-8 text-center text-sm text-white/40">
            Not enough mappable sectors to compute relationships.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
