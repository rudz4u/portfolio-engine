"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"

interface SnapshotRow {
  snapshot_date: string
  total_invested: number
  total_value: number
  total_pnl: number
  pnl_pct: number
}

const fmtCr = (n: number) => {
  if (Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function PortfolioTimeline() {
  const [data, setData] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: portfolio } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (!portfolio) {
        setLoading(false)
        return
      }

      const since = new Date()
      since.setDate(since.getDate() - 90)

      const { data: snapshots } = await supabase
        .from("portfolio_snapshots")
        .select(
          "snapshot_date, total_invested, total_value, total_pnl, pnl_pct",
        )
        .eq("portfolio_id", portfolio.id)
        .gte("snapshot_date", since.toISOString().slice(0, 10))
        .order("snapshot_date", { ascending: true })

      setData(snapshots ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (!loading && data.length < 2) return null

  // 90-day stats
  const first = data[0]
  const last = data[data.length - 1]
  const valueChange =
    first && last ? last.total_value - first.total_value : 0
  const pctChange =
    first && first.total_value > 0
      ? ((last.total_value - first.total_value) / first.total_value) * 100
      : 0

  return (
    <Card className="glow-border-card glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono font-semibold flex items-center gap-2 text-[#00ffcc]/80 uppercase tracking-widest">
          <Clock className="h-4 w-4" /> Portfolio Value — 90 Day Timeline
          {!loading && data.length >= 2 && (
            <Badge
              variant="secondary"
              className={`ml-auto text-xs font-mono border ${
                pctChange >= 0
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {pctChange >= 0 ? "+" : ""}
              {pctChange.toFixed(2)}% ({pctChange >= 0 ? "+" : ""}
              {fmtCr(valueChange)})
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 4, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ffcc" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ffcc" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gInvested" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0,255,200,0.06)"
              />
              <XAxis
                dataKey="snapshot_date"
                tick={{
                  fontSize: 10,
                  fill: "rgba(0,255,200,0.45)",
                  fontFamily: "monospace",
                }}
                tickFormatter={(d: string) =>
                  new Date(d).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })
                }
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtCr}
                tick={{
                  fontSize: 10,
                  fill: "rgba(0,255,200,0.45)",
                  fontFamily: "monospace",
                }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload as SnapshotRow
                  return (
                    <div className="rounded border border-[#00ffcc]/30 bg-[#01100a]/95 backdrop-blur px-3 py-2 shadow-xl text-xs font-mono space-y-1">
                      <p className="text-[#00ffcc]/70 text-[10px] uppercase tracking-wider">
                        {new Date(d.snapshot_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-[#7c3aed]">
                        Invested: {fmtCr(d.total_invested)}
                      </p>
                      <p className="text-[#00ffcc]">
                        Value: {fmtCr(d.total_value)}
                      </p>
                      <p
                        className={
                          d.total_pnl >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      >
                        P&L: {d.total_pnl >= 0 ? "+" : ""}
                        {fmtCr(d.total_pnl)} ({d.pnl_pct >= 0 ? "+" : ""}
                        {d.pnl_pct.toFixed(2)}%)
                      </p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="total_invested"
                stroke="#7c3aed"
                strokeWidth={1.5}
                fill="url(#gInvested)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="total_value"
                stroke="#00ffcc"
                strokeWidth={2}
                fill="url(#gValue)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {!loading && data.length >= 2 && (
          <div className="flex items-center justify-center gap-6 mt-2 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-[#00ffcc]" />
              <span className="text-[#00ffcc]/60">Portfolio Value</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-[#7c3aed]" />
              <span className="text-[#7c3aed]/60">Amount Invested</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
