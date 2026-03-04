"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, Zap, TrendingUp, ShieldCheck, BarChart2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export default function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/dashboard"

  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

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

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setMessage("Account created! Check your email to confirm, then sign in.")
      setMode("signin")
      setLoading(false)
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
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center glow">
            <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-bold gradient-text">Invest<span className="text-white">Buddy AI</span></span>
        </div>

        <h2 className="text-4xl font-bold leading-tight text-white mb-4">
          Your AI-Powered<br />
          <span className="gradient-text">Equity Command</span><br />
          Centre
        </h2>
        <p className="text-base text-white/50 mb-10 max-w-sm leading-relaxed">
          Real-time portfolio intelligence, AI-driven recommendations and sector analysis — all in one place.
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
              title: "AI Recommendations",
              desc: "Buy, hold, or exit signals powered by composite quant scoring.",
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
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center glow">
            <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-bold gradient-text">InvestBuddy AI</span>
          <p className="text-xs text-white/45">AI-Powered Equity Management</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/40 p-8">

            {/* Header */}
            <div className="mb-7">
              <h1 className="text-xl font-bold text-white">
                {mode === "signin" ? "Welcome back" : "Create account"}
              </h1>
              <p className="mt-1 text-sm text-white/45">
                {mode === "signin"
                  ? "Sign in to access your portfolio"
                  : "Start managing your equity portfolio"}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="mb-6 flex rounded-lg bg-white/[0.05] p-1 gap-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(""); setMessage("") }}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                    mode === m
                      ? "bg-white/10 text-white shadow"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {m === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            {/* Form */}
            <form
              onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
              className="space-y-4"
            >
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs text-white/60 uppercase tracking-wide">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="bg-white/[0.06] border-white/10 placeholder:text-white/25 focus:border-violet-500/60 focus:ring-violet-500/20"
                  />
                </div>
              )}

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

              {message && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
                  <p className="text-sm text-emerald-400">{message}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-gradient mt-2 gap-2 font-semibold shadow-lg shadow-violet-500/20"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ArrowRight className="h-4 w-4" />
                }
                {mode === "signin" ? "Sign In" : "Create Account"}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-white/30">
            <Link href="/" className="hover:text-white/60 transition-colors">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
