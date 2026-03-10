"use client"

import { useEffect, useRef, useCallback, useState, useMemo } from "react"
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
  ColorType,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts"
import type { CandleData, PatternSignal, TechnicalIndicators, TimeframePreset } from "@/lib/candles/types"
import { TIMEFRAME_PRESETS } from "@/lib/candles/types"
import { cn } from "@/lib/utils"

/* ── Theme constants ────────────────────────────────────────────────── */
const CHART_BG = "#060b15"
const CHART_GRID = "rgba(255,255,255,0.04)"
const CHART_BORDER = "#1c2a3f"
const CHART_TEXT = "#8fa3ba"
const CHART_CROSSHAIR = "rgba(255,255,255,0.25)"

const GREEN = "#00ffcc"
const RED = "#f43f5e"
const PURPLE = "#7c3aed"
const SMA20_COLOR = "#facc15"  // yellow
const SMA50_COLOR = "#3b82f6"  // blue
const SMA200_COLOR = "#f97316" // orange
const BB_UPPER = "rgba(124,58,237,0.5)"
const BB_LOWER = "rgba(124,58,237,0.5)"

/* ── Overlay toggle options ─────────────────────────────────────────── */
type OverlayKey = "sma20" | "sma50" | "sma200" | "bollinger"
const OVERLAY_OPTIONS: { key: OverlayKey; label: string; color: string }[] = [
  { key: "sma20",     label: "SMA 20",    color: SMA20_COLOR },
  { key: "sma50",     label: "SMA 50",    color: SMA50_COLOR },
  { key: "sma200",    label: "SMA 200",   color: SMA200_COLOR },
  { key: "bollinger", label: "Bollinger",  color: PURPLE },
]

/* ── Types ──────────────────────────────────────────────────────────── */
interface Props {
  candles: CandleData[]
  patterns?: PatternSignal[]
  indicators?: TechnicalIndicators
  smaArrays?: { sma20?: number[]; sma50?: number[]; sma200?: number[] }
  bollingerArray?: { upper: number; middle: number; lower: number }[]
  timeframe?: string
  timeframes?: TimeframePreset[]
  onTimeframeChange?: (preset: TimeframePreset) => void
  className?: string
  height?: number
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function toChartTime(ts: string): Time {
  // lightweight-charts uses UTC seconds or "YYYY-MM-DD"
  const d = new Date(ts)
  return (d.getTime() / 1000) as Time
}

function formatCandleForChart(c: CandleData): CandlestickData {
  return {
    time: toChartTime(c.timestamp),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }
}

function formatVolumeBar(c: CandleData): HistogramData {
  return {
    time: toChartTime(c.timestamp),
    value: c.volume,
    color: c.close >= c.open ? "rgba(0,255,204,0.3)" : "rgba(244,63,94,0.3)",
  }
}

/* ── Component ──────────────────────────────────────────────────────── */
export function CandlestickChart({
  candles,
  patterns = [],
  indicators,
  smaArrays,
  bollingerArray,
  timeframe,
  timeframes = TIMEFRAME_PRESETS,
  onTimeframeChange,
  className,
  height = 480,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const overlaySeries = useRef<Map<string, ISeriesApi<"Line">>>(new Map())

  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(new Set(["sma20"]))

  /* ── Chart data ───────────────────────────────────────────────────── */
  const chartCandles = useMemo(
    () => candles.map(formatCandleForChart),
    [candles],
  )
  const volumeData = useMemo(
    () => candles.map(formatVolumeBar),
    [candles],
  )

  /* ── Init chart ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: CHART_TEXT,
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: CHART_GRID },
        horzLines: { color: CHART_GRID },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CHART_CROSSHAIR, labelBackgroundColor: PURPLE },
        horzLine: { color: CHART_CROSSHAIR, labelBackgroundColor: PURPLE },
      },
      rightPriceScale: {
        borderColor: CHART_BORDER,
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: CHART_BORDER,
        timeVisible: true,
        secondsVisible: false,
      },
    })

    /* Candlestick series */
    const candleSeries = chart.addCandlestickSeries({
      upColor: GREEN,
      downColor: RED,
      borderUpColor: GREEN,
      borderDownColor: RED,
      wickUpColor: GREEN,
      wickDownColor: RED,
    })
    candleSeries.setData(chartCandles)
    candleSeriesRef.current = candleSeries

    /* Volume histogram (overlaid at bottom) */
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    })
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    volumeSeries.setData(volumeData)
    volumeSeriesRef.current = volumeSeries

    /* Pattern markers */
    if (patterns.length > 0) {
      const markers = patterns.map((p) => {
        const candle = candles[p.endIndex]
        if (!candle) return null
        const isBullish = p.direction === "bullish"
        return {
          time: toChartTime(candle.timestamp),
          position: isBullish ? ("belowBar" as const) : ("aboveBar" as const),
          color: isBullish ? GREEN : RED,
          shape: isBullish ? ("arrowUp" as const) : ("arrowDown" as const),
          text: p.name,
        }
      }).filter(Boolean) as Parameters<typeof candleSeries.setMarkers>[0]

      // sort by time (required by lightweight-charts)
      markers.sort((a, b) => (a.time as number) - (b.time as number))
      candleSeries.setMarkers(markers)
    }

    /* Fit content */
    chart.timeScale().fitContent()
    chartRef.current = chart

