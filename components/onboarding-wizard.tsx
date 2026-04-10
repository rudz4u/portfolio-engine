"use client"

import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, ArrowLeft, X, CheckCircle2, Zap, Bell, TrendingUp, Shield, Loader2, Sparkles } from "lucide-react"
import { BuddyMascot } from "@/components/buddy-mascot"
import {
  type InvestorType,
  type RiskTolerance,
  type RiskCapacity,
  type ExperienceLevel,
  type DecisionStyle,
  type InvestmentGoal,
  type InvestmentHorizon,
  type StrategyPreset,
  INVESTOR_TYPES,
  INVESTOR_TYPE_LABELS,
  INVESTOR_TYPE_DESCRIPTIONS,
  INVESTOR_TYPE_ICONS,
  INVESTOR_TYPE_DEFAULTS,
  RISK_TOLERANCE_LEVELS,
  RISK_TOLERANCE_LABELS,
  RISK_CAPACITY_LEVELS,
  EXPERIENCE_LEVELS,
  DECISION_STYLE_LABELS,
  DECISION_STYLES,
  INVESTMENT_GOALS,
  INVESTMENT_GOAL_LABELS,
  KNOWN_SECTORS,
} from "@/lib/types/investor-profile"

const STEPS = 9

interface OnboardingWizardProps {
  onComplete: () => void
}

const slideVariants = {
  enter:  { opacity: 0, x:  40 },
  center: { opacity: 1, x:   0 },
  exit:   { opacity: 0, x: -40 },
}

