import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  Shield,
  Bot,
  BarChart3,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">BrokerAI</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/signin">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signin">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-6">
          <Bot className="h-3.5 w-3.5" />
          AI-Powered Portfolio Management
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Intelligent Equity Management
          <br />
          <span className="text-primary">for Indian Markets</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
          Connect your Upstox account, get AI-driven buy/sell recommendations
          based on quantitative analysis, and manage your portfolio with
          confidence.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" asChild>
            <Link href="/signin">
              Start Managing Portfolio <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/dashboard">View Demo</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10">
            Everything you need to trade smarter
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: TrendingUp,
                title: "Live Portfolio",
                desc: "Sync holdings from Upstox. Real-time P&L, segment allocation, and performance tracking.",
              },
              {
                icon: BarChart3,
                title: "Quant Analysis",
                desc: "RSI, MACD, Bollinger Bands, ATR, Beta — composite scoring for 50+ stocks.",
              },
              {
                icon: Bot,
                title: "AI Recommendations",
                desc: "LLM-powered buy/sell signals with news sentiment, backed by quantitative signals.",
              },
              {
                icon: Shield,
                title: "Manual Confirmation",
                desc: "Every order requires explicit confirmation. Human-in-the-loop, always.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-background rounded-lg p-6 border">
                <f.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl font-bold mb-4">
              Your portfolio, upgraded
            </h2>
            <p className="text-muted-foreground mb-6">
              BrokerAI bridges the gap between your existing Google Sheets
              strategy and a production-grade AI trading assistant — fully
              integrated with Upstox.
            </p>
            <ul className="space-y-3">
              {[
                "Upstox OAuth + direct token sandbox mode",
                "Holdings sync with P&L and segment breakdown",
                "Technical indicators: RSI, SMA, EMA, MACD, ATR",
                "India VIX-adjusted target pricing",
                "Multi-LLM routing (OpenAI / Anthropic / Gemini)",
                "Chat assistant for morning briefings",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-muted rounded-xl p-6 border">
            <div className="space-y-3">
              {[
                { label: "Total Invested", value: "₹3,37,847" },
                { label: "Current Value", value: "₹3,67,120" },
                { label: "Total P&L", value: "+₹29,273", positive: true },
                { label: "P&L %", value: "+8.67%", positive: true },
                { label: "Active Holdings", value: "44 stocks" },
                { label: "Segments", value: "6 (Defence, EV, Green…)" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center py-2 border-b last:border-0"
                >
                  <span className="text-sm text-muted-foreground">
                    {row.label}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      row.positive ? "text-green-600" : ""
                    }`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © 2026 BrokerAI · Built with Next.js + Supabase + Upstox
      </footer>
    </div>
  )
}
