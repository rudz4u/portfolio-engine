import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const router = useRouter()
  const [holdings, setHoldings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [authChecking, setAuthChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) {
        router.push('/signin')
        return
      }
      setAuthChecking(false)

      const { data, error } = await supabase.from('holdings').select('*').order('instrument_key', { ascending: true })
      if (!mounted) return
      if (error) {
        setError(error.message)
      } else {
        setHoldings(data || [])
      }
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [router])

  const filtered = holdings.filter(h => {
    if (!filter) return true
    return String(h.instrument_key || '').toLowerCase().includes(filter.toLowerCase())
  })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageStart = (page - 1) * pageSize
  const pageItems = filtered.slice(pageStart, pageStart + pageSize)

  const investedTotal = filtered.reduce((s, h) => s + (Number(h.invested_amount) || 0), 0)
  const unrealizedTotal = filtered.reduce((s, h) => s + (Number(h.unrealized_pl) || 0), 0)

  function logout() {
    supabase.auth.signOut().then(() => router.push('/signin'))
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30 font-light pb-24">
      {/* Background gradients */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-zinc-950 to-zinc-950 pointer-events-none" />

      {/* Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/70 border-b border-white/5 px-4 md:px-6 py-4 flex flex-wrap md:flex-nowrap justify-between items-center transition-all gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-xl font-medium tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Portfolio Engine</h1>
        </div>
        <button
          onClick={logout}
          className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5"
        >
          Sign out
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 mt-12">
        {authChecking ? (
          <div className="flex flex-col items-center justify-center p-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-400 animate-pulse text-sm">Authenticating module...</p>
          </div>
        ) : (
          <>
            <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold mb-2">Overview</h2>
                <p className="text-sm text-zinc-500">Track and manage your equity positions.</p>
              </div>
              <div>
                <a
                  href="/api/oauth/upstox/authorize"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  Connect Broker
                </a>
              </div>
            </div>

            {/* Top metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg className="w-16 h-16 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-sm font-medium text-zinc-400 mb-1">Total Invested</p>
                <p className="text-3xl font-semibold text-white">₹{investedTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>

              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg className="w-16 h-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <p className="text-sm font-medium text-zinc-400 mb-1">Unrealized P/L</p>
                <p className={`text-3xl font-semibold ${unrealizedTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {unrealizedTotal >= 0 ? '+' : ''}₹{unrealizedTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg className="w-16 h-16 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <p className="text-sm font-medium text-zinc-400 mb-1">Holdings Count</p>
                <p className="text-3xl font-semibold text-white">{total}</p>
              </div>
            </div>

            {/* Content Section */}
            <section className="bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm overflow-hidden flex flex-col shadow-2xl">
              {/* Toolbar */}
              <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-900/50">
                <div className="relative w-full sm:w-auto flex-1 max-w-sm">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    placeholder="Search instrument..."
                    value={filter}
                    onChange={e => { setFilter(e.target.value); setPage(1) }}
                    className="w-full bg-zinc-950/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <span className="text-xs text-zinc-500 font-medium">ROWS PER PAGE</span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                    className="bg-zinc-950/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-colors cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="p-16 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : error ? (
                  <div className="p-16 text-center text-red-400">
                    <p>Failed to load holdings</p>
                    <p className="text-sm mt-1 opacity-70">{error}</p>
                  </div>
                ) : pageItems.length === 0 ? (
                  <div className="p-16 text-center text-zinc-500">
                    <p>No holdings found.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-950/30 border-b border-white/5 text-xs uppercase tracking-wider text-zinc-500 font-medium">
                        <th className="py-4 px-6 font-medium">Instrument</th>
                        <th className="py-4 px-6 font-medium text-right">Quantity</th>
                        <th className="py-4 px-6 font-medium text-right">Avg Price</th>
                        <th className="py-4 px-6 font-medium text-right">LTP</th>
                        <th className="py-4 px-6 font-medium text-right">Unrealized P/L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pageItems.map((h, i) => (
                        <tr
                          key={h.id}
                          className="hover:bg-white/[0.02] transition-colors group"
                        >
                          <td className="py-4 px-6">
                            <div className="font-medium text-zinc-200">{h.instrument_key?.split('|').pop() || h.instrument_key}</div>
                            <div className="text-xs text-zinc-600 mt-1 truncate max-w-[200px]">{h.instrument_key}</div>
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-zinc-300">
                            {h.quantity}
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-zinc-300">
                            ₹{Number(h.avg_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-6 text-right font-mono text-zinc-300">
                            ₹{Number(h.ltp).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-4 px-6 text-right font-mono">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${Number(h.unrealized_pl) >= 0
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                              {Number(h.unrealized_pl) >= 0 ? '+' : ''}
                              ₹{Number(h.unrealized_pl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {!loading && !error && filtered.length > 0 && (
                <div className="p-4 border-t border-white/5 bg-zinc-950/30 flex items-center justify-between text-sm text-zinc-400">
                  <div>
                    Showing <span className="text-white font-medium">{pageStart + 1}</span> to <span className="text-white font-medium">{Math.min(pageStart + pageSize, total)}</span> of <span className="text-white font-medium">{total}</span> results
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="px-2">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
