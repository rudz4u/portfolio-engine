"use client"

import { useRef, useEffect } from "react"
import { motion, useInView, useSpring, useTransform } from "framer-motion"

interface ScoreBarProps {
  /** 0–100 */
  score: number
  /** Tailwind bg colour class for the fill, e.g. "bg-emerald-500" */
  colorClass?: string
  /** Show the numeric label on the right */
  showLabel?: boolean
  height?: number
}

const SIGNAL_COLOR = (score: number) => {
  if (score >= 75) return "bg-emerald-500"
  if (score >= 55) return "bg-green-400"
  if (score >= 40) return "bg-amber-400"
  if (score >= 25) return "bg-orange-500"
  return "bg-red-500"
}

export function ScoreBar({ score, colorClass, showLabel = true, height = 6 }: ScoreBarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const spring = useSpring(0, { stiffness: 60, damping: 18 })
  const widthPct = useTransform(spring, (v: number) => `${v}%`)
  const displayVal = useTransform(spring, (v: number) => Math.round(v).toString())

  useEffect(() => {
    if (inView) spring.set(Math.min(Math.max(score, 0), 100))
  }, [inView, spring, score])

  const barColor = colorClass ?? SIGNAL_COLOR(score)

  return (
    <div ref={ref} className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full bg-white/[0.06] overflow-hidden"
        style={{ height }}
      >
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          style={{
            width: widthPct,
            boxShadow: `0 0 8px ${barColor.replace("bg-", "hsl(var(--")}`,
          }}
        />
      </div>
      {showLabel && (
        <motion.span className="text-xs font-bold tabular-nums font-mono w-7 text-right text-foreground/80">
          {displayVal}
        </motion.span>
      )}
    </div>
  )
}

/** Animated numeric P&L counter (springs from 0 to target on enter) */
export function PnLCounter({
  value,
  currency = "INR",
  className = "",
}: {
  value: number
  currency?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const spring = useSpring(0, { stiffness: 55, damping: 20 })
  const display = useTransform(spring, (v: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(v)
  )

  useEffect(() => {
    if (inView) spring.set(value)
  }, [inView, spring, value])

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  )
}
