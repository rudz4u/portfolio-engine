import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

interface Recommendation {
    instrument_name: string
    instrument_key: string
    current_price: string
    score: number
    signal: 'BUY' | 'SELL' | 'HOLD'
    insights: string[]
}

export default function Recommendations() {
    const router = useRouter()
    const [recommendations, setRecommendations] = useState<Recommendation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [executing, setExecuting] = useState<string | null>(null) // holds instrument matching ID if executing order

    useEffect(() => {
        let mounted = true
        async function load() {
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData?.session) {
                router.push('/signin')
                return
            }

            try {
                const response = await fetch('/api/recommendations')
                const data = await response.json()
                if (data.status === 'success' && mounted) {
                    // Sort by highest convincing signal (score)
                    const sorted = data.data.sort((a: Recommendation, b: Recommendation) => {
                        // Put BUYs at the top, then HOLDs, then SELLs with lowest scores at bottom
                        return b.score - a.score;
                    });
                    setRecommendations(sorted)
                } else {
                    setError('Failed to fetch algorithmic recommendations.')
                }
            } catch (err: any) {
                if (mounted) setError(err.message)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [router])

    async function executeOrder(rec: Recommendation) {
        if (rec.signal === 'HOLD') return;

        setExecuting(rec.instrument_key)
        const { data: sessionData } = await supabase.auth.getSession()

        try {
            const response = await fetch('/api/orders/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: sessionData?.session?.user.id,
                    instrument_key: rec.instrument_key,
                    side: rec.signal,
                    quantity: 10, // Mock fixed quantity
                    price: null
                })
            })

            const data = await response.json()
            if (response.ok) {
                alert(`Success: ${data.message}`)
            } else {
                alert(`Error: ${data.error}`)
            }
        } catch (err: any) {
            alert(`Request Failed: ${err.message}`)
        } finally {
            setExecuting(null)
        }
    }

    function logout() {
        supabase.auth.signOut().then(() => router.push('/signin'))
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30 font-light flex flex-col">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-zinc-950 to-zinc-950 pointer-events-none" />

            {/* Navbar */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/70 border-b border-white/5 px-4 md:px-6 py-4 flex flex-wrap md:flex-nowrap justify-between items-center transition-all gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <Link href="/dashboard" className="text-xl font-medium tracking-tight hover:text-indigo-400 transition-colors bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Portfolio Engine
                    </Link>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
                    <Link href="/assistant" className="text-zinc-400 hover:text-white transition-colors">AI Assistant</Link>
                    <button onClick={logout} className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5">
                        Sign out
                    </button>
                </div>
            </header>

            <main className="relative max-w-6xl mx-auto px-6 mt-12 w-full pb-20">
                <div className="mb-10">
                    <h2 className="text-3xl font-semibold mb-2">Quant Recommendations</h2>
                    <p className="text-sm text-zinc-500">Live signals calculated from your RSI, MACD, and Bollinger Bands matrices.</p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center p-24">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-zinc-400 animate-pulse text-sm">Processing quantitative arrays...</p>
                    </div>
                ) : error ? (
                    <div className="p-10 text-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl">
                        <p>Failed to load algorithms</p>
                        <p className="text-sm mt-1 opacity-70">{error}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recommendations.map((rec, i) => {
                            const buy = rec.signal === 'BUY';
                            const sell = rec.signal === 'SELL';

                            return (
                                <div key={i} className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm shadow-2xl flex flex-col relative overflow-hidden group hover:border-white/10 transition-all">

                                    {/* Status Indicator */}
                                    <div className={`absolute top-0 left-0 w-full h-1 ${buy ? 'bg-emerald-500' : sell ? 'bg-red-500' : 'bg-zinc-500'}`} />

                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-semibold text-lg text-white">{rec.instrument_name}</h3>
                                            <p className="text-xs text-zinc-500 font-mono mt-0.5 max-w-[150px] truncate">{rec.instrument_key}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono text-zinc-300">₹{rec.current_price}</p>
                                            <div className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${buy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : sell ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-zinc-800 text-zinc-400 border border-white/10'}`}>
                                                {rec.signal} ({rec.score})
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-zinc-950/50 rounded-xl p-4 border border-white/5 mb-6">
                                        <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">Algorithmic Insights</p>
                                        <ul className="space-y-2">
                                            {rec.insights.map((insight, idx) => (
                                                <li key={idx} className="text-sm text-zinc-400 flex items-start gap-2 leading-snug">
                                                    <span className="text-indigo-400 opacity-60 mt-0.5">•</span>
                                                    {insight}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <button
                                        onClick={() => executeOrder(rec)}
                                        disabled={rec.signal === 'HOLD' || executing === rec.instrument_key}
                                        className={`w-full font-medium rounded-xl py-2.5 transition-all text-sm flex items-center justify-center gap-2 ${rec.signal === 'HOLD'
                                                ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed border border-white/5'
                                                : buy
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                                    : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                                            }`}
                                    >
                                        {executing === rec.instrument_key ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                Routing to Upstox...
                                            </>
                                        ) : (
                                            rec.signal === 'HOLD' ? 'Monitor Signals' : `Execute 10x ${rec.signal} Market`
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}
