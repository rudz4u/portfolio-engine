"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gauge } from "lucide-react"
import type { TechSignal } from "@/lib/hooks/use-tech-signals"

interface MomentumGridProps {
  signals: Map<string, TechSignal>
}

export function MomentumGrid({ signals }: MomentumGridProps) {
  const items = useMemo(() => {
    const arr = Array.from(signals.entries()).map(([symbol, sig]) => ({
      symbol,
      signal: sig.overallSignal,
      rsi: sig.rsi,
      patterns: sig.patternCount,
    }))
    const order = { bullish: 0, neutral: 1, bearish: 2 } as const
    return arr.sort(
      (a, b) => (order[a.signal] ?? 1) - (order[b.signal] ?? 1),
    )
  }, [signals])

  if (items.length === 0) return null

  return (
    <Card className="glow-border-card glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono font-semibold flex items-center gap-2 text-[#00ffcc]/80 uppercase tracking-widest">
          <Gauge className="h-4 w-4" /> Momentum Grid
          <span className="text-[10px] font-normal text-[#00ffcc]/40 ml-1 normal-case tracking-normal">
            (per-stock signal at a glance)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
          {items.map((item, i) => {
            const bg =
              item.signal === "bullish"
                ? "bg-emerald-500/15 border-emerald-500/25"
                : item.signal === "bearish"
                  ? "bg-red-500/15 border-red-500/25"
                  : "bg-white/[0.04] border-white/10"
            const textColor =
              item.signal === "bullish"
                ? "text-emerald-400"
                : item.signal === "bearish"
                  ? "text-red-400"
                  : "text-white/50"
            const dot =
              item.signal === "bullish"
                ? "bg-emerald-400"
                : item.signal === "bearish"
                  ? "bg-red-400"
                  : "bg-amber-400"

            return (
              <motion.div
                key={item.symbol}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.015, duration: 0.2 }}
                className={`rounded-md border p-2 text-center transition-all hover:scale-105 cursor-default ${bg}`}
                title={`${item.symbol} — ${item.signal.toUpperCase()}${item.rsi != null ? ` · RSI ${Math.round(item.rsi)}` : ""}${item.patterns ? ` · ${item.patterns} pattern${item.patterns > 1 ? "s" : ""}` : ""}`}
              >
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${dot} ${item.signal !== "neutral" ? "animate-pulse" : ""}`}
                  />
                </div>
                <p
                  className={`text-[10px] font-mono font-bold truncate ${textColor}`}
                >
                  {item.symbol}
                </p>
                {item.rsi != null && (
                  <p className="text-[8px] font-mono text-white/30 mt-0.5">
                    {Math.round(item.rsi)}
                  </p>
                )}
              </motion.div>
            )
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] font-mono text-white/40">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Bullish
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Neutral
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Bearish
          </div>
          <span className="text-white/20">|</span>
          <span>Numbers = RSI(14)</span>
        </div>
      </CardContent>
    </Card>
  )
}
