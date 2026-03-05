"use client"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { motion, useInView, useSpring, useTransform, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { BetaBadge } from "@/components/beta-badge"
import {
  TrendingUp, Shield, Bot, BarChart3, ArrowRight, CheckCircle2,
  Zap, Activity, Brain, Search, Lock, Plug, ShieldCheck,
  LineChart, Sparkles, ChevronRight, Star, Users,
  Globe, AlertCircle, Loader2, Terminal, Cpu, ChevronUp,
} from "lucide-react"
import {
  fadeUp, fadeIn, scaleIn, slideLeft, slideRight, staggerMed, staggerContainer, viewport,
} from "@/lib/motion"

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "InvestBuddy AI",
  "url": "https://investbuddyai.com",
  "description": "AI-powered equity portfolio management for Indian markets. Quant signals, advisory intelligence, live P&L, and multi-broker integration.",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
  "featureList": ["Live portfolio tracking", "RSI MACD Bollinger Band signals", "AI buy/sell recommendations", "Advisory intelligence aggregation", "Upstox OAuth integration", "Sector and correlation analytics"],
  "inLanguage": "en-IN",
  "author": { "@type": "Organization", "name": "InvestBuddy AI", "url": "https://investbuddyai.com" },
}

const SIGNAL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: "bg-emerald-400/10", border: "border-emerald-400/40", text: "text-emerald-400" },
  green:   { bg: "bg-green-400/10",   border: "border-green-400/40",   text: "text-green-400" },
  amber:   { bg: "bg-amber-400/10",   border: "border-amber-400/40",   text: "text-amber-400" },
  orange:  { bg: "bg-orange-400/10",  border: "border-orange-400/40",  text: "text-orange-400" },
  red:     { bg: "bg-red-400/10",     border: "border-red-400/40",     text: "text-red-400" },
  muted:   { bg: "bg-white/[0.04]",   border: "border-border",         text: "text-muted-foreground" },
}

/* ── Typewriter hook ── */
function useTypewriter(phrases: string[], speed = 60, pause = 2200) {
  const [charIdx, setCharIdx] = useState(0)
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const current = phrases[phraseIdx]
    let t: ReturnType<typeof setTimeout>
    if (!deleting && charIdx < current.length) {
      t = setTimeout(() => setCharIdx(i => i + 1), speed)
    } else if (!deleting && charIdx === current.length) {
      t = setTimeout(() => setDeleting(true), pause)
    } else if (deleting && charIdx > 0) {
      t = setTimeout(() => setCharIdx(i => i - 1), speed / 2)
    } else {
      setDeleting(false)
      setPhraseIdx(i => (i + 1) % phrases.length)
    }
    return () => clearTimeout(t)
  }, [charIdx, deleting, phraseIdx, phrases, speed, pause])
  return phrases[phraseIdx].substring(0, charIdx)
}

/* ── Cyber grid background ── */
function CyberBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 cyber-grid opacity-70" />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.22, 0.12] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-15%] left-[15%] w-[700px] h-[700px] rounded-full"
        style={{ background: "radial-gradient(ellipse, hsl(263 70% 60% / 0.18), transparent 65%)" }}
      />
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute bottom-[-10%] right-[5%] w-[550px] h-[550px] rounded-full"
        style={{ background: "radial-gradient(ellipse, hsl(210 80% 55% / 0.15), transparent 65%)" }}
      />
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        className="absolute top-[45%] right-[30%] w-[300px] h-[300px] rounded-full"
        style={{ background: "radial-gradient(ellipse, hsl(142 69% 44% / 0.1), transparent 65%)" }}
      />
    </div>
  )
}

