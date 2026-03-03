"use client"

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const SEGMENT_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#14b8a6", // teal
]

interface SegmentEntry {
  name: string
  value: number
  pct: number
}

interface MoverEntry {
  symbol: string
  pnl: number
}

interface HoldingForChart {
  instrument_key: string
  unrealized_pl?: number | null
  raw?: Record<string, unknown> | null
}

interface PortfolioChartsProps {
  segments: Record<string, number>
  totalInvested: number
  topGainers: HoldingForChart[]
  topLosers: HoldingForChart[]
}

function shortSymbol(h: HoldingForChart): string {
  const ts = (h.raw as Record<string, unknown> | null)?.trading_symbol as string | undefined
  if (ts) return ts.length > 10 ? ts : ts
  // fallback: strip exchange prefix from instrument_key
  const parts = h.instrument_key.split("|")
  const raw = parts[parts.length - 1] || h.instrument_key
  return raw.length > 10 ? raw.slice(0, 10) : raw
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }: any) => {
  if (pct < 4) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {pct.toFixed(0)}%
    </text>
  )
}

export function PortfolioCharts({ segments, totalInvested, topGainers, topLosers }: PortfolioChartsProps) {
  const segData: SegmentEntry[] = Object.entries(segments)
    .map(([name, value]) => ({ name, value, pct: totalInvested > 0 ? (value / totalInvested) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  const moversData: MoverEntry[] = [
    ...topGainers.map((h) => ({ symbol: shortSymbol(h), pnl: Number((h.unrealized_pl ?? 0).toFixed(0)) })),
    ...topLosers.map((h) => ({ symbol: shortSymbol(h), pnl: Number((h.unrealized_pl ?? 0).toFixed(0)) })),
  ].sort((a, b) => b.pnl - a.pnl).slice(0, 10)

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Sector pie */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sector Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={segData}
                cx="50%"
                cy="50%"
                outerRadius={95}
                dataKey="value"
                labelLine={false}
                label={CustomPieLabel}
              >
                {segData.map((_, i) => (
                  <Cell key={i} fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number | undefined, name: string | undefined) => [
                  value != null ? `₹${value.toLocaleString("en-IN")}` : "—",
                  name ?? "",
                ]}
              />
              <Legend
                formatter={(value) => <span className="text-xs">{value}</span>}
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top movers bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Movers (P&amp;L ₹)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={moversData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="symbol"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip
                formatter={(value: number | undefined) => [
                  value != null ? `₹${value.toLocaleString("en-IN")}` : "—",
                  "P&L",
                ]}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {moversData.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