/* ── Horizon slider stops ─────────────────────────────────── */
const HORIZON_OPTIONS = [
  { label: "< 1 month", months: 1 },
  { label: "1–3 months", months: 2 },
  { label: "3–6 months", months: 4 },
  { label: "6–12 months", months: 9 },
  { label: "1–2 years", months: 18 },
  { label: "2–5 years", months: 42 },
  { label: "5–10 years", months: 90 },
  { label: "10+ years", months: 120 },
]

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  // Step 2: Investor type
  const [investorType, setInvestorType] = useState<InvestorType>("medium_term")
  // Step 3: Horizon
  const [horizonIdx, setHorizonIdx] = useState(3) // default: 6–12 months
  // Step 4: Risk
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("moderate")
  const [riskCapacity, setRiskCapacity] = useState<RiskCapacity>("medium")
  // Step 5: Sectors
  const [preferredSectors, setPreferredSectors] = useState<string[]>([])
  const [avoidedSectors, setAvoidedSectors] = useState<string[]>([])
  // Step 6: Goals
  const [goals, setGoals] = useState<InvestmentGoal[]>([])
  const [experience, setExperience] = useState<ExperienceLevel>("beginner")
  const [decisionStyle, setDecisionStyle] = useState<DecisionStyle>("hybrid")
  // Step 7: Strategy recommendation
  const [recommendedPreset, setRecommendedPreset] = useState<StrategyPreset | null>(null)
  const [strategyExplanation, setStrategyExplanation] = useState("")
  const [loadingStrategy, setLoadingStrategy] = useState(false)
  // Step 9: Notifications
  const [digest, setDigest] = useState(true)
  // Final
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // Auto-fill defaults when investor type changes
  useEffect(() => {
    const defaults = INVESTOR_TYPE_DEFAULTS[investorType]
    if (defaults) {
      setRiskTolerance(defaults.risk_tolerance)
      // Find closest horizon index
      const closest = HORIZON_OPTIONS.reduce((best, opt, i) =>
        Math.abs(opt.months - defaults.horizon.default_months) < Math.abs(HORIZON_OPTIONS[best].months - defaults.horizon.default_months) ? i : best, 0)
      setHorizonIdx(closest)
    }
  }, [investorType])

  // Build horizon from slider index
  const buildHorizon = useCallback((): InvestmentHorizon => {
    const m = HORIZON_OPTIONS[horizonIdx].months
    return {
      default_months: m,
      min_months: Math.max(0, Math.round(m * 0.3)),
      max_months: Math.round(m * 2.5),
    }
  }, [horizonIdx])

  // Fetch strategy recommendation (Step 7)
  const fetchRecommendation = useCallback(async () => {
    setLoadingStrategy(true)
    try {
      const res = await fetch("/api/profile/investor/recommend-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investor_type: investorType,
          risk_tolerance: riskTolerance,
          investment_goals: goals,
          preferred_sectors: preferredSectors,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setRecommendedPreset(data.recommended_preset ?? null)
        setStrategyExplanation(data.explanation ?? "")
      }
    } catch { /* silent */ }
    setLoadingStrategy(false)
  }, [investorType, riskTolerance, goals, preferredSectors])

  // When user reaches strategy step, auto-fetch
  useEffect(() => {
    if (step === 6) fetchRecommendation()
  }, [step, fetchRecommendation])

  async function finish() {
    setSaving(true)
    try {
      // 1. Save investor profile
      await fetch("/api/profile/investor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investor_type: investorType,
          investment_horizon: buildHorizon(),
          risk_tolerance: riskTolerance,
          risk_capacity: riskCapacity,
          max_portfolio_drawdown_pct: INVESTOR_TYPE_DEFAULTS[investorType].max_drawdown,
          max_single_stock_allocation_pct: INVESTOR_TYPE_DEFAULTS[investorType].max_allocation,
          preferred_sectors: preferredSectors,
          avoided_sectors: avoidedSectors,
          investment_goals: goals,
          experience_level: experience,
          decision_style: decisionStyle,
          rebalance_frequency: INVESTOR_TYPE_DEFAULTS[investorType].rebalance,
          active_strategy_preset_id: recommendedPreset?.id ?? null,
        }),
      })

      // 2. Save settings (onboarding complete + notifications)
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding_completed: "true",
          risk_preference: riskTolerance,
          notif_daily_digest: digest ? "true" : "false",
        }),
      })
    } catch { /* ignore */ }
    setSaving(false)
    setDone(true)
    setTimeout(onComplete, 1800)
  }

  const canGoBack = step > 0 && !done

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
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[hsl(222,47%,6%)] shadow-2xl shadow-black/60 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Progress bar */}
        {!done && (
          <div className="absolute top-0 left-0 h-0.5 w-full bg-white/[0.06] z-10">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 to-blue-500"
              animate={{ width: `${((step + 1) / STEPS) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        )}

        {/* Skip */}
        {!done && step < STEPS - 1 && (
          <button
            onClick={onComplete}
            className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors z-10"
            aria-label="Skip onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="px-8 py-10 min-h-[420px] flex flex-col overflow-y-auto">
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
                <p className="text-sm text-white/50">Your personalised signals are ready. Taking you to your dashboard&hellip;</p>
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
                {step === 1 && <StepInvestorType value={investorType} onChange={setInvestorType} />}
                {step === 2 && <StepHorizon idx={horizonIdx} onChange={setHorizonIdx} />}
                {step === 3 && <StepRiskProfile tolerance={riskTolerance} setTolerance={setRiskTolerance} capacity={riskCapacity} setCapacity={setRiskCapacity} />}
                {step === 4 && <StepSectors preferred={preferredSectors} setPreferred={setPreferredSectors} avoided={avoidedSectors} setAvoided={setAvoidedSectors} />}
                {step === 5 && <StepGoals goals={goals} setGoals={setGoals} experience={experience} setExperience={setExperience} decisionStyle={decisionStyle} setDecisionStyle={setDecisionStyle} />}
                {step === 6 && <StepStrategy preset={recommendedPreset} explanation={strategyExplanation} loading={loadingStrategy} onRefresh={fetchRecommendation} />}
                {step === 7 && <StepBroker />}
                {step === 8 && <StepNotifications digest={digest} setDigest={setDigest} />}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer nav */}
          {!done && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.07]">
              <div className="flex items-center gap-3">
                {canGoBack && (
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back
                  </motion.button>
                )}
                <div className="flex gap-1">
                  {Array.from({ length: STEPS }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ width: i === step ? 16 : 4, opacity: i <= step ? 1 : 0.25 }}
                      transition={{ duration: 0.3 }}
                      className="h-1 rounded-full bg-violet-500"
                    />
                  ))}
                </div>
              </div>

              {step < STEPS - 1 ? (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setStep((s) => s + 1)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20"
                >
                  {step === 7 ? "Skip for now" : "Continue"}
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

/* ── Step Components ─────────────────────────────────────── */

function StepHeader({ stepNum, title, subtitle }: { stepNum: number; title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-1">Step {stepNum} of {STEPS}</p>
      <h2 className="text-xl font-bold text-white mb-1.5">{title}</h2>
      <p className="text-sm text-white/45 leading-relaxed">{subtitle}</p>
    </div>
  )
}

function StepWelcome() {
  return (
    <div className="flex flex-col items-center text-center gap-4 flex-1 justify-center">
      <BuddyMascot size={100} />
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Hi, I&rsquo;m <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">Buddy!</span>
        </h2>
        <p className="text-sm text-white/50 leading-relaxed max-w-xs mx-auto">
          Your AI equity co-pilot. Let&rsquo;s set up your personalised investment profile so signals, scoring, and recommendations are tailored to how <em>you</em> invest.
        </p>
      </div>
      <div className="mt-2 flex flex-col gap-2 w-full max-w-xs text-left">
        {[
          { icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-500/10", text: "Signals calibrated to your style" },
          { icon: Zap,        color: "text-blue-400",   bg: "bg-blue-500/10",   text: "AI-powered quant signals every day" },
          { icon: Shield,     color: "text-emerald-400",bg: "bg-emerald-500/10",text: "Risk controls matched to your appetite" },
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

/* ── Step 2: Investor Type ───────────────────────────────── */

function StepInvestorType({ value, onChange }: { value: InvestorType; onChange: (v: InvestorType) => void }) {
  return (
    <div className="flex flex-col flex-1">
      <StepHeader stepNum={2} title="What kind of investor are you?" subtitle="This drives how Buddy weighs momentum, valuation, and advisory signals for you." />
      <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[340px] pr-1">
        {INVESTOR_TYPES.map((type) => (
          <motion.button
            key={type}
            onClick={() => onChange(type)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
              value === type
                ? "border-violet-500/40 bg-white/[0.07]"
                : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.15]"
            }`}
          >
            <span className="text-lg mt-0.5">{INVESTOR_TYPE_ICONS[type]}</span>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold mb-0.5 ${value === type ? "text-violet-400" : "text-white/80"}`}>
                {INVESTOR_TYPE_LABELS[type]}
              </div>
              <div className="text-[11px] text-white/40 leading-relaxed">{INVESTOR_TYPE_DESCRIPTIONS[type]}</div>
            </div>
            <motion.div
              animate={{ scale: value === type ? 1 : 0.6, opacity: value === type ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-violet-400" />
            </motion.div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

/* ── Step 3: Investment Horizon ──────────────────────────── */

function StepHorizon({ idx, onChange }: { idx: number; onChange: (i: number) => void }) {
  return (
    <div className="flex flex-col flex-1">
      <StepHeader stepNum={3} title="How long do you typically hold?" subtitle="Your holding horizon shapes which advisory signals and scoring thresholds apply to your portfolio." />
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-white mb-1">{HORIZON_OPTIONS[idx].label}</div>
          <div className="text-xs text-white/40">Default holding period</div>
        </div>
        <div className="px-2">
          <input
            type="range"
            min={0}
            max={HORIZON_OPTIONS.length - 1}
            value={idx}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 accent-violet-500
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:shadow-lg"
          />
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-white/30">Short</span>
            <span className="text-[10px] text-white/30">Long</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {HORIZON_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              onClick={() => onChange(i)}
              className={`text-[10px] px-2.5 py-1 rounded-full transition-all ${
                i === idx
                  ? "bg-violet-500/20 text-violet-400 border border-violet-500/40"
                  : "text-white/30 hover:text-white/50 border border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Step 4: Risk Profile ────────────────────────────────── */

function StepRiskProfile({
  tolerance, setTolerance, capacity, setCapacity
}: {
  tolerance: RiskTolerance; setTolerance: (v: RiskTolerance) => void
  capacity: RiskCapacity; setCapacity: (v: RiskCapacity) => void
}) {
  const toleranceOptions: { value: RiskTolerance; icon: string; color: string; border: string }[] = [
    { value: "very_conservative", icon: "🏛️", color: "text-blue-300", border: "border-blue-400/40" },
    { value: "conservative", icon: "🛡️", color: "text-blue-400", border: "border-blue-500/40" },
    { value: "moderate", icon: "⚖️", color: "text-violet-400", border: "border-violet-500/40" },
    { value: "aggressive", icon: "🔥", color: "text-amber-400", border: "border-amber-500/40" },
    { value: "very_aggressive", icon: "🚀", color: "text-red-400", border: "border-red-500/40" },
  ]

  const capacityOptions: { value: RiskCapacity; label: string; desc: string }[] = [
    { value: "low", label: "Low", desc: "Limited funds for potential losses" },
    { value: "medium", label: "Medium", desc: "Can absorb moderate losses" },
    { value: "high", label: "High", desc: "Comfortable with significant drawdowns" },
  ]

  return (
    <div className="flex flex-col flex-1">
      <StepHeader stepNum={4} title="Your risk profile" subtitle="We separate willingness to take risk from financial ability to bear loss." />
      <div className="space-y-5 flex-1">
        {/* Risk Tolerance */}
        <div>
          <p className="text-xs font-medium text-white/50 mb-2.5">Risk Tolerance <span className="text-white/30">(willingness)</span></p>
          <div className="flex gap-1.5">
            {toleranceOptions.map((opt) => (
              <motion.button
                key={opt.value}
                onClick={() => setTolerance(opt.value)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex-1 flex flex-col items-center gap-1 rounded-xl border py-3 px-1 transition-all ${
                  tolerance === opt.value
                    ? `${opt.border} bg-white/[0.07]`
                    : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.15]"
                }`}
              >
                <span className="text-lg">{opt.icon}</span>
                <span className={`text-[9px] font-medium leading-tight text-center ${tolerance === opt.value ? opt.color : "text-white/40"}`}>
                  {RISK_TOLERANCE_LABELS[opt.value].replace("Very ", "V.")}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Risk Capacity */}
        <div>
          <p className="text-xs font-medium text-white/50 mb-2.5">Risk Capacity <span className="text-white/30">(financial ability)</span></p>
          <div className="space-y-1.5">
            {capacityOptions.map((opt) => (
              <motion.button
                key={opt.value}
                onClick={() => setCapacity(opt.value)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  capacity === opt.value
                    ? "border-violet-500/40 bg-white/[0.07]"
                    : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.15]"
                }`}
              >
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${capacity === opt.value ? "text-violet-400" : "text-white/70"}`}>{opt.label}</div>
                  <div className="text-[11px] text-white/35">{opt.desc}</div>
                </div>
                <motion.div
                  animate={{ scale: capacity === opt.value ? 1 : 0, opacity: capacity === opt.value ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <CheckCircle2 className="h-4 w-4 text-violet-400" />
                </motion.div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Step 5: Sector Preferences ──────────────────────────── */

function StepSectors({
  preferred, setPreferred, avoided, setAvoided
}: {
  preferred: string[]; setPreferred: (v: string[]) => void
  avoided: string[]; setAvoided: (v: string[]) => void
}) {
  function toggleSector(sector: string) {
    if (preferred.includes(sector)) {
      // preferred → avoided
      setPreferred(preferred.filter((s) => s !== sector))
      setAvoided([...avoided, sector])
    } else if (avoided.includes(sector)) {
      // avoided → neutral
      setAvoided(avoided.filter((s) => s !== sector))
    } else {
      // neutral → preferred
      setPreferred([...preferred, sector])
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <StepHeader stepNum={5} title="Sector preferences" subtitle="Tap once to prefer, twice to avoid, thrice to reset. Signals will prioritise your focus sectors." />
      <div className="flex flex-wrap gap-1.5 flex-1 content-start overflow-y-auto max-h-[300px] pr-1">
        {KNOWN_SECTORS.map((sector) => {
          const isPref = preferred.includes(sector)
          const isAvoid = avoided.includes(sector)
          return (
            <button
              key={sector}
              onClick={() => toggleSector(sector)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                isPref
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : isAvoid
                  ? "bg-red-500/10 border-red-500/30 text-red-400 line-through"
                  : "bg-white/[0.03] border-white/[0.08] text-white/45 hover:border-white/[0.2]"
              }`}
            >
              {isPref && "✓ "}{isAvoid && "✗ "}{sector}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex gap-4 text-[10px] text-white/30">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500/40" /> Preferred</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500/30" /> Avoided</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-white/10" /> Neutral</span>
      </div>
    </div>
  )
}

/* ── Step 6: Goals & Experience ──────────────────────────── */

function StepGoals({
  goals, setGoals, experience, setExperience, decisionStyle, setDecisionStyle
}: {
  goals: InvestmentGoal[]; setGoals: (v: InvestmentGoal[]) => void
  experience: ExperienceLevel; setExperience: (v: ExperienceLevel) => void
  decisionStyle: DecisionStyle; setDecisionStyle: (v: DecisionStyle) => void
}) {
  function toggleGoal(g: InvestmentGoal) {
    setGoals(goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g])
  }

  return (
    <div className="flex flex-col flex-1">
      <StepHeader stepNum={6} title="Goals & experience" subtitle="Select all that apply. This shapes which opportunities Buddy surfaces for you." />
      <div className="space-y-4 flex-1 overflow-y-auto max-h-[320px] pr-1">
        {/* Goals */}
        <div>
          <p className="text-xs font-medium text-white/50 mb-2">Investment goals</p>
          <div className="flex flex-wrap gap-1.5">
            {INVESTMENT_GOALS.map((g) => (
              <button
                key={g}
                onClick={() => toggleGoal(g)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  goals.includes(g)
                    ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                    : "bg-white/[0.03] border-white/[0.08] text-white/45 hover:border-white/[0.2]"
                }`}
              >
                {goals.includes(g) && "✓ "}{INVESTMENT_GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        {/* Experience */}
        <div>
          <p className="text-xs font-medium text-white/50 mb-2">Experience level</p>
          <div className="flex gap-1.5">
            {EXPERIENCE_LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setExperience(lvl)}
                className={`flex-1 text-xs py-2 rounded-lg border transition-all capitalize ${
                  experience === lvl
                    ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                    : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:border-white/[0.15]"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Decision style */}
        <div>
          <p className="text-xs font-medium text-white/50 mb-2">Decision approach</p>
          <div className="space-y-1.5">
            {DECISION_STYLES.map((ds) => (
              <button
                key={ds}
                onClick={() => setDecisionStyle(ds)}
                className={`w-full text-xs text-left px-3.5 py-2 rounded-lg border transition-all ${
                  decisionStyle === ds
                    ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                    : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:border-white/[0.15]"
                }`}
              >
                {DECISION_STYLE_LABELS[ds]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Step 7: Strategy Recommendation ─────────────────────── */

function StepStrategy({
  preset, explanation, loading, onRefresh
}: {
  preset: StrategyPreset | null; explanation: string; loading: boolean; onRefresh: () => void
}) {
  return (
    <div className="flex flex-col flex-1">
      <StepHeader stepNum={7} title="Your tailored strategy" subtitle="Based on your profile, Buddy recommends a scoring strategy. You can customise it later in Settings." />
      <div className="flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-white/40">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            <p className="text-sm">Analysing your profile&hellip;</p>
          </div>
        ) : preset ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/8 px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-bold text-white">{preset.name}</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{preset.description}</p>
            </div>

            {/* Weight preview */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
              <p className="text-[11px] font-medium text-white/40 mb-2.5">Scoring weights</p>
              <div className="space-y-2">
                {Object.entries(preset.scoring_weights as Record<string, number>).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50 w-20 capitalize">{key}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${val}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                      />
                    </div>
                    <span className="text-[10px] text-white/40 w-8 text-right">{val}%</span>
                  </div>
                ))}
              </div>
            </div>

            {explanation && (
              <p className="text-[11px] text-white/35 leading-relaxed px-1">{explanation}</p>
            )}

            <button
              onClick={onRefresh}
              className="text-[11px] text-violet-400/60 hover:text-violet-400 transition-colors"
            >
              Regenerate recommendation
            </button>
          </div>
        ) : (
          <div className="text-center text-sm text-white/40">
            <p>Could not generate a recommendation. You can select a strategy manually in Settings.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Step 8: Broker (existing) ───────────────────────────── */

function StepBroker() {
  return (
    <div className="flex flex-col flex-1">
      <StepHeader stepNum={8} title="Your portfolio is ready" subtitle="If you uploaded your holdings during sign-up, Buddy has everything it needs to start analysing." />
      <div className="space-y-3 flex-1">
        <div className="flex items-start gap-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-white/90">Holdings import supported</div>
            <div className="text-[11px] text-white/45 mt-1 leading-relaxed">
              Upload your broker&apos;s holdings report (Zerodha, Groww, Upstox, Angel One, and more) from{" "}
              <span className="text-white/65 font-medium">Portfolio → Import Holdings</span> at any time.
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
          <p className="text-xs font-medium text-white/40 mb-2.5">Supported brokers</p>
          <div className="flex flex-wrap gap-2">
            {["Zerodha", "Groww", "Upstox", "Angel One", "Dhan", "+ more"].map((b) => (
              <div key={b} className="text-center text-[11px] text-white/30 py-1.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                {b}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-white/25">
        Broker direct sync via OAuth is coming soon
      </p>
    </div>
  )
}

/* ── Step 9: Notifications (existing) ────────────────────── */

function StepNotifications({ digest, setDigest }: { digest: boolean; setDigest: (v: boolean) => void }) {
  return (
    <div className="flex flex-col flex-1">
      <StepHeader stepNum={9} title="Stay informed" subtitle="Get a morning portfolio briefing with P&L, top movers, and AI signals delivered to your email." />
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