/* ── Broker marquee ── */
const BROKERS = [
  { name: "Upstox",          status: "LIVE",    bg: "#5D2BE9", letter: "U", live: true,  logoUrl: "https://assets.upstox.com/website/images/upstox-new-logo.svg" },
  { name: "Zerodha",         status: "Q2 2026", bg: "#387ed1", letter: "Z", live: false, logoUrl: "https://zerodha.com/static/images/logo.svg" },
  { name: "Angel One",       status: "Q3 2026", bg: "#E55A00", letter: "A", live: false, logoUrl: "https://w3assets.angelone.in/wp-content/uploads/2024/04/IPL_COMPOSITE-LOGO_ANGELONE_HORIZONTAL_WHITE_VERSION-192x100-1.png" },
  { name: "Groww",           status: "Q3 2026", bg: "#00D09C", letter: "G", live: false, logoUrl: "https://resources.groww.in/web-assets/img/website-logo/groww_logo.webp" },
  { name: "Dhan",            status: "Q3 2026", bg: "#0052D4", letter: "D", live: false, logoUrl: "https://dhan.co/_next/static/media/Dhanlogo.8a85768d.svg" },
  { name: "ICICI Direct",    status: "Q4 2026", bg: "#B5451B", letter: "I", live: false, logoUrl: "https://www.icicidirect.com/Content/images/ICICI-logo-white.svg" },
  { name: "Sharekhan",       status: "Q4 2026", bg: "#E30613", letter: "S", live: false, logoUrl: "https://www.sharekhan.com/CmsApp/MediaGalary/images/sharekhan_logo-202207131537046949004.svg" },
  { name: "HDFC Securities", status: "2027",    bg: "#004C8F", letter: "H", live: false, logoUrl: "" },
  { name: "Motilal Oswal",   status: "2027",    bg: "#C7021A", letter: "M", live: false, logoUrl: "https://www.motilaloswal.com/media_16de0a321de10a0a08e55668008fbcaa32ec9c982.svg" },
  { name: "Kotak Securities",status: "2027",    bg: "#CA0015", letter: "K", live: false, logoUrl: "" },
]
function BrokerMarquee() {
  const doubled = [...BROKERS, ...BROKERS]
  return (
    <section className="py-14 border-t border-border/40" aria-label="Supported brokers">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport} className="text-center mb-8">
          <p className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-2">SUPPORTED TRADING PLATFORMS</p>
          <h2 className="text-xl sm:text-2xl font-bold">One Dashboard · <span className="gradient-text">Every Broker</span></h2>
        </motion.div>
        <div className="marquee-container">
          <div className="marquee-track gap-3 py-1">
            {doubled.map((broker, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 glass rounded-xl border border-border/60 mx-1.5 shrink-0 group hover:border-primary/40 transition-all duration-300 cursor-default">
                <div
                  className="h-10 w-24 rounded-xl flex items-center justify-center px-2 shadow-lg group-hover:scale-105 group-hover:shadow-xl transition-transform duration-300 overflow-hidden shrink-0"
                  style={{ backgroundColor: broker.bg }}
                >
                  {broker.logoUrl ? (
                    <img src={broker.logoUrl} alt={broker.name} className="h-7 w-auto max-w-[80px] object-contain" />
                  ) : (
                    <span className="text-white text-lg font-bold">{broker.letter}</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold whitespace-nowrap">{broker.name}</div>
                  <div className={`text-[10px] font-mono ${broker.live ? "text-emerald-400" : "text-muted-foreground/50"}`}>
                    {broker.live ? "● LIVE NOW" : broker.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const spring = useSpring(0, { stiffness: 60, damping: 20 })
  const display = useTransform(spring, (v: number) => Math.round(v).toString() + suffix)
  useEffect(() => { if (inView) spring.set(target) }, [inView, spring, target])
  return <motion.span ref={ref}>{display}</motion.span>
}

function ScoreGauge({ score, color = "violet" }: { score: number; color?: string }) {
  const R = 48
  const circ = 2 * Math.PI * R
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { once: true })
  const springVal = useSpring(circ, { stiffness: 50, damping: 18 })
  const dash = useTransform(springVal, (v: number) => `${v} ${circ}`)
  useEffect(() => { if (inView) springVal.set(circ - (score / 100) * circ) }, [inView, springVal, circ, score])
  const colorMap: Record<string, { stroke: string; glow: string }> = {
    violet:  { stroke: "#8b5cf6", glow: "#8b5cf640" },
    emerald: { stroke: "#10b981", glow: "#10b98140" },
    green:   { stroke: "#22c55e", glow: "#22c55e40" },
    amber:   { stroke: "#f59e0b", glow: "#f59e0b40" },
    blue:    { stroke: "#3b82f6", glow: "#3b82f640" },
    red:     { stroke: "#ef4444", glow: "#ef444440" },
  }
  const { stroke, glow } = colorMap[color] ?? colorMap.violet
  return (
    <div ref={wrapRef} className="relative w-28 h-28 mx-auto">
      <svg width="112" height="112" viewBox="0 0 112 112" fill="none" className="-rotate-90">
        <circle cx="56" cy="56" r={R} stroke="hsl(220 30% 12%)" strokeWidth="10" fill="none" />
        {/* glow layer */}
        <circle cx="56" cy="56" r={R} stroke={glow} strokeWidth="14" fill="none" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circ} ${circ}`} style={{ filter: `blur(6px)` }} />
        <motion.circle cx="56" cy="56" r={R} stroke={stroke} strokeWidth="10" fill="none"
          strokeLinecap="round"
          style={{ strokeDasharray: dash as unknown as string, filter: `drop-shadow(0 0 8px ${stroke}cc)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono tabular-nums" style={{ color: stroke, textShadow: `0 0 16px ${stroke}80` }}>{score}</span>
        <span className="text-[10px] text-muted-foreground font-mono">/ 100</span>
      </div>
    </div>
  )
}

function QuantTerminal() {
  const [symbol, setSymbol] = useState("")
  const [loading, setLoading] = useState(false)
  const [scanPct, setScanPct] = useState(0)
  const [result, setResult] = useState<null | {
    found: boolean; symbol?: string; name?: string; exchange?: string
    composite_score?: number | null; signal?: string; signal_color?: string
    note?: string; message?: string; suggestions?: string[]
  }>(null)

  useEffect(() => {
    if (!loading) { setScanPct(0); return }
    const iv = setInterval(() => setScanPct(p => Math.min(p + 4, 95)), 80)
    return () => clearInterval(iv)
  }, [loading])

  const SCAN_MSGS = ["QUERYING NSE UNIVERSE...", "COMPUTING MOMENTUM SIGNALS...", "RUNNING VALUATION MODEL...", "AGGREGATING ADVISORY DATA...", "GENERATING COMPOSITE SCORE..."]

  async function analyse(e: React.FormEvent) {
    e.preventDefault()
    if (!symbol.trim()) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch(`/api/public/score-preview?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`)
      if (!res.ok) throw new Error("API error")
      setResult(await res.json())
    } catch { setResult({ found: false, message: "CONNECTION ERROR — service unreachable. Try again." }) }
    setLoading(false); setScanPct(100)
  }

  const colors = result?.signal_color ? (SIGNAL_COLORS[result.signal_color] ?? SIGNAL_COLORS.muted) : SIGNAL_COLORS.muted
  const scoreColor = result?.signal_color === "emerald" ? "emerald" : result?.signal_color === "green" ? "green" : result?.signal_color === "amber" ? "amber" : result?.signal_color === "red" ? "red" : "violet"

  return (
    <section className="py-20 relative" aria-label="Quant score terminal">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-emerald-500/4 rounded-full blur-[80px]" />
      </div>
      <div className="max-w-3xl mx-auto px-4">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-full px-4 py-1.5 text-xs font-mono mb-5">
            <Terminal className="h-3 w-3" /> LIVE QUANT SCANNER · NO LOGIN REQUIRED
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Instant <span className="gradient-text">Quant Score</span> — Any NSE Stock
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Type any NSE ticker to get a composite score built from momentum, valuation, and advisory signals.
          </p>
        </motion.div>

        <motion.div variants={scaleIn} initial="hidden" whileInView="show" viewport={viewport}
          className="terminal-card scanline-overlay rounded-2xl overflow-hidden shadow-2xl">
          {/* Terminal header bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-emerald-400/10 bg-black/40">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-amber-500/70" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
            <span className="ml-3 text-[10px] font-mono text-emerald-400/40 tracking-widest uppercase">investbuddy · quant-scanner · v1.0</span>
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
              className="ml-auto text-[10px] font-mono text-emerald-400/70">● ONLINE</motion.span>
          </div>

          <div className="p-5 sm:p-7">
            {/* Command input */}
            <form onSubmit={analyse} className="flex items-center gap-3 mb-4">
              <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-400/20 bg-black/30 focus-within:border-emerald-400/50 transition-colors group">
                <span className="text-emerald-400/50 font-mono text-sm select-none">&gt;_</span>
                <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
                  placeholder="ENTER NSE SYMBOL..." maxLength={20} aria-label="NSE stock symbol"
                  className="flex-1 bg-transparent text-emerald-300 placeholder:text-emerald-400/25 font-mono text-sm outline-none" />
                {symbol && !loading && <span className="cursor-blink text-emerald-400 font-mono text-sm">&#9646;</span>}
              </div>
              <motion.button type="submit" disabled={loading || !symbol.trim()}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-sm font-bold disabled:opacity-40 flex items-center gap-2 hover:bg-emerald-500/25 transition-all shrink-0 shadow-lg">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                {loading ? "SCANNING" : "RUN"}
              </motion.button>
            </form>

            {/* Scan progress bar */}
            {loading && (
              <div className="mb-5">
                <div className="h-0.5 bg-emerald-400/10 rounded-full overflow-hidden mb-1.5">
                  <motion.div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                    style={{ width: `${scanPct}%` }} transition={{ duration: 0.08 }} />
                </div>
                <p className="text-[10px] font-mono text-emerald-400/40">
                  {SCAN_MSGS[Math.floor(scanPct / 22)] ?? "FINALISING..."}
                </p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* Score result */}
              {result && result.found && result.composite_score != null && (
                <motion.div key="score" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="border border-emerald-400/10 rounded-xl p-4 bg-black/20 mb-4">
                    <div className="text-[10px] font-mono text-emerald-400/40 mb-3">&gt;&gt; ANALYSIS COMPLETE · {new Date().toLocaleTimeString("en-IN")}</div>
                    <div className="flex flex-col sm:flex-row gap-6 items-center">
                      <ScoreGauge score={result.composite_score}
                        color={scoreColor === "emerald" ? "emerald" : scoreColor === "amber" ? "amber" : scoreColor === "red" ? "red" : "violet"} />
                      <div className="flex-1 text-center sm:text-left font-mono">
                        <div className="text-[10px] text-emerald-400/40 uppercase tracking-widest mb-1">{result.exchange} · {result.name}</div>
                        <div className="text-2xl font-bold text-emerald-200 mb-3">{result.symbol}</div>
                        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 300, delay: 0.3 }}
                          className={`inline-block text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-lg border shadow-lg ${colors.bg} ${colors.border} ${colors.text}`}>
                          ◈ {result.signal}
                        </motion.div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-5">
                    {[["MOMENTUM SCORE", "RSI · MACD · EMA cross"], ["VALUATION MODEL", "P/E · sector relative"], ["POSITION SIZING", "ATR · Beta · lot size"], ["ADVISORY AGGREGATE", "17+ SEBI advisors"]].map(([label, sub]) => (
                      <div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg border border-emerald-400/8 bg-black/20">
                        <div>
                          <div className="text-[10px] font-mono text-emerald-400/20 blur-[2px] select-none">{label}</div>
                          <div className="text-[9px] font-mono text-emerald-400/15 blur-[1.5px] select-none">{sub}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-14 rounded-full bg-emerald-400/8 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-400/15 blur-[1px]" style={{ width: `${50 + Math.random() * 40}%` }} />
                          </div>
                          <Lock className="h-3 w-3 text-emerald-400/20" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/signin?redirect=/recommendations"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono text-sm font-bold hover:bg-emerald-500/25 transition-all">
                    UNLOCK FULL BREAKDOWN <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}
              {/* Pending */}
              {result && result.found && result.composite_score == null && (
                <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="border border-amber-400/20 rounded-xl p-5 bg-black/20 text-center">
                  <div className="text-[10px] font-mono text-amber-400/50 mb-2">&gt;&gt; SYMBOL FOUND · SCORE PENDING GENERATION</div>
                  <p className="text-amber-400 font-mono text-sm mb-1">{result.symbol}</p>
                  <p className="text-xs text-emerald-400/40 font-mono mb-4">{result.note}</p>
                  <Link href="/signin" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 font-mono text-xs font-bold hover:bg-amber-500/25 transition-all">
                    SIGN UP TO TRIGGER ANALYSIS <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </motion.div>
              )}
              {/* Not found */}
              {result && !result.found && (
                <motion.div key="nf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="border border-red-400/15 rounded-xl p-5 bg-black/20">
                  <div className="text-[10px] font-mono text-red-400/40 mb-2">&gt;&gt; SYMBOL NOT FOUND</div>
                  <p className="text-sm font-mono text-red-300/60 mb-3">{result.message}</p>
                  {result.suggestions && (
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-emerald-400/40">DID YOU MEAN:</span>
                      {result.suggestions.map(s => (
                        <button key={s} onClick={() => { setSymbol(s); setResult(null) }}
                          className="text-[10px] font-mono text-emerald-400 border border-emerald-400/25 rounded px-2 py-0.5 hover:bg-emerald-400/10 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {!result && !loading && (
              <div className="mt-2">
                <div className="text-[10px] font-mono text-emerald-400/30 mb-2">QUICK SCAN:</div>
                <div className="flex gap-2 flex-wrap">
                  {["RELIANCE", "INFY", "HDFCBANK", "TCS", "IRFC", "ADANIENT"].map(sym => (
                    <button key={sym} onClick={() => setSymbol(sym)}
                      className="text-[10px] font-mono text-emerald-400/55 border border-emerald-400/15 hover:border-emerald-400/40 hover:text-emerald-300 rounded px-2.5 py-1 transition-all">
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}


export default function HomePage() {
  const typewriterText = useTypewriter([
    "RSI · MACD · Bollinger Bands",
    "AI Buy/Sell Recommendations",
    "17+ SEBI Advisory Sources",
    "Live Upstox Portfolio Sync",
    "Sector Correlation Analytics",
  ], 55, 2000)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CyberBackground />
      <div className="relative min-h-screen bg-background/96 text-foreground overflow-x-hidden z-10">

        {/* Navbar */}
        <motion.header variants={fadeIn} initial="hidden" animate="show"
          className="border-b border-border/40 backdrop-blur-xl bg-background/70 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 300 }} className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg glow-sm">
                <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold gradient-text">InvestBuddy AI</span>
              <BetaBadge />
            </motion.div>
            <motion.div variants={staggerMed} initial="hidden" animate="show" className="flex items-center gap-2">
              <motion.div variants={fadeIn}>
                <Button variant="ghost" size="sm" asChild><Link href="/signin">Sign In</Link></Button>
              </motion.div>
              <motion.div variants={fadeIn} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button size="sm" className="btn-gradient border-0 glow" asChild>
                  <Link href="/signin">Get Started <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.header>

        <main>
          {/* Hero */}
          <section className="relative py-24 sm:py-32 overflow-hidden" aria-label="InvestBuddy AI hero">
            <div className="relative max-w-4xl mx-auto px-4 text-center">
              {/* Live badge */}
              <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-8">
                <span className="inline-flex items-center gap-2 bg-primary/10 border border-primary/25 text-primary rounded-full px-4 py-1.5 text-xs font-mono">
                  <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                  LIVE · Real-time quant signals · Multi-LLM AI · Upstox + more
                </span>
              </motion.div>
              {/* Headline */}
              <motion.div variants={staggerContainer(0.05, 0.1)} initial="hidden" animate="show">
                <motion.h1 variants={fadeUp}
                  className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4 leading-[1.06]">
                  <span className="block">AI Portfolio</span>
                  <span className="block gradient-text">Intelligence</span>
                  <span className="block text-2xl sm:text-3xl lg:text-4xl text-muted-foreground/60 font-semibold mt-2 font-mono">for Indian Equity Markets</span>
                </motion.h1>
              </motion.div>
              {/* Typewriter subtitle */}
              <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.4 }}
                className="h-7 flex items-center justify-center mb-10">
                <span className="text-sm sm:text-base font-mono text-primary/80">
                  {typewriterText}<span className="cursor-blink">▌</span>
                </span>
              </motion.div>
              {/* CTA buttons */}
              <motion.div variants={staggerContainer(0.08, 0.5)} initial="hidden" animate="show"
                className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
                <motion.div variants={fadeUp} whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" className="btn-gradient border-0 glow text-base px-7" asChild>
                    <Link href="/signin">Start Free — No Card Needed <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </motion.div>
                <motion.div variants={fadeUp} whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" variant="outline" className="border-border/60 hover:bg-white/5 hover:border-primary/40 text-base px-7" asChild>
                    <Link href="#how-it-works">See How It Works <ChevronRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </motion.div>
              </motion.div>
              {/* Floating mini cards */}
              <motion.div variants={staggerContainer(0.12, 0.7)} initial="hidden" animate="show"
                className="grid grid-cols-3 gap-3 max-w-2xl mx-auto mb-12">
                {[
                  { label: "Portfolio Value", value: "₹3.67L", sub: "+8.67%", subColor: "text-emerald-400" },
                  { label: "Today P&L",       value: "+₹1,847", sub: "44 holdings", subColor: "text-emerald-400" },
                  { label: "Quant Score",     value: "74/100",  sub: "STRONG BUY", subColor: "text-violet-400" },
                ].map((card, i) => (
                  <motion.div key={i} variants={fadeUp}
                    className="glass rounded-xl border border-border/70 px-3 py-3 shadow-xl backdrop-blur-xl text-left">
                    <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-1">{card.label}</div>
                    <div className="text-base font-bold font-mono gradient-text">{card.value}</div>
                    <div className={`text-[10px] font-mono ${card.subColor} mt-0.5`}>{card.sub}</div>
                  </motion.div>
                ))}
              </motion.div>
              {/* Stats row */}
              <motion.div variants={staggerContainer(0.1, 0.8)} initial="hidden" animate="show"
                className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-xl mx-auto">
                {[
                  { target: 50, suffix: "+", label: "Stocks tracked" },
                  { target: 6,  suffix: "",  label: "Quant signals" },
                  { target: 4,  suffix: "",  label: "AI providers" },
                  { target: 17, suffix: "+", label: "SEBI advisors" },
                ].map((s) => (
                  <motion.div key={s.label} variants={fadeUp} className="text-center">
                    <div className="text-2xl font-bold gradient-text font-mono tabular-nums">
                      <AnimatedCounter target={s.target} suffix={s.suffix} />
                    </div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5 font-mono">{s.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          <QuantTerminal />

          <BrokerMarquee />

          {/* How It Works */}
          <section id="how-it-works" className="py-20 border-t border-border/50" aria-label="How InvestBuddy AI works">
            <div className="max-w-5xl mx-auto px-4">
              <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport} className="text-center mb-14">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                  How <span className="gradient-text">InvestBuddy AI</span> Works
                </h2>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  From broker connection to AI-powered trade signal in three steps.
                </p>
              </motion.div>
              <div className="relative">
                <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={viewport}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }} style={{ originX: 0 }}
                  className="hidden sm:block absolute top-10 left-[16.5%] right-[16.5%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <motion.div variants={staggerContainer(0.12)} initial="hidden" whileInView="show" viewport={viewport}
                  className="grid sm:grid-cols-3 gap-8 sm:gap-12">
                  {[
                    { icon: Plug,        step: "01", title: "Connect Your Broker",    color: "from-violet-500 to-purple-600", desc: "OAuth with Upstox or Zerodha (coming soon). Or import holdings manually. Secure, read-first." },
                    { icon: LineChart,   step: "02", title: "Get Quant + AI Signals", color: "from-blue-500 to-cyan-500",     desc: "Composite scoring: RSI, MACD, valuation, sector correlation, and SEBI advisory intelligence." },
                    { icon: ShieldCheck, step: "03", title: "Trade with Confidence",  color: "from-emerald-500 to-teal-500",  desc: "Every order requires your explicit confirmation. AI suggests, you decide. Always." },
                  ].map((s) => (
                    <motion.div key={s.step} variants={fadeUp} className="text-center">
                      <motion.div initial={{ scale: 0.7, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }}
                        viewport={viewport} transition={{ type: "spring", stiffness: 400, damping: 10, delay: 0.1 }}
                        className={`h-14 w-14 mx-auto rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-5 shadow-lg`}>
                        <s.icon className="h-6 w-6 text-white" />
                      </motion.div>
                      <div className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1.5">Step {s.step}</div>
                      <h3 className="font-semibold text-sm mb-2">{s.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </div>
          </section>

          {/* Features Grid */}
          <section className="py-20 border-t border-border/50" aria-label="Platform features">
            <div className="max-w-6xl mx-auto px-4">
              <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport} className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                  Everything You Need to <span className="gradient-text">Trade Smarter</span>
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto text-sm">
                  A complete quant + AI platform built for Indian equity markets. NSE and BSE ready.
                </p>
              </motion.div>
              <motion.div variants={staggerContainer(0.06)} initial="hidden" whileInView="show" viewport={viewport}
                className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: TrendingUp, title: "Live Portfolio Tracking",        desc: "Sync from Upstox or add manually. Real-time P&L, segment allocation, performance breakdown.",                    color: "from-violet-500 to-purple-600" },
                  { icon: BarChart3,  title: "Quant Analysis Engine",          desc: "RSI, MACD, Bollinger Bands, ATR, Beta, Golden Cross — composite scoring across 6 dimensions.",              color: "from-blue-500 to-cyan-500" },
                  { icon: Brain,      title: "AI Buy/Sell Recommendations",    desc: "LLM signals with SEBI advisor intelligence, news sentiment, and quantitative backing — daily updates.",     color: "from-emerald-500 to-teal-500" },
                  { icon: Shield,     title: "Human-in-the-Loop Orders",       desc: "AI suggests. You decide. Every trade requires your explicit confirmation — always.",                         color: "from-orange-500 to-amber-500" },
                  { icon: Globe,      title: "Multi-Broker Integration",       desc: "Upstox live. Zerodha, Angel One, Dhan — coming in v0.2. One dashboard, all your holdings.",                 color: "from-pink-500 to-rose-500" },
                  { icon: Activity,   title: "Sector & Correlation Analytics", desc: "HHI concentration, Sharpe proxy, sector correlation heatmap — understand your real exposure.",             color: "from-indigo-500 to-violet-500" },
                  { icon: Bot,        title: "AI Morning Briefing",            desc: "Daily portfolio email + in-app chat assistant. Route to GPT-4, Claude, or Gemini.",                               color: "from-teal-500 to-cyan-500" },
                  { icon: Star,       title: "Advisory Intelligence",          desc: "Aggregate from 17+ SEBI-registered advisors. Track records scored and weighted for recency and accuracy.",       color: "from-amber-500 to-yellow-500" },
                ].map((f) => (
                  <motion.div key={f.title} variants={fadeUp}
                    whileHover={{ y: -6, boxShadow: "0 20px 48px -8px hsl(263 70% 62% / 0.18)" }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    className="glass rounded-xl p-6 cursor-default glow-border-card">
                    <motion.div whileHover={{ rotate: [-4, 4, -2, 0] }} transition={{ duration: 0.4 }}
                      className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg`}>
                      <f.icon className="h-5 w-5 text-white" />
                    </motion.div>
                    <h3 className="font-semibold mb-2 text-sm">{f.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* Detail */}
          <section className="py-20 border-t border-border/50" aria-label="Platform capability detail">
            <div className="max-w-6xl mx-auto px-4">
              <div className="grid lg:grid-cols-2 gap-14 items-center">
                <motion.div variants={slideLeft} initial="hidden" whileInView="show" viewport={viewport}>
                  <div className="inline-flex items-center gap-1.5 text-xs text-primary font-medium mb-4">
                    <Bot className="h-3.5 w-3.5" /> AI + QUANT + MULTI-BROKER
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-tight">
                    Your portfolio,<br /><span className="gradient-text">upgraded</span>
                  </h2>
                  <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                    InvestBuddy AI bridges your investment strategy with production-grade AI portfolio intelligence
                    — designed for Indian retail investors. Whatever broker you use, we work with you.
                  </p>
                  <motion.ul variants={staggerContainer(0.07)} initial="hidden" whileInView="show" viewport={viewport} className="space-y-2.5">
                    {[
                      "Upstox OAuth sync — live holdings, positions, orders",
                      "Zerodha, Angel One, Dhan — OAuth coming in v0.2",
                      "RSI, SMA, EMA, MACD, ATR, Bollinger Bands, Beta",
                      "India VIX-adjusted target pricing and stop-loss levels",
                      "Multi-LLM routing — OpenAI, Anthropic Claude, Gemini",
                      "Chat assistant: morning briefing and portfolio Q&A",
                      "SEBI advisor aggregate with recency-decay track-record scoring",
                      "Privacy-first — no data sold, no third-party ad tracking",
                    ].map((item) => (
                      <motion.li key={item} variants={fadeUp} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                        <span className="text-foreground/80">{item}</span>
                      </motion.li>
                    ))}
                  </motion.ul>
                </motion.div>
                <motion.div variants={slideRight} initial="hidden" whileInView="show" viewport={viewport}
                  className="glass rounded-2xl p-6 border border-border/80">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Portfolio Snapshot</span>
                    <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
                      className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">↑ Live</motion.span>
                  </div>
                  <motion.div variants={staggerContainer(0.08)} initial="hidden" whileInView="show" viewport={viewport} className="space-y-2.5">
                    {[
                      { label: "Total Invested",  value: "₹3,37,847",               positive: null },
                      { label: "Current Value",   value: "₹3,67,120",               positive: null },
                      { label: "Total P&L",       value: "+₹29,273",                positive: true },
                      { label: "Day P&L",         value: "+₹1,847",                 positive: true },
                      { label: "Active Holdings", value: "44 stocks",                    positive: null },
                      { label: "Portfolio Score", value: "74 / 100",                     positive: true },
                      { label: "Segments",        value: "6 (Defence, EV, Green…)", positive: null },
                      { label: "Broker",          value: "Upstox (connected)",           positive: null },
                    ].map((row) => (
                      <motion.div key={row.label} variants={fadeUp}
                        className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                        <span className="text-xs text-muted-foreground">{row.label}</span>
                        <span className={`text-xs font-semibold ${row.positive === true ? "text-emerald-400" : row.positive === false ? "text-red-400" : "text-foreground"}`}>
                          {row.value}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Trust strip */}
          <motion.section variants={fadeIn} initial="hidden" whileInView="show" viewport={viewport}
            className="py-8 border-t border-border/50">
            <div className="max-w-4xl mx-auto px-4">
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-[11px] text-muted-foreground/50 font-mono">
                {["NO DATA SOLD", "SUPABASE + NEXT.JS", "GPT-4o · CLAUDE · GEMINI", "NSE / BSE LIVE", "INDIAN MARKETS", "HUMAN-IN-THE-LOOP", "FREE IN BETA"].map((item, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-primary/40" />{item}
                  </span>
                ))}
              </div>
            </div>
          </motion.section>

          {/* Testimonials */}
          <section className="py-20 border-t border-border/50" aria-label="User testimonials">
            <div className="max-w-5xl mx-auto px-4">
              <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport} className="text-center mb-10">
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Early Beta Feedback</h2>
                <p className="text-sm text-muted-foreground">Trusted by early users managing ₹50L+ in equities.</p>
              </motion.div>
              <motion.div variants={staggerContainer(0.09)} initial="hidden" whileInView="show" viewport={viewport}
                className="grid sm:grid-cols-3 gap-4">
                {[
                  { quote: "Finally a platform that combines quant signals with AI — not just another screener. The advisory aggregation is a game-changer.", author: "Portfolio Manager, Mumbai", stars: 5 },
                  { quote: "The composite score makes sense of 6 different signals at once. My hold/sell decisions are much more confident now.", author: "Retail Investor, Bengaluru",   stars: 5 },
                  { quote: "Upstox sync worked in under a minute. Morning briefing email is now a daily ritual. Waiting for Zerodha support!", author: "Technology Professional, Pune", stars: 4 },
                ].map((t, i) => (
                  <motion.div key={i} variants={fadeUp} className="glass rounded-xl p-5 border border-border/60">
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: t.stars }).map((_, j) => (
                        <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                    <p className="text-xs text-muted-foreground">{t.author}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-20 border-t border-border/50">
            <div className="max-w-2xl mx-auto px-4 text-center">
              <motion.div variants={scaleIn} initial="hidden" whileInView="show" viewport={viewport}
                className="glass rounded-2xl p-10 relative overflow-hidden">
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-blue-600/5 pointer-events-none rounded-2xl" />
                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                  <Zap className="h-10 w-10 text-primary mx-auto mb-5 glow-sm" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-3">Ready to trade smarter?</h2>
                <p className="text-muted-foreground text-sm mb-2">Connect your broker in under 60 seconds. Free during beta.</p>
                <p className="text-muted-foreground/50 text-xs mb-8">No credit card · No commitment · Upstox live, Zerodha coming soon</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Button size="lg" className="btn-gradient border-0 glow" asChild>
                      <Link href="/signin">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Button size="lg" variant="outline" className="border-border hover:bg-white/5" asChild>
                      <Link href="#how-it-works"><Users className="mr-2 h-4 w-4" /> See the Platform</Link>
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 py-10">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid sm:grid-cols-2 gap-8 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                    <Zap className="h-3 w-3 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="font-bold text-sm gradient-text">InvestBuddy AI</span>
                  <BetaBadge tooltip={false} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                  AI-powered equity portfolio management for Indian markets.
                  Quant signals, advisory intelligence, multi-broker support.
                </p>
                <p className="text-[11px] text-muted-foreground/40 mt-3">
                  Not SEBI registered. Not financial advice. For informational purposes only.
                </p>
              </div>
              <div className="flex flex-col sm:items-end gap-2">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <Link href="/signin" className="hover:text-foreground transition-colors">Sign In</Link>
                  <Link href="/signin" className="hover:text-foreground transition-colors">Sign Up</Link>
                  <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
                </div>
                <p className="text-[11px] text-muted-foreground/40">© 2026 InvestBuddy AI · investbuddyai.com</p>
                <p className="text-[11px] text-muted-foreground/30">Built with Next.js · Supabase · Upstox API</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
