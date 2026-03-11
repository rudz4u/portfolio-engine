"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronRight, ChevronLeft } from "lucide-react"

interface TutorialStep {
  selector: string
  title: string
  description: string
  position: "right" | "bottom" | "left" | "top"
}

const STEPS: TutorialStep[] = [
  {
    selector: "tour-dashboard",
    title: "Dashboard",
    description:
      "Your home screen — live portfolio value, today's gains & losses, top movers, and your overall health score, all at a glance.",
    position: "right",
  },
  {
    selector: "tour-portfolio",
    title: "Portfolio",
    description:
      "All your holdings in one place. Import from your broker, organise by segment, and track cost vs current value.",
    position: "right",
  },
  {
    selector: "tour-watchlist",
    title: "Watchlist",
    description:
      "Add stocks you're curious about — without committing capital. Set price targets and monitor signals before you act.",
    position: "right",
  },
  {
    selector: "tour-analytics",
    title: "Analytics",
    description:
      "Understand your portfolio at a glance — sector spread, risk distribution, momentum scores, and performance over time.",
    position: "right",
  },
  {
    selector: "tour-analysis",
    title: "Technicals",
    description:
      "Chart any stock with candlestick patterns, RSI, Bollinger Bands, and SMA overlays across multiple timeframes.",
    position: "right",
  },
  {
    selector: "tour-recommendations",
    title: "Signals",
    description:
      "AI-ranked buy, hold, and exit signals built on momentum, value, and quality — refreshed daily so you never miss a move.",
    position: "right",
  },
  {
    selector: "tour-trade",
    title: "Trade",
    description:
      "Place orders through your connected broker and track every execution — with a confirmation step before anything goes live.",
    position: "right",
  },
  {
    selector: "tour-assistant",
    title: "AI Assistant",
    description:
      "Ask Buddy anything — portfolio health checks, stock deep-dives, or what-if scenarios. Your personal finance co-pilot.",
    position: "right",
  },
]

interface SpotlightTutorialProps {
  onComplete: () => void
}

export function SpotlightTutorial({ onComplete }: SpotlightTutorialProps) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const updateRect = useCallback(() => {
    const el = document.querySelector(
      `[data-tutorial="${STEPS[step]?.selector}"]`
    )
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
      // Brief delay so the smooth-scroll settles before measuring
      setTimeout(() => setRect(el.getBoundingClientRect()), 180)
    } else {
      setRect(null)
    }
  }, [step])

  useEffect(() => {
    updateRect()
    window.addEventListener("resize", updateRect)
    return () => window.removeEventListener("resize", updateRect)
  }, [updateRect])

  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  const handleComplete = () => {
    localStorage.setItem("buddy_tutorial_done", "true")
    onComplete()
  }

  const tooltipStyle = (): React.CSSProperties => {
    if (!rect) {
      return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
    }
    const PAD = 20
    const W = 300
    switch (current?.position) {
      case "right":
        return {
          left: `${rect.right + PAD}px`,
          top: `${rect.top + rect.height / 2}px`,
          transform: "translateY(-50%)",
        }
      case "left":
        return {
          left: `${rect.left - PAD - W}px`,
          top: `${rect.top + rect.height / 2}px`,
          transform: "translateY(-50%)",
        }
      case "bottom":
        return {
          left: `${rect.left + rect.width / 2}px`,
          top: `${rect.bottom + PAD}px`,
          transform: "translateX(-50%)",
        }
      case "top":
        return {
          left: `${rect.left + rect.width / 2}px`,
          top: `${rect.top - PAD}px`,
          transform: "translate(-50%, -100%)",
        }
      default:
        return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
    }
  }

  return (
    <div className="fixed inset-0 z-[998]" style={{ pointerEvents: "none" }}>
      {/* Dim overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/65"
      />

      {/* Spotlight cutout — box-shadow overflow trick */}
      <AnimatePresence mode="wait">
        {rect && (
          <motion.div
            key={`spot-${step}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute",
              left: rect.left - 6,
              top: rect.top - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
              borderRadius: 10,
              outline: "2px solid hsl(var(--primary))",
              outlineOffset: 2,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`tip-${step}`}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            ...tooltipStyle(),
            pointerEvents: "all",
            zIndex: 999,
            maxWidth: 300,
            width: "max-content",
          }}
          className="rounded-2xl border border-white/10 bg-[hsl(222,47%,7%)] shadow-2xl shadow-black/70 p-5"
        >
          {/* Close */}
          <button
            onClick={handleComplete}
            className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Close tutorial"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Step counter */}
          <p className="text-[10px] font-mono text-violet-400 uppercase tracking-widest mb-1">
            {step + 1} of {STEPS.length}
          </p>

          <h3 className="text-base font-bold text-white mb-1.5 pr-6">{current?.title}</h3>
          <p className="text-sm text-white/60 leading-relaxed mb-4" style={{ width: 240 }}>
            {current?.description}
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-1 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 20 : 6,
                  backgroundColor:
                    i === step ? "#8b5cf6" : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={isFirst}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors shrink-0"
              aria-label="Previous step"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {isLast ? (
              <button
                onClick={handleComplete}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2 text-white text-xs font-semibold"
              >
                Done — Let&apos;s Go!
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2 text-white text-xs font-semibold flex items-center justify-center gap-1"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
