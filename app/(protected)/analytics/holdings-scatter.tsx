"use client"

import { useMemo } from "react"
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Crosshair } from "lucide-react"

interface HoldingDot {
  symbol: string
  invested: number
  returnPct: number
  pnl: number
}

interface HoldingsScatterProps {
  holdings: HoldingDot[]
}

const fmtCr = (n: number) => {
  if (Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function HoldingsScatter({ holdings }: HoldingsScatterProps) {
  const positive = useMemo(
    () => holdings.filter((h) => h.returnPct >= 0),
    [holdings],
  )
  const negative = useMemo(
    () => holdings.filter((h) => h.returnPct < 0),
    [holdings],
  )

  if (holdings.length === 0) return null

  return (
    <Card className="glow-border-card glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono font-semibold flex items-center gap-2 text-[#00ffcc]/80 uppercase tracking-widest">
          <Crosshair className="h-4 w-4" /> Risk vs Return Map
          <span className="text-[10px] font-normal text-[#00ffcc]/40 ml-1 normal-case tracking-normal">
            (X = invested · Y = return % · size = investment weight)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart
            margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,255,200,0.06)"
            />
            <XAxis
              type="number"
              dataKey="invested"
              name="Invested"
              tickFormatter={fmtCr}
              tick={{
                fontSize: 10,
                fill: "rgba(0,255,200,0.45)",
                fontFamily: "monospace",
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="returnPct"
              name="Return"
              unit="%"
              tick={{
                fontSize: 10,
                fill: "rgba(0,255,200,0.45)",
                fontFamily: "monospace",
              }}
              axisLine={false}
              tickLine={false}
            />
            <ZAxis type="number" dataKey="invested" range={[40, 400]} />
            <ReferenceLine
              y={0}
              stroke="rgba(0,255,200,0.2)"
              strokeWidth={1.5}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload as HoldingDot
                return (
                  <div className="rounded border border-[#00ffcc]/30 bg-[#01100a]/95 backdrop-blur px-3 py-2 shadow-xl text-xs font-mono space-y-0.5">
                    <p className="font-bold text-[#00ffcc]">{d.symbol}</p>
                    <p className="text-white/60">
                      Invested: {fmtCr(d.invested)}
                    </p>
                    <p
                      className={
                        d.returnPct >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      Return: {d.returnPct >= 0 ? "+" : ""}
                      {d.returnPct.toFixed(2)}%
                    </p>
                    <p
                      className={
                        d.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      P&L: {d.pnl >= 0 ? "+" : ""}
                      {fmtCr(d.pnl)}
                    </p>
                  </div>
                )
              }}
            />
            {positive.length > 0 && (
              <Scatter
                name="Gainers"
                data={positive}
                fill="#00ffcc"
                fillOpacity={0.6}
              />
            )}
            {negative.length > 0 && (
              <Scatter
                name="Losers"
                data={negative}
                fill="#f43f5e"
                fillOpacity={0.6}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] font-mono text-white/40">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#00ffcc]/60" />
            Positive return
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]/60" />
            Negative return
          </div>
          <span className="text-white/20">|</span>
          <span>Bubble size = investment weight</span>
        </div>
      </CardContent>
    </Card>
  )
}
