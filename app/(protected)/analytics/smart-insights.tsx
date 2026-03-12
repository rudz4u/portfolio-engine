"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  Zap,
  Target,
  Eye,
} from "lucide-react"
import type { TechSignal } from "@/lib/hooks/use-tech-signals"

interface InsightItem {
  icon: React.ElementType
  text: string
  type: "positive" | "negative" | "warning" | "info"
  priority: number
}

interface SmartInsightsProps {
  totalInvested: number
  totalPnL: number
  pnlPct: number
  holdingCount: number
  segmentCount: number
  winRate: number
  hhi: number
  sharpeProxy: number
  signals: Map<string, TechSignal>
  topConcentrationPct: number
  topConcentrationSymbol: string
}

const TYPE_STYLES = {
  positive: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  negative: "border-red-500/20 bg-red-500/5 text-red-400",
  warning: "border-amber-500/20 bg-amber-500/5 text-amber-400",
  info: "border-[#00ffcc]/20 bg-[#00ffcc]/5 text-[#00ffcc]/80",
}

export function SmartInsights(props: SmartInsightsProps) {
  const insights = useMemo(() => generateInsights(props), [props])

  if (insights.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {insights.slice(0, 6).map((insight, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
          className={`flex items-start gap-2.5 rounded-lg border p-3 ${TYPE_STYLES[insight.type]}`}
        >
          <insight.icon className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-xs font-mono leading-relaxed">{insight.text}</p>
        </motion.div>
      ))}
    </div>
  )
}

function generateInsights(props: SmartInsightsProps): InsightItem[] {
  const items: InsightItem[] = []

  // P&L summary
  if (props.pnlPct >= 0) {
    items.push({
      icon: TrendingUp,
      text: `Portfolio is up ${props.pnlPct.toFixed(1)}% — you're in the green across ${props.holdingCount} holdings`,
      type: "positive",
      priority: 1,
    })
  } else {
    items.push({
      icon: TrendingDown,
      text: `Portfolio is down ${Math.abs(props.pnlPct).toFixed(1)}% — review weak holdings for potential exits`,
      type: "negative",
      priority: 1,
    })
  }

  // Technical signals analysis
  let overbought = 0
  let oversold = 0
  let bullish = 0
  let bearish = 0
  let patternCount = 0
  props.signals.forEach((sig) => {
    if (sig.rsi != null && sig.rsi >= 70) overbought++
    if (sig.rsi != null && sig.rsi <= 30) oversold++
    if (sig.overallSignal === "bullish") bullish++
    if (sig.overallSignal === "bearish") bearish++
    patternCount += sig.patternCount
  })

  if (overbought > 0) {
    items.push({
      icon: AlertTriangle,
      text: `${overbought} stock${overbought > 1 ? "s" : ""} overbought (RSI > 70) — consider partial profit booking`,
      type: "warning",
      priority: 2,
    })
  }

  if (oversold > 0) {
    items.push({
      icon: Eye,
      text: `${oversold} stock${oversold > 1 ? "s" : ""} oversold (RSI < 30) — potential recovery candidates to watch`,
      type: "info",
      priority: 2,
    })
  }

  // Signal momentum
  if (bullish > bearish && bullish > 0) {
    items.push({
      icon: Zap,
      text: `${bullish} bullish vs ${bearish} bearish signals — overall momentum leans positive`,
      type: "positive",
      priority: 3,
    })
  } else if (bearish > bullish && bearish > 0) {
    items.push({
      icon: Zap,
      text: `${bearish} bearish vs ${bullish} bullish signals — market sentiment is cautious`,
      type: "warning",
      priority: 3,
    })
  }

  if (patternCount > 0) {
    items.push({
      icon: Brain,
      text: `${patternCount} candlestick pattern${patternCount > 1 ? "s" : ""} detected across holdings — check Technicals for details`,
      type: "info",
      priority: 3,
    })
  }

  // Concentration
  if (props.topConcentrationPct > 25) {
    items.push({
      icon: Target,
      text: `${props.topConcentrationSymbol} is ${props.topConcentrationPct.toFixed(0)}% of portfolio — high single-stock risk`,
      type: "warning",
      priority: 4,
    })
  }

  // HHI diversification
  if (props.hhi >= 0.18) {
    items.push({
      icon: Shield,
      text: `Portfolio concentrated (HHI ${props.hhi.toFixed(3)}) — consider diversifying across more stocks`,
      type: "warning",
      priority: 4,
    })
  } else if (props.hhi < 0.08) {
    items.push({
      icon: Shield,
      text: `Well diversified (HHI ${props.hhi.toFixed(3)}) — portfolio risk is spread nicely`,
      type: "positive",
      priority: 5,
    })
  }

  // Win rate
  if (props.winRate >= 60) {
    items.push({
      icon: TrendingUp,
      text: `Win rate ${props.winRate.toFixed(0)}% — majority of your picks are profitable`,
      type: "positive",
      priority: 5,
    })
  } else if (props.winRate < 40) {
    items.push({
      icon: TrendingDown,
      text: `Win rate only ${props.winRate.toFixed(0)}% — review underperformers for potential exits`,
      type: "negative",
      priority: 5,
    })
  }

  // Sharpe ratio
  if (props.sharpeProxy > 1) {
    items.push({
      icon: Brain,
      text: `Sharpe ratio ${props.sharpeProxy.toFixed(2)} — strong risk-adjusted returns`,
      type: "positive",
      priority: 6,
    })
  } else if (props.sharpeProxy < 0) {
    items.push({
      icon: Brain,
      text: `Negative Sharpe ratio (${props.sharpeProxy.toFixed(2)}) — returns don't justify the risk taken`,
      type: "negative",
      priority: 6,
    })
  }

  return items.sort((a, b) => a.priority - b.priority)
}
