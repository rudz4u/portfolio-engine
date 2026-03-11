"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Bot, TrendingUp, BarChart2, Bookmark, ArrowRight } from "lucide-react"

const R = 48
const CIRCUMFERENCE = 2 * Math.PI * R // ≈ 301.59

function scoreColor(s: number) {
  if (s >= 80) return "#10b981"
  if (s >= 60) return "#0ea5e9"
  if (s >= 40) return "#f59e0b"
  return "#ef4444"
}

function scoreLabel(s: number) {
  if (s >= 80) return "Excellent"
  if (s >= 60) return "Good"
  if (s >= 40) return "Fair"
  return "Needs Work"
}

const QUICK_ACTIONS = [
  {
    href:  "/assistant",
    label: "Ask Buddy",
    sub:   "AI co-pilot",
    icon:  Bot,
    from:  "#8b5cf6",
    to:    "#6366f1",
  },
  {
    href:  "/recommendations",
    label: "Signals",
    sub:   "Buy & exit ideas",
    icon:  TrendingUp,
    from:  "#10b981",
    to:    "#0d9488",
  },
  {
    href:  "/analysis",
    label: "Technicals",
    sub:   "Chart any stock",
    icon:  BarChart2,
    from:  "#0ea5e9",
    to:    "#3b82f6",
  },
  {
    href:  "/watchlist",
    label: "Watchlist",
    sub:   "Stocks to watch",
    icon:  Bookmark,
    from:  "#f59e0b",
    to:    "#f97316",
  },
]

interface DashboardHeroProps {
  name:  string
  score: number
}

export function DashboardHero({ name, score }: DashboardHeroProps) {
  const [greeting, setGreeting] = useState("Welcome back")
  const [dateStr,  setDateStr]  = useState("")

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening")
    setDateStr(
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day:     "numeric",
        month:   "long",
        year:    "numeric",
      })
    )
  }, [])

  const dashOffset = CIRCUMFERENCE * (1 - score / 100)
  const color      = scoreColor(score)
  const label      = scoreLabel(score)

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] card-elevated">
      {/* Animated backgrounds */}
      <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
      <div className="absolute inset-0 mesh-bg pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 px-6 py-6">

        {/* ── Greeting ──────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {dateStr && (
            <p className="text-[10px] font-mono text-primary/50 uppercase tracking-widest mb-2">
              {dateStr}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight leading-tight">
            {greeting},{" "}
            <span className="gradient-text">{name}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
            Your portfolio command centre. Everything you need, at a glance.
          </p>
          {/* live pulse badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-ring"
              style={{ boxShadow: "0 0 6px #10b981" }}
            />
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
              Live
            </span>
          </div>
        </div>

        {/* ── Health Score Ring ─────────────────────── */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <svg width="130" height="130" viewBox="0 0 120 120" className="overflow-visible">
            {/* Track */}
            <circle
              cx="60" cy="60" r={R}
              fill="none"
              stroke="hsl(220 28% 18%)"
              strokeWidth="9"
            />
            {/* Glow / arc */}
            <motion.circle
              cx="60" cy="60" r={R}
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE}`}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.6, ease: "easeOut", delay: 0.4 }}
              style={{
                transformOrigin: "60px 60px",
                transform:       "rotate(-90deg)",
                filter:          `drop-shadow(0 0 8px ${color}80)`,
              }}
            />
            {/* Score number */}
            <text
              x="60" y="56"
              textAnchor="middle"
              fontSize="28"
              fontWeight="800"
              fill={color}
              fontFamily="ui-monospace, monospace"
              style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
            >
              {score}
            </text>
            <text
              x="60" y="71"
              textAnchor="middle"
              fontSize="9"
              fill="rgba(255,255,255,0.30)"
              fontFamily="system-ui"
              letterSpacing="1.5"
            >
              OUT OF 100
            </text>
          </svg>
          <p className="text-[11px] font-semibold tracking-wide" style={{ color }}>
            Portfolio Health · {label}
          </p>
        </div>

        {/* ── Quick Actions ────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 w-full lg:w-auto lg:min-w-[280px]">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.href}
                href={a.href}
                className="glow-border-card group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 transition-all duration-200 hover:bg-white/[0.07]"
              >
                <div
                  className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                  style={{
                    background: `linear-gradient(135deg, ${a.from}, ${a.to})`,
                    boxShadow:  `0 2px 10px ${a.from}50`,
                  }}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground leading-none">{a.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{a.sub}</p>
                </div>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/30 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
