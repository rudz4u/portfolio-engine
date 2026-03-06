"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Database, CheckCircle2, AlertCircle } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

export default function DatabaseSettingsPage() {
  const { toast } = useToast()

  const [instrumentCount, setInstrumentCount] = useState<number | null>(null)
  const [lastSeeded, setLastSeeded] = useState<Date | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [loadingCount, setLoadingCount] = useState(true)

  useEffect(() => {
    loadInstrumentCount()
  }, [])

  async function loadInstrumentCount() {
    setLoadingCount(true)
    const res = await fetch("/api/instruments/count")
    if (res.ok) {
      const data = await res.json()
      setInstrumentCount(data.count)
      if (data.last_seeded) {
        setLastSeeded(new Date(data.last_seeded))
      }
    }
    setLoadingCount(false)
  }

  async function handleSeedInstruments() {
    setSeeding(true)
    const res = await fetch("/api/instruments/seed", { method: "POST" })
    setSeeding(false)
    if (res.ok) {
      toast({ title: "Instruments seeded successfully!" })
      loadInstrumentCount()
    } else {
      toast({ title: "Failed to seed instruments", variant: "destructive" })
    }
  }

  const seedingStatus =
    instrumentCount === null ? "empty" : instrumentCount === 0 ? "empty" : instrumentCount > 5000 ? "healthy" : "low"

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Database className="h-5 w-5" />Database</h2>
        <p className="text-muted-foreground text-sm">Instruments seeding and database management</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instruments Database</CardTitle>
          <CardDescription>Manages cached stock/ETF metadata from Upstox API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-4">
            <div className="p-4 rounded-lg border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Instruments</p>
                  {loadingCount ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading...</span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold mt-1">{instrumentCount || 0}</p>
                  )}
                </div>
                <div className="text-right">
                  {seedingStatus === "healthy" ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : seedingStatus === "low" ? (
                    <AlertCircle className="h-6 w-6 text-yellow-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  )}
                  <p
                    className={`text-xs font-medium mt-2 ${
                      seedingStatus === "healthy"
                        ? "text-green-600"
                        : seedingStatus === "low"
                          ? "text-yellow-600"
                          : "text-red-600"
                    }`}
                  >
                    {seedingStatus === "healthy" ? "Healthy" : seedingStatus === "low" ? "Low" : "Empty"}
                  </p>
                </div>
              </div>
              {lastSeeded && (
                <p className="text-xs text-muted-foreground mt-3">Last seeded: {lastSeeded.toLocaleString()}</p>
              )}
            </div>

            <div className="p-3 rounded-lg bg-muted border text-sm space-y-2">
              <p className="font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                About Seeding
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Fetches ~12,000 NSE stocks and ETFs from Upstox API</li>
                <li>Caches symbols, names, sectors, and trading metadata</li>
                <li>Required for watchlist, portfolio, and recommendation features</li>
                <li>Takes ~30–60 seconds on first run</li>
                <li>Safe to re-seed; existing data is updated, not duplicated</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={handleSeedInstruments}
            disabled={seeding}
            className="w-full"
            variant={instrumentCount && instrumentCount > 5000 ? "outline" : "default"}
          >
            {seeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {seeding ? "Seeding instruments..." : "Seed Instruments Now"}
          </Button>

          {seedingStatus === "healthy" && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-xs text-green-800">✓ Your instruments database is ready. You can proceed with portfolio management and recommendations.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
