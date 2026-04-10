"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Trash2, Target, Shield, Calendar, Tag, AlertCircle } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"
import {
  HOLDING_GOALS,
  HOLDING_GOAL_LABELS,
  type HoldingOverride,
  type HoldingGoal,
} from "@/lib/types/investor-profile"

interface StockOverrideFormProps {
  instrumentKey: string
  tradingSymbol: string
  currentLtp?: number
  avgPrice?: number
}

export default function StockOverrideForm({
  instrumentKey,
  tradingSymbol,
  currentLtp,
  avgPrice,
}: StockOverrideFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [override, setOverride] = useState<HoldingOverride | null>(null)

  // Form state
  const [goal, setGoal] = useState<HoldingGoal | "">("")
  const [goalNotes, setGoalNotes] = useState("")
  const [targetPrice, setTargetPrice] = useState("")
  const [stopLossPrice, setStopLossPrice] = useState("")
  const [trailingStopPct, setTrailingStopPct] = useState("")
  const [signalOverride, setSignalOverride] = useState<"" | "force_hold" | "force_watch">("")
  const [maxAllocationPct, setMaxAllocationPct] = useState("")
  const [riskNote, setRiskNote] = useState("")
  const [holdUntil, setHoldUntil] = useState("")
  const [minHoldMonths, setMinHoldMonths] = useState("")

  const loadOverride = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/holdings/overrides?instrument_key=${encodeURIComponent(instrumentKey)}`)
      const data = await res.json()
      const ovr = data.overrides?.[0] as HoldingOverride | undefined
      if (ovr) {
        setOverride(ovr)
        setGoal(ovr.goal ?? "")
        setGoalNotes(ovr.goal_notes ?? "")
        setTargetPrice(ovr.target_price?.toString() ?? "")
        setStopLossPrice(ovr.stop_loss_price?.toString() ?? "")
        setTrailingStopPct(ovr.trailing_stop_pct?.toString() ?? "")
        setSignalOverride(ovr.custom_signal_override ?? "")
        setMaxAllocationPct(ovr.max_allocation_pct?.toString() ?? "")
        setRiskNote(ovr.risk_note ?? "")
        setHoldUntil(ovr.hold_until ?? "")
        setMinHoldMonths(ovr.min_hold_months?.toString() ?? "")
      }
    } catch {
      // First load — no override yet
    }
    setLoading(false)
  }, [instrumentKey])

  useEffect(() => { loadOverride() }, [loadOverride])

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        instrument_key: instrumentKey,
        trading_symbol: tradingSymbol,
      }
      if (goal) body.goal = goal
      if (goalNotes.trim()) body.goal_notes = goalNotes.trim()
      if (targetPrice) body.target_price = parseFloat(targetPrice)
      if (stopLossPrice) body.stop_loss_price = parseFloat(stopLossPrice)
      if (trailingStopPct) body.trailing_stop_pct = parseFloat(trailingStopPct)
      if (signalOverride) body.custom_signal_override = signalOverride
      if (maxAllocationPct) body.max_allocation_pct = parseFloat(maxAllocationPct)
      if (riskNote.trim()) body.risk_note = riskNote.trim()
      if (holdUntil) body.hold_until = holdUntil
      if (minHoldMonths) body.min_hold_months = parseInt(minHoldMonths, 10)

      const res = await fetch("/api/holdings/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save")
      }
      toast({ title: "Saved", description: `Override for ${tradingSymbol} updated.` })
      loadOverride()
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" })
    }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/holdings/overrides?instrument_key=${encodeURIComponent(instrumentKey)}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete")
      setOverride(null)
      setGoal("")
      setGoalNotes("")
      setTargetPrice("")
      setStopLossPrice("")
      setTrailingStopPct("")
      setSignalOverride("")
      setMaxAllocationPct("")
      setRiskNote("")
      setHoldUntil("")
      setMinHoldMonths("")
      toast({ title: "Deleted", description: `Override for ${tradingSymbol} removed.` })
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" })
    }
    setDeleting(false)
  }

  if (loading) {
    return (
      <Card className="bg-[hsl(222,47%,8%)] border-white/10">
        <CardContent className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading stock settings…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-[hsl(222,47%,8%)] border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-400" />
          Stock Strategy — {tradingSymbol}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Set per-stock goals, price targets, stop-losses, and signal overrides.
          These settings personalise signals for this specific holding.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Investment Goal ─────────────────────────────────── */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-violet-400" /> Investment Goal
          </label>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as HoldingGoal | "")}
            className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="">— Use portfolio default —</option>
            {HOLDING_GOALS.map((g) => (
              <option key={g} value={g}>{HOLDING_GOAL_LABELS[g]}</option>
            ))}
          </select>
          <textarea
            placeholder="Notes about this position (optional)"
            value={goalNotes}
            onChange={(e) => setGoalNotes(e.target.value)}
            rows={2}
            className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
          />
        </fieldset>

        {/* ── Target Price & Stop-Loss ────────────────────────── */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-emerald-400" /> Price Targets
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Target Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={currentLtp ? `LTP: ₹${currentLtp.toFixed(2)}` : "Target sell price"}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stop-Loss (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={avgPrice ? `Avg: ₹${avgPrice.toFixed(2)}` : "Stop-loss trigger"}
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value)}
                className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
              />
            </div>
          </div>
          {targetPrice && currentLtp && parseFloat(targetPrice) > 0 && (
            <p className="text-xs text-emerald-400/80">
              Upside: {(((parseFloat(targetPrice) - currentLtp) / currentLtp) * 100).toFixed(1)}% from current LTP
            </p>
          )}
          {stopLossPrice && currentLtp && parseFloat(stopLossPrice) > 0 && (
            <p className="text-xs text-red-400/80">
              Downside risk: {(((currentLtp - parseFloat(stopLossPrice)) / currentLtp) * 100).toFixed(1)}% from current LTP
            </p>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Trailing Stop-Loss (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="50"
              placeholder="e.g. 10 (triggers if price drops 10% from peak)"
              value={trailingStopPct}
              onChange={(e) => setTrailingStopPct(e.target.value)}
              className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
        </fieldset>

        {/* ── Signal Override ─────────────────────────────────── */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-blue-400" /> Signal Override
          </label>
          <select
            value={signalOverride}
            onChange={(e) => setSignalOverride(e.target.value as "" | "force_hold" | "force_watch")}
            className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="">— Use computed signal —</option>
            <option value="force_hold">Pin to HOLD (ignore SELL signals)</option>
            <option value="force_watch">Pin to WATCH (monitoring only)</option>
          </select>
          {signalOverride && (
            <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/10 rounded-lg p-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Signal override will prevent automatic BUY/SELL signals for this stock. Stop-loss triggers still apply.
            </div>
          )}
        </fieldset>

        {/* ── Allocation & Holding Period ─────────────────────── */}
        <fieldset className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-amber-400" /> Allocation & Time
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Allocation (%)</label>
              <input
                type="number"
                step="1"
                min="1"
                max="50"
                placeholder="e.g. 10"
                value={maxAllocationPct}
                onChange={(e) => setMaxAllocationPct(e.target.value)}
                className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Hold (months)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="120"
                placeholder="e.g. 6"
                value={minHoldMonths}
                onChange={(e) => setMinHoldMonths(e.target.value)}
                className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Hold Until (date)</label>
            <input
              type="date"
              value={holdUntil}
              onChange={(e) => setHoldUntil(e.target.value)}
              className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
          <textarea
            placeholder="Risk notes (optional, e.g. 'High-risk speculative bet — small position')"
            value={riskNote}
            onChange={(e) => setRiskNote(e.target.value)}
            rows={2}
            className="w-full bg-[hsl(222,47%,11%)] border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
          />
        </fieldset>

        {/* ── Actions ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Override
          </Button>
          {override && (
            <Button
              onClick={handleDelete}
              disabled={deleting}
              variant="outline"
              className="border-red-400/30 text-red-400 hover:bg-red-400/10"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Remove Override
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
