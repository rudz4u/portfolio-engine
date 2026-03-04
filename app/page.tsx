import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  Shield,
  Bot,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Zap,
  Activity,
  Brain,
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header className="border-b border-border/50 backdrop-blur-md bg-background/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg">
              <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold gradient-text">BrokerAI</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/signin">Sign In</Link>
            </Button>
            <Button size="sm" className="btn-gradient border-0" asChild>
              <Link href="/signin">
                Get Started <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        {/* Background glow blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-blue-500/8 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-full px-3.5 py-1.5 text-xs font-medium mb-8">
            <Activity className="h-3 w-3" />
            Real-time quant signals · Multi-LLM AI · Upstox integrated
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.08]">
            Intelligent Equity
            <br />
            <span className="gradient-text">Management</span>
          </h1>

          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect your Upstox account, get AI-driven buy/sell signals backed by
            quantitative analysis, and manage your Indian equity portfolio with
            institutional-grade tools.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="btn-gradient border-0 glow" asChild>
              <Link href="/signin">
                Start Managing Portfolio
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-border hover:bg-white/5" asChild>
              <Link href="/dashboard">View Demo</Link>
            </Button>
          </div>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {[
              { value: "50+", label: "Stocks tracked" },
              { value: "6",   label: "Quant signals" },
              { value: "3",   label: "AI providers" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold gradient-text">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Everything you need to trade smarter
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              A complete quant + AI platform built specifically for Indian markets.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: TrendingUp,
                title: "Live Portfolio",
                desc: "Sync holdings from Upstox. Real-time P&L, segment allocation, and performance tracking.",
                color: "from-violet-500 to-purple-600",
              },
              {
                icon: BarChart3,
                title: "Quant Analysis",
                desc: "RSI, MACD, Bollinger Bands, ATR, Beta — composite scoring for every holding.",
                color: "from-blue-500 to-cyan-500",
              },
              {
                icon: Brain,
                title: "AI Recommendations",
                desc: "LLM-powered buy/sell signals with news sentiment, backed by quantitative signals.",
                color: "from-emerald-500 to-teal-500",
              },
              {
                icon: Shield,
                title: "Manual Confirmation",
                desc: "Every order requires explicit confirmation. Human-in-the-loop, always.",
                color: "from-orange-500 to-amber-500",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="glass rounded-xl p-6 hover:border-primary/30 transition-colors group"
              >
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold mb-2 text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature detail ───────────────────────────────────────────── */}
      <section className="py-20 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-primary font-medium mb-4">
                <Bot className="h-3.5 w-3.5" /> AI-POWERED PLATFORM
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-tight">
                Your portfolio,<br />
                <span className="gradient-text">upgraded</span>
              </h2>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                BrokerAI bridges the gap between your existing strategy and a
                production-grade AI trading assistant — fully integrated with Upstox.
              </p>
              <ul className="space-y-2.5">
                {[
                  "Upstox OAuth + direct token sandbox mode",
                  "Holdings sync with P&L and segment breakdown",
                  "Technical indicators: RSI, SMA, EMA, MACD, ATR",
                  "India VIX-adjusted target pricing",
                  "Multi-LLM routing (OpenAI / Anthropic / Gemini)",
                  "Chat assistant for morning briefings",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    <span className="text-foreground/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mock portfolio snapshot */}
            <div className="glass rounded-2xl p-6 border border-border/80">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Portfolio Snapshot</span>
                <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">↑ Live</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Total Invested",  value: "₹3,37,847",              positive: null },
                  { label: "Current Value",   value: "₹3,67,120",              positive: null },
                  { label: "Total P&L",       value: "+₹29,273",               positive: true },
                  { label: "P&L %",           value: "+8.67%",                 positive: true },
                  { label: "Active Holdings", value: "44 stocks",              positive: null },
                  { label: "Segments",        value: "6 (Defence, EV, Green…)", positive: null },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center py-2 border-b border-border/40 last:border-0"
                  >
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span
                      className={`text-xs font-semibold ${
                        row.positive === true
                          ? "text-emerald-400"
                          : row.positive === false
                          ? "text-red-400"
                          : "text-foreground"
                      }`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="glass rounded-2xl p-10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 to-blue-600/5 pointer-events-none rounded-2xl" />
            <Zap className="h-10 w-10 text-primary mx-auto mb-5 glow-sm" />
            <h2 className="text-2xl font-bold mb-3">Ready to trade smarter?</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Connect your Upstox account in under 60 seconds.
            </p>
            <Button size="lg" className="btn-gradient border-0 glow" asChild>
              <Link href="/signin">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        © 2026 BrokerAI · Built with Next.js · Supabase · Upstox
      </footer>
    </div>
  )
}
