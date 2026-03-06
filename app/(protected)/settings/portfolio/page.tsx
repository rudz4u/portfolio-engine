"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, RotateCcw, TrendingUp } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

export default function PortfolioSettingsPage() {
  const { toast } = useToast()

  // Scoring weights
  const [momentumWeight, setMomentumWeight] = useState(25)
  const [valuationWeight, setValuationWeight] = useState(25)
  const [positionWeight, setPositionWeight] = useState(25)
  const [advisoryWeight, setAdvisoryWeight] = useState(25)
  const [scoringError, setScoringError] = useState("")

  // Asset allocation
  const [largeCap, setLargeCap] = useState(30)
  const [midCap, setMidCap] = useState(30)
  const [smallCap, setSmallCap] = useState(20)
  const [sectoral, setSectoral] = useState(20)
  const [hhi, setHhi] = useState(2600)

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const res = await fetch("/api/settings")
    if (!res.ok) return
    const data = await res.json()
    if (data.scoring_weights) {
      setMomentumWeight(data.scoring_weights.momentum || 25)
      setValuationWeight(data.scoring_weights.valuation || 25)
      setPositionWeight(data.scoring_weights.position || 25)
      setAdvisoryWeight(data.scoring_weights.advisory || 25)
    }
    if (data.asset_allocation) {
      setLargeCap(data.asset_allocation.large_cap || 30)
      setMidCap(data.asset_allocation.mid_cap || 30)
      setSmallCap(data.asset_allocation.small_cap || 20)
      setSectoral(data.asset_allocation.sectoral || 20)
    }
  }

  // Validate scoring weights
  const totalScoring = momentumWeight + valuationWeight + positionWeight + advisoryWeight
  useEffect(() => {
    if (totalScoring !== 100) {
      setScoringError(`Total must equal 100 (currently ${totalScoring})`)
    } else {
      setScoringError("")
    }
  }, [momentumWeight, valuationWeight, positionWeight, advisoryWeight, totalScoring])

  // Calculate Herfindahl-Hirschman Index for diversification
  useEffect(() => {
    const hhiValue = largeCap ** 2 + midCap ** 2 + smallCap ** 2 + sectoral ** 2
    setHhi(hhiValue)
  }, [largeCap, midCap, smallCap, sectoral])

  const getDiversificationLevel = () => {
    if (hhi < 2500) return { label: "High", color: "text-green-600", desc: "Well diversified" }
    if (hhi < 4000) return { label: "Moderate", color: "text-yellow-600", desc: "Acceptable spread" }
    return { label: "Low", color: "text-red-600", desc: "Concentrated allocation" }
  }

  const handleResetWeights = () => {
    setMomentumWeight(25)
    setValuationWeight(25)
    setPositionWeight(25)
    setAdvisoryWeight(25)
  }

  const handleResetAllocation = () => {
    setLargeCap(30)
    setMidCap(30)
    setSmallCap(20)
    setSectoral(20)
  }

  async function handleSave() {
    if (scoringError) {
      toast({ title: "Fix scoring weights error first", variant: "destructive" })
      return
    }
    setSaving(true)
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scoring_weights: {
          momentum: momentumWeight,
          valuation: valuationWeight,
          position: positionWeight,
          advisory: advisoryWeight,
        },
        asset_allocation: {
          large_cap: largeCap,
          mid_cap: midCap,
          small_cap: smallCap,
          sectoral: sectoral,
        },
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast({ title: "Portfolio settings saved!" })
    } else {
      toast({ title: "Failed to save settings", variant: "destructive" })
    }
  }

  const ScalingSliders = ({
    values,
    onChange,
    labels,
    onReset,
  }: {
    values: number[]
    onChange: (index: number, value: number) => void
    labels: string[]
    onReset: () => void
  }) => (
    <div className="space-y-4">
      {labels.map((label, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">{label}</label>
            <span className="text-sm font-semibold text-primary">{values[i]}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={values[i]}
            onChange={(e) => onChange(i, parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      ))}
      <Button onClick={onReset} variant="outline" className="w-full">
        <RotateCcw className="mr-2 h-4 w-4" />
        Reset to Defaults
      </Button>
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5" />Portfolio Strategy</h2>
        <p className="text-muted-foreground text-sm">Configure scoring weights and asset allocation preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scoring Weights</CardTitle>
          <CardDescription>How much each factor influences your stock recommendations (total must equal 100%)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ScalingSliders
            values={[momentumWeight, valuationWeight, positionWeight, advisoryWeight]}
            onChange={(i, v) => {
              ;[setMomentumWeight, setValuationWeight, setPositionWeight, setAdvisoryWeight][i](v)
            }}
            labels={["Momentum", "Valuation", "Position Size", "Advisory Signals"]}
            onReset={handleResetWeights}
          />
          {scoringError && <p className="text-xs text-destructive">{scoringError}</p>}
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs font-medium">Total: {totalScoring}%</p>
            <p className="text-xs text-muted-foreground mt-1">Rules: Momentum (fast, trend-based), Valuation (P/E, PB, dividend), Position (portfolio fit, risk), Advisory (expert signals)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
          <CardDescription>Target allocation across market caps (portfolio composition)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ScalingSliders
            values={[largeCap, midCap, smallCap, sectoral]}
            onChange={(i, v) => {
              ;[setLargeCap, setMidCap, setSmallCap, setSectoral][i](v)
            }}
            labels={["Large Cap (NIFTY 50)", "Mid Cap (NIFTY 100–200)", "Small Cap (< NIFTY 200)", "Sector Focus"]}
            onReset={handleResetAllocation}
          />

          <div className="space-y-2">
            <p className="text-xs font-medium">Diversification Score (HHI)</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <div className="w-full bg-muted rounded-lg h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                    style={{ width: `${Math.min((hhi / 10000) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">0 (perfect) ← HHI: {Math.floor(hhi)} → 10000 (extreme)</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${getDiversificationLevel().color}`}>{getDiversificationLevel().label}</p>
                <p className="text-xs text-muted-foreground">{getDiversificationLevel().desc}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || !!scoringError} className="w-full">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save Portfolio Strategy
      </Button>
    </div>
  )
}
