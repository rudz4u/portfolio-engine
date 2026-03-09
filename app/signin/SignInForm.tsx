"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, TrendingUp, ShieldCheck, BarChart2, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export default function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const supabase = createClient()

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push(redirect)
      router.refresh()
    }
  }

  return (
    <div className="relative min-h-screen flex overflow-hidden bg-[hsl(222,47%,4%)] mesh-bg">

      {/* ── Decorative glow blobs ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 15% 50%, hsl(263 70% 60% / 0.12) 0%, transparent 70%), " +
            "radial-gradient(ellipse 50% 40% at 85% 20%, hsl(220 80% 55% / 0.09) 0%, transparent 65%), " +
            "radial-gradient(ellipse 40% 35% at 70% 90%, hsl(142 69% 44% / 0.07) 0%, transparent 60%)",
        }}
      />

      {/* ── Left hero panel (desktop only) ── */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-[52%] relative z-10">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-12">
          <img
            src="/Logos/investbuddy_mascot_logo.svg"
            alt="InvestBuddy AI"
            className="h-12"
          />
        </div>

        <h2 className="text-4xl font-bold leading-tight text-white mb-4">
          Your Portfolio<br />
          <span className="gradient-text">Equity Command</span><br />
          Centre
        </h2>
        <p className="text-base text-white/50 mb-10 max-w-sm leading-relaxed">
          Real-time portfolio analytics, risk context, and sector analysis in one dashboard.
        </p>

        {/* Feature list */}
        <div className="space-y-4">
          {[
            {
              icon: TrendingUp,
              color: "text-violet-400",
              bg: "bg-violet-500/10",
              title: "Live Portfolio Tracking",
              desc: "Syncs directly with your Upstox account. Always accurate.",
            },
            {
              icon: BarChart2,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
              title: "AI Research Summaries",
              desc: "Structured summaries of quant indicators and advisory context.",
            },
            {
              icon: ShieldCheck,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
              title: "Risk & Concentration Analysis",
              desc: "HHI, Sharpe proxy, sector correlation — know your exposure.",
            },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-4 backdrop-blur-sm"
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/90">{title}</p>
                <p className="mt-0.5 text-xs text-white/45">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right auth panel ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">

        {/* Mobile logo */}
        <div className="flex flex-col items-center gap-2 mb-8 lg:hidden">
          <img
            src="/Logos/investbuddyai_app_icon.svg"
            alt="InvestBuddy AI"
            className="h-14 w-14 rounded-2xl shadow-lg"
          />
          <span className="text-2xl font-bold gradient-text">InvestBuddy AI</span>
          <p className="text-xs text-white/45">Your Portfolio&rsquo;s Intelligence Layer</p>
        </div>

        {/* Card */}
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/40 p-8">

            {/* Header */}
            <div className="mb-7">
              <h1 className="text-xl font-bold text-white">Welcome back</h1>
              <p className="mt-1 text-sm text-white/45">
                Sign in to access your portfolio dashboard.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSignIn}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-white/60 uppercase tracking-wide">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-white/60 uppercase tracking-wide">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
                <p className="text-xs text-amber-300">
                  Informational analytics only. InvestBuddy AI is not a SEBI-registered investment adviser and does not provide regulated investment advice.
                  <Link href="/legal/disclaimer" target="_blank" className="ml-1 text-amber-200 underline underline-offset-2 hover:text-white">Read disclaimer</Link>
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-gradient mt-2 gap-2 font-semibold shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ArrowRight className="h-4 w-4" />
                }
                Sign In
              </Button>
            </form>

            <p className="mt-5 text-center text-[11px] text-white/35">
              Account registration is currently disabled on this page.
            </p>
          </div>

          <p className="mt-5 text-center text-xs text-white/30">
            <Link href="/" className="hover:text-white/60 transition-colors">
              ← Back to home
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
