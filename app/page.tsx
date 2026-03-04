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
  Globe, AlertCircle, Loader2,
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
  emerald: { bg: "bg-emerald-400/10", border: "border-emerald-400/30", text: "text-emerald-400" },
  green:   { bg: "bg-green-400/10",   border: "border-green-400/30",   text: "text-green-400" },
  amber:   { bg: "bg-amber-400/10",   border: "border-amber-400/30",   text: "text-amber-400" },
  orange:  { bg: "bg-orange-400/10",  border: "border-orange-400/30",  text: "text-orange-400" },
  red:     { bg: "bg-red-400/10",     border: "border-red-400/30",     text: "text-red-400" },
  muted:   { bg: "bg-muted",          border: "border-border",         text: "text-muted-foreground" },
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
  const colorMap: Record<string, string> = {
    violet: "#8b5cf6", emerald: "#10b981", amber: "#f59e0b", blue: "#3b82f6", red: "#ef4444",
  }
  const stroke = colorMap[color] ?? colorMap.violet
  return (
    <div ref={wrapRef} className="relative w-28 h-28 mx-auto">
      <svg width="112" height="112" viewBox="0 0 112 112" fill="none" className="-rotate-90">
        <circle cx="56" cy="56" r={R} stroke="hsl(220 30% 14%)" strokeWidth="10" fill="none" />
        <motion.circle cx="56" cy="56" r={R} stroke={stroke} strokeWidth="10" fill="none"
          strokeLinecap="round"
          style={{ strokeDasharray: dash as unknown as string, filter: `drop-shadow(0 0 6px ${stroke}80)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono tabular-nums" style={{ color: stroke }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

function QuickScoreTool() {
  const [symbol, setSymbol] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<null | {
    found: boolean; symbol?: string; name?: string; exchange?: string
    composite_score?: number | null; signal?: string; signal_color?: string
    note?: string; message?: string; suggestions?: string[]
  }>(null)

  async function analyse(e: React.FormEvent) {
    e.preventDefault()
    if (!symbol.trim()) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch(`/api/public/score-preview?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`)
      setResult(await res.json())
    } catch { setResult({ found: false, message: "Network error — please try again." }) }
    setLoading(false)
  }

  const colors = result?.signal_color ? (SIGNAL_COLORS[result.signal_color] ?? SIGNAL_COLORS.muted) : SIGNAL_COLORS.muted

  return (
    <section className="py-20 relative" aria-label="Quick quant score preview tool">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-500/5 rounded-full blur-[80px]" />
      </div>
      <div className="max-w-3xl mx-auto px-4">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full px-3.5 py-1.5 text-xs font-medium mb-5">
            <Sparkles className="h-3 w-3" /> Try it — no account needed
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Get a <span className="gradient-text">Quant Score</span> for Any NSE Stock
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Enter an NSE symbol to see a live composite score combining momentum, valuation, and advisory signals.
          </p>
        </motion.div>

        <motion.div variants={scaleIn} initial="hidden" whileInView="show" viewport={viewport}
          className="glass rounded-2xl p-6 sm:p-8 border border-border/60">
          <form onSubmit={analyse} className="flex gap-3 mb-6" aria-label="Stock symbol lookup">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <motion.input whileFocus={{ boxShadow: "0 0 0 2px hsl(263 70% 63% / 0.35)" }}
                type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. RELIANCE, INFY, HDFCBANK" maxLength={20} aria-label="NSE stock symbol"
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-border rounded-xl text-sm placeholder:text-muted-foreground/50 focus:outline-none transition-shadow" />
            </div>
            <motion.button type="submit" disabled={loading || !symbol.trim()} whileTap={{ scale: 0.96 }}
              className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center gap-2 shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {loading ? "Analysing…" : "Analyse"}
            </motion.button>
          </form>

          <AnimatePresence mode="wait">
            {result && result.found && result.composite_score != null && (
              <motion.div key="score-result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex flex-col sm:flex-row gap-6 items-center mb-6">
                  <ScoreGauge score={result.composite_score}
                    color={result.signal_color === "emerald" ? "emerald" : result.signal_color === "amber" ? "amber" : result.signal_color === "red" ? "red" : "violet"} />
                  <div className="flex-1 text-center sm:text-left">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{result.exchange} · {result.name}</div>
                    <div className="text-2xl font-bold mb-2">{result.symbol}</div>
                    <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, delay: 0.3 }}
                      className={`inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${colors.bg} ${colors.border} ${colors.text}`}>
                      {result.signal}
                    </motion.span>
                  </div>
                </div>
                <div className="space-y-2.5 mb-5">
                  {["Momentum Score", "Valuation Score", "Position Score", "Advisory Score"].map((label) => (
                    <div key={label} className="flex items-center justify-between py-2.5 px-3 bg-white/[0.025] rounded-lg border border-white/[0.04]">
                      <span className="text-xs text-muted-foreground blur-[2px] select-none">{label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-white/[0.06] rounded-full blur-[1px]" />
                        <Lock className="h-3 w-3 text-muted-foreground/40" />
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/signin?redirect=/recommendations"
                  className="flex items-center justify-center gap-2 w-full py-3 btn-gradient rounded-xl text-sm font-semibold glow">
                  Sign up to unlock full breakdown <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            )}
            {result && result.found && result.composite_score == null && (
              <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
                <div className="text-amber-400 text-sm font-medium mb-2">{result.symbol} — Score Pending</div>
                <p className="text-xs text-muted-foreground mb-4">{result.note}</p>
                <Link href="/signin" className="inline-flex items-center gap-2 btn-gradient px-5 py-2.5 rounded-xl text-sm font-semibold">
                  Sign up to generate score <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            )}
            {result && !result.found && (
              <motion.div key="not-found" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
                <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">{result.message}</p>
                {result.suggestions && (
                  <div className="flex gap-2 justify-center mt-2 flex-wrap">
                    {result.suggestions.map((s) => (
                      <button key={s} onClick={() => { setSymbol(s); setResult(null) }}
                        className="text-xs text-primary underline underline-offset-2">{s}</button>
                    ))}
                  </div>
                )}
                <Link href="/signin" className="inline-flex items-center gap-2 mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Sign up to request this stock <ChevronRight className="h-3 w-3" />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {!result && !loading && (
            <div className="flex gap-2 flex-wrap">
              {["RELIANCE", "INFY", "HDFCBANK", "TCS", "IRFC"].map((sym) => (
                <button key={sym} onClick={() => setSymbol(sym)}
                  className="text-xs bg-white/[0.04] border border-border hover:border-primary/40 hover:text-primary rounded-lg px-3 py-1.5 transition-all">
                  {sym}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

        {/* Navbar */}
        <motion.header variants={fadeIn} initial="hidden" animate="show"
          className="border-b border-border/50 backdrop-blur-md bg-background/80 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }} className="flex items-center gap-2.5">
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
              <motion.div variants={fadeIn}>
                <Button size="sm" className="btn-gradient border-0" asChild>
                  <Link href="/signin">Get Started <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.header>

        <main>
          {/* Hero */}
          <section className="relative py-24 sm:py-32 overflow-hidden" aria-label="InvestBuddy AI hero">
            <div aria-hidden className="absolute inset-0 pointer-events-none">
              <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.65, 0.4] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
              <motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-blue-500/8 rounded-full blur-[80px]" />
            </div>
            <div className="relative max-w-4xl mx-auto px-4 text-center">
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-3.5 py-1.5 text-xs font-medium mb-8">
                  <Activity className="h-3 w-3" />
                  Real-time quant signals · Multi-LLM AI · Upstox, Zerodha &amp; more
                </div>
              </motion.div>
              <motion.div variants={staggerContainer(0.05, 0.1)} initial="hidden" animate="show">
                <motion.h1 variants={fadeUp}
                  className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.08]">
                  <span className="block">AI-Powered Equity</span>
                  <span className="block gradient-text">Management</span>
                  <span className="block text-3xl sm:text-4xl lg:text-5xl text-muted-foreground/70 font-semibold mt-2">for Indian Markets</span>
                </motion.h1>
              </motion.div>
              <motion.p variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.25 }}
                className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
                Connect your broker, get AI-driven buy/sell signals backed by RSI, MACD, Bollinger Bands,
                and advisory intelligence. Manage your NSE/BSE portfolio with institutional-grade tools.
              </motion.p>
              <motion.div variants={staggerContainer(0.08, 0.35)} initial="hidden" animate="show"
                className="flex flex-col sm:flex-row gap-3 justify-center">
                <motion.div variants={fadeUp} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" className="btn-gradient border-0 glow" asChild>
                    <Link href="/signin">Start Free — No Card Needed <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </motion.div>
                <motion.div variants={fadeUp} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" variant="outline" className="border-border hover:bg-white/5" asChild>
                    <Link href="#how-it-works">See How It Works</Link>
                  </Button>
                </motion.div>
              </motion.div>
              <motion.div variants={staggerContainer(0.1, 0.5)} initial="hidden" animate="show"
                className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-xl mx-auto">
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
                    <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          <QuickScoreTool />

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
                    className="glass rounded-xl p-6 cursor-default">
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

          {/* Multi-broker */}
          <section className="py-16 border-t border-border/50" aria-label="Supported brokers">
            <div className="max-w-4xl mx-auto px-4 text-center">
              <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={viewport}>
                <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 rounded-full px-3.5 py-1.5 text-xs font-medium mb-6">
                  <Globe className="h-3 w-3" /> Multi-broker support — v0.2 roadmap
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-3">
                  Beyond Upstox — <span className="gradient-text">Any Broker, One Platform</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8">
                  InvestBuddy AI v0.1 ships with Upstox. We are actively building OAuth for every major Indian broker.
                </p>
              </motion.div>
              <motion.div variants={staggerContainer(0.08)} initial="hidden" whileInView="show" viewport={viewport}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                {[
                  { name: "Upstox",    status: "Live Now", color: "text-emerald-400",        bg: "bg-emerald-400/10 border-emerald-400/25" },
                  { name: "Zerodha",   status: "Q2 2026",  color: "text-amber-400",           bg: "bg-amber-400/10 border-amber-400/25" },
                  { name: "Angel One", status: "Q3 2026",  color: "text-muted-foreground",    bg: "bg-white/[0.03] border-border" },
                  { name: "Dhan",      status: "Q3 2026",  color: "text-muted-foreground",    bg: "bg-white/[0.03] border-border" },
                ].map((broker) => (
                  <motion.div key={broker.name} variants={scaleIn} whileHover={{ scale: 1.04 }}
                    className={`rounded-xl border p-4 text-center ${broker.bg}`}>
                    <div className="font-semibold text-sm mb-1">{broker.name}</div>
                    <div className={`text-[11px] ${broker.color}`}>{broker.status}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* Trust strip */}
          <motion.section variants={fadeIn} initial="hidden" whileInView="show" viewport={viewport}
            className="py-8 border-t border-border/50">
            <div className="max-w-4xl mx-auto px-4">
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-[11px] text-muted-foreground/60">
                {["No data sold or shared", "Built on Supabase + Next.js", "GPT-4 · Claude · Gemini routing",
                  "NSE / BSE live data", "Made for Indian markets", "Human-in-the-loop always", "Free during beta"].map((item, i) => (
                  <span key={i} className="flex items-center gap-1">{item}</span>
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
