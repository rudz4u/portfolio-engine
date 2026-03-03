import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

export default function Dashboard() {
  const router = useRouter()
  const [holdings, setHoldings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [authChecking, setAuthChecking] = useState(true)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [brokerStatus, setBrokerStatus] = useState<any>(null)

  // Check query params for OAuth/sandbox messages
  const queryInfo = router.query.info as string | undefined
  const queryError = router.query.error as string | undefined
  const querySuccess = router.query.success as string | undefined

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

      // Fetch broker connection status
      try {
        const connRes = await fetch('/api/upstox/test-connection')
        const connData = await connRes.json()
        if (mounted) setBrokerStatus(connData)
      } catch { /* ignore */ }
    }
    load()
    return () => { mounted = false }
  }, [router])

  async function handleSync() {
    setSyncing(true)
    setSyncStatus(null)
    try {
      const res = await fetch('/api/holdings/sync')
      const data = await res.json()
      setSyncStatus(data)
      if (data.status === 'success' && data.data?.length > 0) {
        // Reload holdings from Supabase
        const { data: refreshed } = await supabase.from('holdings').select('*').order('instrument_key', { ascending: true })
        if (refreshed) setHoldings(refreshed)
      }
    } catch (err: any) {
      setSyncStatus({ status: 'error', message: err.message })
    }
    setSyncing(false)
  }

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
  const plPercent = investedTotal > 0 ? (unrealizedTotal / investedTotal) * 100 : 0

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
        <div className="flex items-center gap-4">
          <Link href="/analytics" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Analytics
          </Link>
          <Link href="/recommendations" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Signals
          </Link>
          <Link href="/assistant" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Assistant
          </Link>
          <Link href="/sandbox" className="text-sm font-medium text-amber-400/80 hover:text-amber-300 transition-colors">
            🧪 Sandbox
          </Link>
          <Link href="/settings" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Settings
          </Link>
          <button
            onClick={logout}
            className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5"
          >
            Sign out
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 mt-12">
        {authChecking ? (
          <div className="flex flex-col items-center justify-center p-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-zinc-400 animate-pulse text-sm">Authenticating module...</p>
          </div>
        ) : (
          <>
            {/* Info/Error banners from redirects */}
            {queryInfo === 'sandbox_no_oauth' && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 animate-in fade-in">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm text-amber-300">
                  <strong>Sandbox Mode:</strong> OAuth login isn&apos;t supported in sandbox mode. Go to{' '}
                  <Link href="/settings" className="text-indigo-400 underline hover:text-indigo-300">Settings</Link>{' '}
                  and paste your sandbox access token from the Upstox Developer Portal.
                </p>
              </div>
            )}
            {queryError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                <p className="text-sm text-red-300">
                  {queryError === 'missing_config'
                    ? 'Upstox API credentials not configured. Go to Settings to add them.'
                    : `Broker connection error: ${queryError}`
                  }
                </p>
              </div>
            )}
            {querySuccess === 'oauth_completed' && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm text-emerald-300">Successfully connected to Upstox!</p>
              </div>
            )}

            <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-semibold mb-2">Overview</h2>
                <p className="text-sm text-zinc-500">Track and manage your equity positions.</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Dynamic mode indicator */}
                {brokerStatus?.mode === 'sandbox' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    {brokerStatus?.sandbox_order_available ? '🟢 Sandbox Ready' : '🧪 Sandbox'}
                  </span>
                ) : brokerStatus?.status === 'connected' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                ) : null}

                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-white/10 disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {syncing ? 'Syncing...' : 'Sync Holdings'}
                </button>

                <a
                  href="/api/oauth/upstox/authorize"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  Connect Broker
                </a>
              </div>
            </div>

            {/* Sync status */}
            {syncStatus && (
              <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${syncStatus.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-zinc-800/50 border-white/5'
                }`}>
                <p className="text-sm text-zinc-300">{syncStatus.message}</p>
              </div>
            )}

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
                <Link href="/analytics" className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                  View Analytics →
                </Link>
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
