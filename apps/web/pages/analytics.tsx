import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

interface AnalyticsData {
    totalInvested: number
    totalCurrentValue: number
    totalUnrealizedPL: number
    plPercent: number
    holdingsCount: number
    topGainers: { name: string; key: string; pl: number; plPct: number }[]
    topLosers: { name: string; key: string; pl: number; plPct: number }[]
    sectorBreakdown: { sector: string; amount: number; percent: number }[]
    holdingsList: { name: string; key: string; quantity: number; avgPrice: number; ltp: number; investedAmount: number; unrealizedPL: number; plPct: number }[]
}

const SECTOR_COLORS: Record<string, string> = {
    'IT': '#6366f1',
    'Banking': '#22d3ee',
    'Energy': '#f59e0b',
    'Pharma': '#10b981',
    'FMCG': '#f472b6',
    'Auto': '#a78bfa',
    'Metals': '#fb923c',
    'Others': '#71717a',
}

export default function Analytics() {
    const router = useRouter()
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        async function load() {
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData?.session) {
                router.push('/signin')
                return
            }
            try {
                const res = await fetch('/api/portfolio/analytics')
                const json = await res.json()
                if (json.status === 'success' && mounted) {
                    setData(json.data)
                } else {
                    setError(json.message || 'Failed to load analytics')
                }
            } catch (e: any) {
                if (mounted) setError(e.message)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [router])

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans pb-24">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/10 via-zinc-950 to-zinc-950 pointer-events-none" />

            {/* Navbar */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/70 border-b border-white/5 px-4 md:px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-medium tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Portfolio Analytics</h1>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
                    <Link href="/recommendations" className="text-sm text-zinc-400 hover:text-white transition-colors">Signals</Link>
                    <Link href="/assistant" className="text-sm text-zinc-400 hover:text-white transition-colors">Assistant</Link>
                    <Link href="/settings" className="text-sm text-zinc-400 hover:text-white transition-colors">Settings</Link>
                </div>
            </header>

            <main className="relative max-w-7xl mx-auto px-6 mt-10">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-24">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <p className="mt-4 text-zinc-400 text-sm animate-pulse">Loading portfolio analytics...</p>
                    </div>
                ) : error ? (
                    <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-300">{error}</div>
                ) : !data ? null : (
                    <>
                        <div className="mb-8">
                            <h2 className="text-3xl font-semibold">Portfolio Overview</h2>
                            <p className="text-zinc-500 text-sm mt-1">Sector breakdown, P&L analysis, and position rankings.</p>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            {[
                                { label: 'Total Invested', value: `₹${data.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'text-white', bg: 'from-indigo-500/10' },
                                { label: 'Current Value', value: `₹${data.totalCurrentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: 'text-white', bg: 'from-purple-500/10' },
                                { label: 'Unrealized P&L', value: `${data.totalUnrealizedPL >= 0 ? '+' : ''}₹${data.totalUnrealizedPL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: data.totalUnrealizedPL >= 0 ? 'text-emerald-400' : 'text-red-400', bg: data.totalUnrealizedPL >= 0 ? 'from-emerald-500/10' : 'from-red-500/10' },
                                { label: 'Returns', value: `${data.plPercent >= 0 ? '+' : ''}${data.plPercent.toFixed(2)}%`, color: data.plPercent >= 0 ? 'text-emerald-400' : 'text-red-400', bg: data.plPercent >= 0 ? 'from-emerald-500/10' : 'from-red-500/10' },
                            ].map(m => (
                                <div key={m.label} className={`bg-zinc-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-sm bg-gradient-to-br ${m.bg} to-transparent`}>
                                    <p className="text-xs text-zinc-500 font-medium mb-2 uppercase tracking-wider">{m.label}</p>
                                    <p className={`text-2xl font-semibold ${m.color}`}>{m.value}</p>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Sector Breakdown */}
                            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
                                <h3 className="text-lg font-medium mb-5 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                                    Sector Allocation
                                </h3>
                                {data.sectorBreakdown.length === 0 ? (
                                    <p className="text-zinc-500 text-sm">No data yet. Sync holdings from Dashboard.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {data.sectorBreakdown.map(s => (
                                            <div key={s.sector}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-zinc-300 font-medium">{s.sector}</span>
                                                    <span className="text-zinc-400">₹{s.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} · {s.percent.toFixed(1)}%</span>
                                                </div>
                                                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700"
                                                        style={{ width: `${Math.min(100, s.percent)}%`, backgroundColor: SECTOR_COLORS[s.sector] || SECTOR_COLORS['Others'] }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Gainers & Losers */}
                            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm space-y-5">
                                <div>
                                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2 text-emerald-400">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                        Top Gainers
                                    </h3>
                                    {data.topGainers.length === 0 ? (
                                        <p className="text-zinc-500 text-sm">No gainers yet.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {data.topGainers.map(g => (
                                                <div key={g.key} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                                                    <span className="text-zinc-200 text-sm font-medium">{g.name}</span>
                                                    <div className="text-right">
                                                        <span className="text-emerald-400 text-sm font-mono">+₹{g.pl.toFixed(2)}</span>
                                                        <span className="text-emerald-500/70 text-xs ml-2">({g.plPct.toFixed(2)}%)</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2 text-red-400">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17H5m0 0v-8m0 8l8-8 4 4 6-6" /></svg>
                                        Top Losers
                                    </h3>
                                    {data.topLosers.length === 0 ? (
                                        <p className="text-zinc-500 text-sm">No losers — all positions green! 🎉</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {data.topLosers.map(l => (
                                                <div key={l.key} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                                                    <span className="text-zinc-200 text-sm font-medium">{l.name}</span>
                                                    <div className="text-right">
                                                        <span className="text-red-400 text-sm font-mono">₹{l.pl.toFixed(2)}</span>
                                                        <span className="text-red-500/70 text-xs ml-2">({l.plPct.toFixed(2)}%)</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Full Holdings Table */}
                        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-lg font-medium">All Positions ({data.holdingsCount})</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-950/30 border-b border-white/5 text-xs uppercase tracking-wider text-zinc-500">
                                            <th className="py-3 px-5">Instrument</th>
                                            <th className="py-3 px-5 text-right">Qty</th>
                                            <th className="py-3 px-5 text-right">Avg Price</th>
                                            <th className="py-3 px-5 text-right">LTP</th>
                                            <th className="py-3 px-5 text-right">Invested</th>
                                            <th className="py-3 px-5 text-right">P&L</th>
                                            <th className="py-3 px-5 text-right">Return %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {data.holdingsList.map(h => (
                                            <tr key={h.key} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-3 px-5 font-medium text-zinc-200">{h.name}</td>
                                                <td className="py-3 px-5 text-right font-mono text-zinc-300">{h.quantity}</td>
                                                <td className="py-3 px-5 text-right font-mono text-zinc-300">₹{h.avgPrice.toFixed(2)}</td>
                                                <td className="py-3 px-5 text-right font-mono text-zinc-300">₹{h.ltp.toFixed(2)}</td>
                                                <td className="py-3 px-5 text-right font-mono text-zinc-400">₹{h.investedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                                <td className="py-3 px-5 text-right font-mono">
                                                    <span className={h.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                        {h.unrealizedPL >= 0 ? '+' : ''}₹{h.unrealizedPL.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-5 text-right">
                                                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${h.plPct >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {h.plPct >= 0 ? '+' : ''}{h.plPct.toFixed(2)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
