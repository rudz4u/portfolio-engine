"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, X, CheckCircle2, Zap, Bell, TrendingUp, Shield, ChevronRight } from "lucide-react"
import { BuddyMascot } from "@/components/buddy-mascot"

const STEPS = 4

type RiskLevel = "conservative" | "balanced" | "aggressive"

interface OnboardingWizardProps {
  onComplete: () => void
}

const slideVariants = {
  enter:  { opacity: 0, x:  40 },
  center: { opacity: 1, x:   0 },
  exit:   { opacity: 0, x: -40 },
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [risk, setRisk] = useState<RiskLevel>("balanced")
  const [digest, setDigest] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function finish() {
    setSaving(true)
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding_completed: "true",
          risk_preference: risk,
          notif_daily_digest: digest ? "true" : "false",
        }),
      })
    } catch { /* ignore */ }
    setSaving(false)
    setDone(true)
    setTimeout(onComplete, 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[hsl(222,47%,6%)] shadow-2xl shadow-black/60 overflow-hidden"
      >
        {/* Progress bar */}
        {!done && (
          <div className="absolute top-0 left-0 h-0.5 w-full bg-white/[0.06]">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-blue-500"
              animate={{ width: `${((step + 1) / STEPS) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        )}

        {/* Skip (steps 1-3 only) */}
        {!done && step < 3 && (
          <button
            onClick={onComplete}
            className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors z-10"
            aria-label="Skip onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="px-8 py-10 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="flex flex-col items-center justify-center flex-1 text-center gap-4"
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
                </motion.div>
                <h2 className="text-2xl font-bold text-white">You&rsquo;re all set!</h2>
                <p className="text-sm text-white/50">Taking you to your dashboard&hellip;</p>
              </motion.div>
            ) : (
              <motion.div
                key={step}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="flex flex-col flex-1"
              >
                {step === 0 && <StepWelcome />}
                {step === 1 && <StepBroker />}
                {step === 2 && <StepRisk risk={risk} setRisk={setRisk} />}
                {step === 3 && <StepNotifications digest={digest} setDigest={setDigest} />}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer nav */}
          {!done && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.07]">
              <div className="flex gap-1.5">
                {Array.from({ length: STEPS }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ width: i === step ? 20 : 6, opacity: i <= step ? 1 : 0.25 }}
                    transition={{ duration: 0.3 }}
                    className="h-1.5 rounded-full bg-violet-500"
                  />
                ))}
              </div>

              {step < 3 ? (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setStep((s) => s + 1)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20"
                >
                  {step === 1 ? "Skip for now" : "Continue"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={finish}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-60"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {saving ? "Saving…" : "Finish Setup"}
                </motion.button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/* ── Steps ───────────────────────────────────────────────── */

function StepWelcome() {
  return (
    <div className="flex flex-col items-center text-center gap-4 flex-1 justify-center">
      <BuddyMascot size={100} />
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Hi, I&rsquo;m <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Buddy!</span>
        </h2>
        <p className="text-sm text-white/50 leading-relaxed max-w-xs mx-auto">
          Your AI equity co-pilot. I&rsquo;ll help you track your portfolio, analyse market data,
          and surface quant portfolio analytics — all in one place.
        </p>
      </div>
      <div className="mt-2 flex flex-col gap-2 w-full max-w-xs text-left">
        {[
          { icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-500/10", text: "Live portfolio sync from your broker" },
          { icon: Zap,        color: "text-blue-400",   bg: "bg-blue-500/10",   text: "AI-powered quant signals every day" },
          { icon: Shield,     color: "text-emerald-400",bg: "bg-emerald-500/10",text: "You always confirm before any trade" },
        ].map(({ icon: Icon, color, bg, text }) => (
          <div key={text} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5">
            <div className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center ${bg}`}>
              <Icon className={`h-3.5 w-3.5 ${color}`} />
            </div>
            <span className="text-xs text-white/70">{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepBroker() {
  return (
    <div className="flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-1">Step 2 of 4</p>
        <h2 className="text-xl font-bold text-white mb-2">Connect your broker</h2>
        <p className="text-sm text-white/45 leading-relaxed">
          Sync your live holdings, P&amp;L, and orders automatically. No manual entry needed.
        </p>
      </div>

      <div className="space-y-3 flex-1">
        <motion.a
          href="/api/oauth/upstox/authorize"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="group flex w-full items-center gap-3.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-4 text-sm font-medium text-white transition-all hover:border-violet-500/50 hover:bg-violet-500/15"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-base font-bold text-white shadow-lg">U</span>
          <div className="flex-1 text-left">
            <div className="font-semibold text-sm">Connect Upstox</div>
            <div className="text-[11px] text-white/40 mt-0.5">OAuth 2.0 · Read-only by default</div>
          </div>
          <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white/60 transition-colors" />
        </motion.a>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
          <p className="text-xs font-medium text-white/40 mb-2.5">Coming in v0.2</p>
          <div className="flex gap-2">
            {["Zerodha", "Angel One", "Dhan"].map((b) => (
              <div key={b} className="flex-1 text-center text-[11px] text-white/25 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                {b}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-white/25">
        You can also add holdings manually from Settings → Portfolio
      </p>
    </div>
  )
}

function StepRisk({ risk, setRisk }: { risk: RiskLevel; setRisk: (r: RiskLevel) => void }) {
  const options: { value: RiskLevel; label: string; desc: string; color: string; border: string; icon: string }[] = [
    {
      value: "conservative",
      label: "Conservative",
      desc: "Focus on capital preservation. Low volatility picks.",
      color: "text-blue-400",
      border: "border-blue-500/40",
      icon: "🛡️",
    },
    {
      value: "balanced",
      label: "Balanced",
      desc: "Mix of growth and stability. Moderate risk tolerance.",
      color: "text-violet-400",
      border: "border-violet-500/40",
      icon: "⚖️",
    },
    {
      value: "aggressive",
      label: "Aggressive",
      desc: "Maximum growth. High risk, high reward focus.",
      color: "text-amber-400",
      border: "border-amber-500/40",
      icon: "🚀",
    },
  ]

  return (
    <div className="flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-1">Step 3 of 4</p>
        <h2 className="text-xl font-bold text-white mb-2">Your investment style</h2>
        <p className="text-sm text-white/45">This helps Buddy calibrate signals to your risk appetite.</p>
      </div>

      <div className="space-y-2.5 flex-1">
        {options.map((opt) => (
          <motion.button
            key={opt.value}
            onClick={() => setRisk(opt.value)}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-start gap-4 rounded-xl border px-4 py-3.5 text-left transition-all ${
              risk === opt.value
                ? `${opt.border} bg-white/[0.07]`
                : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.15]"
            }`}
          >
            <span className="text-xl mt-0.5">{opt.icon}</span>
            <div className="flex-1">
              <div className={`text-sm font-semibold mb-0.5 ${risk === opt.value ? opt.color : "text-white/80"}`}>
                {opt.label}
              </div>
              <div className="text-xs text-white/40 leading-relaxed">{opt.desc}</div>
            </div>
            <motion.div
              animate={{ scale: risk === opt.value ? 1 : 0.6, opacity: risk === opt.value ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <CheckCircle2 className={`h-4 w-4 mt-0.5 ${opt.color}`} />
            </motion.div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function StepNotifications({ digest, setDigest }: { digest: boolean; setDigest: (v: boolean) => void }) {
  return (
    <div className="flex flex-col flex-1">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-1">Step 4 of 4</p>
        <h2 className="text-xl font-bold text-white mb-2">Stay informed</h2>
        <p className="text-sm text-white/45 leading-relaxed">
          Get a morning portfolio briefing with P&amp;L, top movers, and AI signals delivered to your email.
        </p>
      </div>

      <div className="flex-1 space-y-3">
        <motion.button
          onClick={() => setDigest(!digest)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all ${
            digest
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-white/[0.08] bg-white/[0.03]"
          }`}
        >
          <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${digest ? "bg-emerald-500/15" : "bg-white/[0.06]"}`}>
            <Bell className={`h-5 w-5 ${digest ? "text-emerald-400" : "text-white/30"}`} />
          </div>
          <div className="flex-1">
            <div className={`text-sm font-semibold ${digest ? "text-white" : "text-white/60"}`}>
              Morning Portfolio Digest
            </div>
            <div className="text-[11px] text-white/35 mt-0.5">
              Daily email with P&amp;L, signals &amp; top movers
            </div>
          </div>
          {/* Toggle */}
          <div className={`relative h-5 w-9 rounded-full transition-colors ${digest ? "bg-emerald-500" : "bg-white/[0.12]"}`}>
            <motion.div
              animate={{ x: digest ? 16 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
            />
          </div>
        </motion.button>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-xs text-white/30 leading-relaxed">
            You can customise notification emails in <span className="text-white/50">Settings → Notifications</span> at any time. We use your own Brevo API key — no third-party email access.
          </p>
        </div>
      </div>
    </div>
  )
}
