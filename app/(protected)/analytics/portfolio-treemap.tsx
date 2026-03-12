"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LayoutGrid } from "lucide-react"

interface TreemapItem {
  symbol: string
  invested: number
  pnlPct: number
  pnlValue: number
}

interface PortfolioTreemapProps {
  holdings: TreemapItem[]
}

function getHeatColor(pnlPct: number) {
  if (pnlPct >= 15)
    return {
      bg: "rgba(16,185,129,0.45)",
      text: "text-emerald-300",
      border: "rgba(16,185,129,0.6)",
    }
  if (pnlPct >= 5)
    return {
      bg: "rgba(16,185,129,0.25)",
      text: "text-emerald-400",
      border: "rgba(16,185,129,0.4)",
    }
  if (pnlPct >= 0)
    return {
      bg: "rgba(16,185,129,0.12)",
      text: "text-emerald-400/70",
      border: "rgba(16,185,129,0.25)",
    }
  if (pnlPct >= -5)
    return {
      bg: "rgba(239,68,68,0.12)",
      text: "text-red-400/70",
      border: "rgba(239,68,68,0.25)",
    }
  if (pnlPct >= -15)
    return {
      bg: "rgba(239,68,68,0.25)",
      text: "text-red-400",
      border: "rgba(239,68,68,0.4)",
    }
  return {
    bg: "rgba(239,68,68,0.45)",
    text: "text-red-300",
    border: "rgba(239,68,68,0.6)",
  }
}

export function PortfolioTreemap({ holdings }: PortfolioTreemapProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const totalInvested = useMemo(
    () => holdings.reduce((s, h) => s + h.invested, 0),
    [holdings],
  )

  const sorted = useMemo(
    () => [...holdings].sort((a, b) => b.invested - a.invested).slice(0, 30),
    [holdings],
  )

  if (sorted.length === 0) return null

  const fmtCr = (n: number) => {
    if (Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
    if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
    return `₹${n.toFixed(0)}`
  }

  return (
    <Card className="glow-border-card glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono font-semibold flex items-center gap-2 text-[#00ffcc]/80 uppercase tracking-widest">
          <LayoutGrid className="h-4 w-4" /> Portfolio Heatmap
          <span className="text-[10px] font-normal text-[#00ffcc]/40 ml-1 normal-case tracking-normal">
            (sized by investment, colored by return %)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1" style={{ minHeight: 200 }}>
          {sorted.map((h, i) => {
            const pct =
              totalInvested > 0 ? (h.invested / totalInvested) * 100 : 0
            const minW = Math.max(pct * 3, 48)
            const color = getHeatColor(h.pnlPct)
            const isHovered = hovered === h.symbol

            return (
              <motion.div
                key={h.symbol}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02, duration: 0.25 }}
                className="relative rounded-md overflow-hidden cursor-default transition-all duration-200 border"
                style={{
                  flex: `${pct} 1 ${minW}px`,
                  minHeight: pct > 5 ? 80 : 60,
                  backgroundColor: color.bg,
                  borderColor: isHovered ? color.border : "transparent",
                  transform: isHovered ? "scale(1.02)" : "scale(1)",
                  zIndex: isHovered ? 10 : 1,
                }}
                onMouseEnter={() => setHovered(h.symbol)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
                  <span className="text-[11px] font-bold font-mono text-white/90 truncate max-w-full leading-tight">
                    {h.symbol}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold ${color.text}`}
                  >
                    {h.pnlPct >= 0 ? "+" : ""}
                    {h.pnlPct.toFixed(1)}%
                  </span>
                  {isHovered && (
                    <span className="text-[9px] font-mono text-white/50 mt-0.5">
                      {fmtCr(h.invested)}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-3">
          {[
            { label: "< -10%", cls: "bg-red-500/50" },
            { label: "-5%", cls: "bg-red-400/30" },
            { label: "0%", cls: "bg-white/10" },
            { label: "+5%", cls: "bg-emerald-400/30" },
            { label: "> +10%", cls: "bg-emerald-500/50" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-5 rounded-sm ${l.cls}`} />
              <span className="text-[9px] font-mono text-white/40">
                {l.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