    /* Handle resize */
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      overlaySeries.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, patterns, height])

  /* ── Overlay management ───────────────────────────────────────────── */
  const drawOverlay = useCallback(
    (key: OverlayKey) => {
      const chart = chartRef.current
      if (!chart || candles.length === 0) return

      // Remove existing
      const existing = overlaySeries.current.get(key)
      if (existing) {
        chart.removeSeries(existing)
        overlaySeries.current.delete(key)
      }

      if (key === "bollinger" && bollingerArray && bollingerArray.length > 0) {
        // Draw upper & lower as two lines
        const offset = candles.length - bollingerArray.length
        const upperData: LineData[] = []
        const lowerData: LineData[] = []
        for (let i = 0; i < bollingerArray.length; i++) {
          const t = toChartTime(candles[i + offset].timestamp)
          upperData.push({ time: t, value: bollingerArray[i].upper })
          lowerData.push({ time: t, value: bollingerArray[i].lower })
        }

        const upperSeries = chart.addLineSeries({
          color: BB_UPPER,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        upperSeries.setData(upperData)
        overlaySeries.current.set("bollinger", upperSeries)

        const lowerSeries = chart.addLineSeries({
          color: BB_LOWER,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        lowerSeries.setData(lowerData)
        overlaySeries.current.set("bollinger_lower", lowerSeries)
        return
      }

      // SMA overlays
      const smaMap: Record<string, { data?: number[]; color: string }> = {
        sma20:  { data: smaArrays?.sma20,  color: SMA20_COLOR },
        sma50:  { data: smaArrays?.sma50,  color: SMA50_COLOR },
        sma200: { data: smaArrays?.sma200, color: SMA200_COLOR },
      }
      const entry = smaMap[key]
      if (!entry?.data || entry.data.length === 0) return

      const offset = candles.length - entry.data.length
      const lineData: LineData[] = entry.data.map((v, i) => ({
        time: toChartTime(candles[i + offset].timestamp),
        value: v,
      }))

      const series = chart.addLineSeries({
        color: entry.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      series.setData(lineData)
      overlaySeries.current.set(key, series)
    },
    [candles, smaArrays, bollingerArray],
  )

  const removeOverlay = useCallback((key: OverlayKey) => {
    const chart = chartRef.current
    if (!chart) return
    const existing = overlaySeries.current.get(key)
    if (existing) {
      chart.removeSeries(existing)
      overlaySeries.current.delete(key)
    }
    // Extra cleanup for bollinger lower band
    if (key === "bollinger") {
      const lower = overlaySeries.current.get("bollinger_lower")
      if (lower) {
        chart.removeSeries(lower)
        overlaySeries.current.delete("bollinger_lower")
      }
    }
  }, [])

  /* Re-draw overlays when toggles change */
  useEffect(() => {
    for (const opt of OVERLAY_OPTIONS) {
      if (activeOverlays.has(opt.key)) {
        drawOverlay(opt.key)
      } else {
        removeOverlay(opt.key)
      }
    }
  }, [activeOverlays, drawOverlay, removeOverlay])

  const toggleOverlay = (key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Toolbar row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Timeframe tabs */}
        {onTimeframeChange && (
          <div className="flex rounded-lg border border-border/50 overflow-hidden">
            {timeframes.map((tf) => (
              <button
                key={tf.label}
                onClick={() => onTimeframeChange(tf)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  tf.label === timeframe
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}

        {/* Overlay toggles */}
        <div className="flex items-center gap-1 ml-auto">
          {OVERLAY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleOverlay(opt.key)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md border transition-all",
                activeOverlays.has(opt.key)
                  ? "border-current text-foreground"
                  : "border-border/30 text-muted-foreground hover:border-border",
              )}
              style={
                activeOverlays.has(opt.key)
                  ? { borderColor: opt.color, color: opt.color }
                  : undefined
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden border border-border/30"
        style={{ minHeight: height }}
      />

      {/* Pattern legend */}
      {patterns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {patterns.map((p, i) => (
            <span
              key={`${p.name}-${i}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                p.direction === "bullish"
                  ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                  : p.direction === "bearish"
                    ? "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20"
                    : "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
              )}
              title={p.description}
            >
              <span>{p.direction === "bullish" ? "▲" : p.direction === "bearish" ? "▼" : "◆"}</span>
              {p.name}
              <span className="opacity-60">{Math.round(p.confidence * 100)}%</span>
            </span>
          ))}
        </div>
      )}

      {/* Quick indicator badges */}
      {indicators && (
        <div className="flex flex-wrap gap-2 text-xs">
          {indicators.rsi !== null && (
            <span
              className={cn(
                "rounded-md px-2 py-1 font-mono",
                indicators.rsiSignal === "overbought"
                  ? "bg-rose-500/10 text-rose-400"
                  : indicators.rsiSignal === "oversold"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-muted text-muted-foreground",
              )}
            >
              RSI {indicators.rsi.toFixed(1)}
            </span>
          )}
          {indicators.macd && (
            <span
              className={cn(
                "rounded-md px-2 py-1 font-mono",
                indicators.macdTrend === "bullish"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : indicators.macdTrend === "bearish"
                    ? "bg-rose-500/10 text-rose-400"
                    : "bg-muted text-muted-foreground",
              )}
            >
              MACD {indicators.macd.histogram > 0 ? "+" : ""}{indicators.macd.histogram.toFixed(2)}
            </span>
          )}
          {indicators.atr !== null && (
            <span className="rounded-md px-2 py-1 font-mono bg-muted text-muted-foreground">
              ATR {indicators.atr.toFixed(2)}
            </span>
          )}
          <span
            className={cn(
              "rounded-md px-2 py-1 font-mono",
              indicators.volumeTrend === "high"
                ? "bg-purple-500/10 text-purple-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            Vol {indicators.volumeTrend}
          </span>
        </div>
      )}
    </div>
  )
}
