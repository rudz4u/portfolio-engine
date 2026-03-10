"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TechSignal } from "@/lib/hooks/use-tech-signals"

const SIGNAL_CONFIG = {
  bullish: {
    label: "Bullish",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    icon: TrendingUp,
  },
  bearish: {
    label: "Bearish",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    icon: TrendingDown,
  },
  neutral: {
    label: "Neutral",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    icon: Minus,
  },
} as const

/** Compact signal badge — shows direction + optional RSI */
export function SignalBadge({
  signal,
  showRsi = false,
  size = "sm",
  className,
}: {
  signal: TechSignal
  showRsi?: boolean
  size?: "xs" | "sm"
  className?: string
}) {
  const cfg = SIGNAL_CONFIG[signal.overallSignal]
  const Icon = cfg.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        cfg.bg, cfg.color,
        size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
        className,
      )}
      title={signal.signalSummary}
    >
      <Icon className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {cfg.label}
      {showRsi && signal.rsi != null && (
        <span className="opacity-70 ml-0.5">RSI {Math.round(signal.rsi)}</span>
      )}
    </span>
  )
}

/** RSI bar indicator — thin colored bar */
export function RsiIndicator({ rsi, rsiSignal }: { rsi: number | null; rsiSignal: string }) {
  if (rsi == null) return <span className="text-xs text-muted-foreground">—</span>

  const color =
    rsiSignal === "overbought" ? "text-red-400" :
    rsiSignal === "oversold" ? "text-emerald-400" :
    "text-yellow-400"

  const barColor =
    rsiSignal === "overbought" ? "bg-red-400" :
    rsiSignal === "oversold" ? "bg-emerald-400" :
    "bg-yellow-400"

  return (
    <div className="flex items-center gap-1.5" title={`RSI(14): ${rsi.toFixed(1)} — ${rsiSignal}`}>
      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${rsi}%` }} />
      </div>
      <span className={cn("text-xs tabular-nums font-medium", color)}>{Math.round(rsi)}</span>
    </div>
  )
}

/** Compact signal tooltip explanation */
export function SignalExplainer({ signal }: { signal: TechSignal }) {
  const parts: string[] = []

  if (signal.rsi != null) {
    parts.push(
      signal.rsiSignal === "overbought" ? `RSI ${Math.round(signal.rsi)} (Overbought — may pull back)` :
      signal.rsiSignal === "oversold" ? `RSI ${Math.round(signal.rsi)} (Oversold — potential bounce)` :
      `RSI ${Math.round(signal.rsi)} (Neutral)`
    )
  }

  parts.push(
    signal.macdTrend === "bullish" ? "MACD bullish crossover" :
    signal.macdTrend === "bearish" ? "MACD bearish crossover" :
    "MACD neutral"
  )

  if (signal.volumeTrend === "high") parts.push("Volume surge detected")

  if (signal.topPattern) {
    parts.push(`Pattern: ${signal.topPattern} (${signal.topPatternDirection})`)
  }

  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      {parts.map((p, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
          {p}
        </div>
      ))}
    </div>
  )
}
