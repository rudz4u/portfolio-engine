"use client"

import { useState, useEffect, useCallback } from "react"

/** Lightweight signal summary for portfolio/watchlist rows */
export interface TechSignal {
  symbol: string
  overallSignal: "bullish" | "bearish" | "neutral"
  signalSummary: string
  rsi: number | null
  rsiSignal: "oversold" | "neutral" | "overbought"
  macdTrend: "bullish" | "bearish" | "neutral"
  volumeTrend: "high" | "normal" | "low"
  patternCount: number
  topPattern?: string
  topPatternDirection?: "bullish" | "bearish" | "neutral"
}

/**
 * Hook that batch-fetches technical signals for a list of trading symbols.
 * Splits into chunks of 15 to stay within API limits and fetches in sequence.
 */
export function useTechSignals(symbols: string[]) {
  const [signals, setSignals] = useState<Map<string, TechSignal>>(new Map())
  const [loading, setLoading] = useState(false)

  const fetchSignals = useCallback(async () => {
    if (symbols.length === 0) return
    setLoading(true)

    const map = new Map<string, TechSignal>()
    const CHUNK = 15

    try {
      for (let i = 0; i < symbols.length; i += CHUNK) {
        const chunk = symbols.slice(i, i + CHUNK)
        const res = await fetch(
          `/api/analysis/technicals?symbols=${encodeURIComponent(chunk.join(","))}&timeframe=1D`,
        )
        if (!res.ok) continue
        const json = await res.json()
        if (json.status !== "success") continue

        for (const a of json.data.analyses ?? []) {
          const topPattern = a.patterns?.[0]
          map.set(a.tradingSymbol, {
            symbol: a.tradingSymbol,
            overallSignal: a.overallSignal,
            signalSummary: a.signalSummary,
            rsi: a.indicators?.rsi ?? null,
            rsiSignal: a.indicators?.rsiSignal ?? "neutral",
            macdTrend: a.indicators?.macdTrend ?? "neutral",
            volumeTrend: a.indicators?.volumeTrend ?? "normal",
            patternCount: a.patterns?.length ?? 0,
            topPattern: topPattern?.name,
            topPatternDirection: topPattern?.direction,
          })
        }
      }
    } catch {
      // non-critical — signals are additive UX
    }

    setSignals(map)
    setLoading(false)
  }, [symbols])

  useEffect(() => {
    fetchSignals()
  }, [fetchSignals])

  return { signals, loading, refetch: fetchSignals }
}
