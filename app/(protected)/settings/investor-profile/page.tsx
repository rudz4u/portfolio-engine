"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, Save, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"
import {
  INVESTOR_TYPES,
  INVESTOR_TYPE_LABELS,
  INVESTOR_TYPE_DESCRIPTIONS,
  INVESTOR_TYPE_ICONS,
  RISK_TOLERANCE_LEVELS,
  RISK_TOLERANCE_LABELS,
  RISK_CAPACITY_LEVELS,
  EXPERIENCE_LEVELS,
  DECISION_STYLES,
  DECISION_STYLE_LABELS,
  REBALANCE_FREQUENCIES,
  INVESTMENT_GOALS,
  INVESTMENT_GOAL_LABELS,
  KNOWN_SECTORS,
  type InvestorProfile,
  type StrategyPreset,
  type InvestorType,
  type RiskTolerance,
  type RiskCapacity,
  type ExperienceLevel,
  type DecisionStyle,
  type RebalanceFrequency,
  type InvestmentGoal,
} from "@/lib/types/investor-profile"

const RISK_TOLERANCE_LABELS_TYPED = RISK_TOLERANCE_LABELS as Record<string, string>

export default function InvestorProfileSettingsPage() {
  const { toast } = useToast()

  const [profile, setProfile] = useState<InvestorProfile | null>(null)
  const [presets, setPresets] = useState<StrategyPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recommending, setRecommending] = useState(false)

  // Form state
  const [investorType, setInvestorType] = useState<InvestorType>("long_term")
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("moderate")
  const [riskCapacity, setRiskCapacity] = useState<RiskCapacity>("medium")
  const [horizonMonths, setHorizonMonths] = useState(24)
  const [maxDrawdown, setMaxDrawdown] = useState(20)
  const [maxAllocation, setMaxAllocation] = useState(10)
  const [preferredSectors, setPreferredSectors] = useState<string[]>([])
  const [avoidedSectors, setAvoidedSectors] = useState<string[]>([])
  const [investmentGoals, setInvestmentGoals] = useState<InvestmentGoal[]>([])
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("intermediate")
  const [decisionStyle, setDecisionStyle] = useState<DecisionStyle>("hybrid")
  const [rebalanceFrequency, setRebalanceFrequency] = useState<RebalanceFrequency>("quarterly")
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [profileRes, presetsRes] = await Promise.all([
        fetch("/api/profile/investor"),
        fetch("/api/settings/strategy-presets"),
      ])
      if (presetsRes.ok) {
        const pd = await presetsRes.json()
        setPresets(pd.presets ?? [])
      }
      if (profileRes.ok) {
        const { profile: p } = await profileRes.json()
        if (p) {
          setProfile(p)
          setInvestorType(p.investor_type)
          setRiskTolerance(p.risk_tolerance)
          setRiskCapacity(p.risk_capacity)
          setHorizonMonths(p.investment_horizon?.default_months ?? 24)
          setMaxDrawdown(p.max_portfolio_drawdown_pct ?? 20)
          setMaxAllocation(p.max_single_stock_allocation_pct ?? 10)
          setPreferredSectors(p.preferred_sectors ?? [])
          setAvoidedSectors(p.avoided_sectors ?? [])
          setInvestmentGoals(p.investment_goals ?? [])
          setExperienceLevel(p.experience_level ?? "intermediate")
          setDecisionStyle(p.decision_style ?? "hybrid")
          setRebalanceFrequency(p.rebalance_frequency ?? "quarterly")
          setActivePresetId(p.active_strategy_preset_id ?? null)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      investor_type: investorType,
      risk_tolerance: riskTolerance,
      risk_capacity: riskCapacity,
      investment_horizon: {
        default_months: horizonMonths,
        min_months: Math.max(1, Math.floor(horizonMonths * 0.3)),
        max_months: Math.round(horizonMonths * 2.5),
      },
      max_portfolio_drawdown_pct: maxDrawdown,
      max_single_stock_allocation_pct: maxAllocation,
      preferred_sectors: preferredSectors,
      avoided_sectors: avoidedSectors,
      investment_goals: investmentGoals,
      experience_level: experienceLevel,
      decision_style: decisionStyle,
      rebalance_frequency: rebalanceFrequency,
      active_strategy_preset_id: activePresetId ?? null,
    }

    try {
      const method = profile ? "PATCH" : "POST"
      const res = await fetch("/api/profile/investor", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const { profile: updated } = await res.json()
        setProfile(updated)
        toast({ title: "Investor profile saved", description: "Your scoring preferences have been updated." })
      } else {
        const err = await res.json()
        toast({ title: err.error ?? "Failed to save", variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRecommendPreset() {
    setRecommending(true)
    try {
      const res = await fetch("/api/profile/investor/recommend-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investor_type: investorType, risk_tolerance: riskTolerance, investment_goals: investmentGoals, preferred_sectors: preferredSectors }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.preset?.id) {
          setActivePresetId(data.preset.id)
          toast({ title: `Strategy recommended: ${data.preset.name}`, description: data.preset.description })
        }
      }
    } finally {
      setRecommending(false)
    }
  }

  function toggleSector(sector: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(sector) ? list.filter((s) => s !== sector) : [...list, sector])
  }

  function toggleGoal(goal: InvestmentGoal) {
    setInvestmentGoals((prev) => prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal])
  }

  const activePreset = presets.find((p) => p.id === activePresetId)

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl pb-16">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-400" />
          Investor Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your profile personalises signal thresholds, scoring weights, and AI assistant responses.
          {!profile && <span className="ml-1 text-amber-400 font-medium">No profile yet — set one up to unlock personalised signals.</span>}
        </p>
      </div>

      {/* ── Investor Type ─────────────────────────────────────────────────── */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Investor Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {INVESTOR_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setInvestorType(type)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  investorType === type
                    ? "border-violet-500/60 bg-violet-500/10"
                    : "border-border/40 hover:border-border/80"
                }`}
              >
                <div className="text-lg">{INVESTOR_TYPE_ICONS[type]}</div>
                <div className="text-xs font-medium mt-1">{INVESTOR_TYPE_LABELS[type]}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">
            {INVESTOR_TYPE_DESCRIPTIONS[investorType]}
          </p>
        </CardContent>
      </Card>

      {/* ── Risk & Horizon ────────────────────────────────────────────────── */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Risk & Horizon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Risk Tolerance</label>
            <div className="flex gap-2 flex-wrap">
              {RISK_TOLERANCE_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setRiskTolerance(level)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    riskTolerance === level
                      ? "border-violet-500/60 bg-violet-500/10 text-white"
                      : "border-border/40 text-muted-foreground hover:border-border/80"
                  }`}
                >
                  {RISK_TOLERANCE_LABELS_TYPED[level]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Risk Capacity</label>
            <div className="flex gap-2">
              {RISK_CAPACITY_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setRiskCapacity(level as RiskCapacity)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-all capitalize ${
                    riskCapacity === level
                      ? "border-violet-500/60 bg-violet-500/10 text-white"
                      : "border-border/40 text-muted-foreground hover:border-border/80"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Investment Horizon — <span className="text-white font-medium">{horizonMonths} months</span>
            </label>
            <input
              type="range"
              min={1}
              max={60}
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>1m</span><span>12m</span><span>24m</span><span>36m</span><span>60m</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Max Drawdown — <span className="text-white font-medium">{maxDrawdown}%</span>
              </label>
              <input
                type="range"
                min={5}
                max={50}
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Max Single Stock — <span className="text-white font-medium">{maxAllocation}%</span>
              </label>
              <input
                type="range"
                min={2}
                max={25}
                value={maxAllocation}
                onChange={(e) => setMaxAllocation(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sectors ──────────────────────────────────────────────────────── */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Sector Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Preferred Sectors <span className="text-xs text-emerald-400">(+boost in scoring)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN_SECTORS.map((sector) => (
                <button
                  key={sector}
                  onClick={() => toggleSector(sector, preferredSectors, setPreferredSectors)}
                  disabled={avoidedSectors.includes(sector)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                    preferredSectors.includes(sector)
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                      : "border-border/40 text-muted-foreground hover:border-border/80 disabled:opacity-30"
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Avoided Sectors <span className="text-xs text-red-400">(−penalty in scoring)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN_SECTORS.map((sector) => (
                <button
                  key={sector}
                  onClick={() => toggleSector(sector, avoidedSectors, setAvoidedSectors)}
                  disabled={preferredSectors.includes(sector)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                    avoidedSectors.includes(sector)
                      ? "border-red-500/60 bg-red-500/10 text-red-400"
                      : "border-border/40 text-muted-foreground hover:border-border/80 disabled:opacity-30"
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Goals, Experience, Style ──────────────────────────────────────── */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Goals & Style</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Investment Goals</label>
            <div className="flex flex-wrap gap-2">
              {INVESTMENT_GOALS.map((goal) => (
                <button
                  key={goal}
                  onClick={() => toggleGoal(goal)}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                    investmentGoals.includes(goal)
                      ? "border-violet-500/60 bg-violet-500/10 text-white"
                      : "border-border/40 text-muted-foreground hover:border-border/80"
                  }`}
                >
                  {INVESTMENT_GOAL_LABELS[goal]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Experience Level</label>
              <div className="flex flex-col gap-1">
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setExperienceLevel(level as ExperienceLevel)}
                    className={`px-3 py-1.5 rounded-lg border text-xs text-left capitalize transition-all ${
                      experienceLevel === level
                        ? "border-violet-500/60 bg-violet-500/10 text-white"
                        : "border-border/40 text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Decision Style</label>
              <div className="flex flex-col gap-1">
                {DECISION_STYLES.map((style) => (
                  <button
                    key={style}
                    onClick={() => setDecisionStyle(style as DecisionStyle)}
                    className={`px-3 py-1.5 rounded-lg border text-xs text-left transition-all ${
                      decisionStyle === style
                        ? "border-violet-500/60 bg-violet-500/10 text-white"
                        : "border-border/40 text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    {DECISION_STYLE_LABELS[style]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Rebalance Frequency</label>
              <div className="flex flex-col gap-1">
                {REBALANCE_FREQUENCIES.map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setRebalanceFrequency(freq as RebalanceFrequency)}
                    className={`px-3 py-1.5 rounded-lg border text-xs text-left capitalize transition-all ${
                      rebalanceFrequency === freq
                        ? "border-violet-500/60 bg-violet-500/10 text-white"
                        : "border-border/40 text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    {freq.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Strategy Preset ───────────────────────────────────────────────── */}
      {presets.length > 0 && (
        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Strategy Preset</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                onClick={handleRecommendPreset}
                disabled={recommending}
              >
                {recommending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                AI Recommend
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setActivePresetId(preset.id === activePresetId ? null : preset.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    activePresetId === preset.id
                      ? "border-violet-500/60 bg-violet-500/10"
                      : "border-border/40 hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{preset.name}</span>
                    {activePresetId === preset.id && <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{preset.description}</p>
                  <div className="mt-2 flex gap-2 text-[9px] text-muted-foreground/70">
                    <span>M:{preset.scoring_weights.momentum}</span>
                    <span>V:{preset.scoring_weights.valuation}</span>
                    <span>P:{preset.scoring_weights.position}</span>
                    <span>A:{preset.scoring_weights.advisory}</span>
                    <span>Buy≥{preset.signal_thresholds.buy_min}</span>
                  </div>
                </button>
              ))}
            </div>
            {activePreset && (
              <div className="mt-3 rounded-lg bg-violet-500/5 border border-violet-500/20 p-3 text-xs text-muted-foreground">
                <span className="text-violet-300 font-medium">Active: {activePreset.name}</span> — signal thresholds and scoring weights from this preset override defaults.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {profile ? "Save Changes" : "Create Profile"}
        </Button>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reset
        </Button>
      </div>
    </div>
  )
}
