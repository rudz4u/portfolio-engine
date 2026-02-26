import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

interface OrderRecord {
    id: string
    instrument_key: string
    side: string
    quantity: number
    price: number | null
    status: string
    external_order_id: string | null
    meta: any
    created_at: string
}

export default function SandboxTest() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [connectionStatus, setConnectionStatus] = useState<any>(null)
    const [orders, setOrders] = useState<OrderRecord[]>([])
    const [placing, setPlacing] = useState(false)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
    const [userId, setUserId] = useState<string>('')

    // Order form state
    const [instrumentKey, setInstrumentKey] = useState('NSE_EQ|INE669E01016')
    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
    const [quantity, setQuantity] = useState('1')
    const [price, setPrice] = useState('')
    const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET')
    const [product, setProduct] = useState<'D' | 'I'>('D')

    // Modify/Cancel form state
    const [modifyOrderId, setModifyOrderId] = useState('')
    const [modifyQty, setModifyQty] = useState('')
    const [modifyPrice, setModifyPrice] = useState('')
    const [cancelOrderId, setCancelOrderId] = useState('')

    const PRESET_INSTRUMENTS = [
        { key: 'NSE_EQ|INE669E01016', label: 'VODAFONE IDEA' },
        { key: 'NSE_EQ|INE002A01018', label: 'RELIANCE' },
        { key: 'NSE_EQ|INE467B01029', label: 'TCS' },
        { key: 'NSE_EQ|INE009A01021', label: 'INFOSYS' },
        { key: 'NSE_EQ|INE040A01034', label: 'HDFC BANK' },
        { key: 'NSE_EQ|INE154A01025', label: 'ITC' },
    ]

    useEffect(() => {
        let mounted = true
        async function init() {
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData?.session) {
                router.push('/signin')
                return
            }
            setUserId(sessionData.session.user.id)

            // Check connection
            try {
                const res = await fetch('/api/upstox/test-connection')
                const data = await res.json()
                if (mounted) setConnectionStatus(data)
            } catch { /* ignore */ }

            // Load order history
            await refreshOrders()
            if (mounted) setLoading(false)
        }
        init()
        return () => { mounted = false }
    }, [router])

    async function refreshOrders() {
        try {
            const res = await fetch('/api/orders/history?limit=20')
            const data = await res.json()
            if (data.data) setOrders(data.data)
        } catch { /* ignore */ }
    }

    async function handlePlaceOrder(e: React.FormEvent) {
        e.preventDefault()
        setPlacing(true)
        setMessage(null)

        try {
            const res = await fetch('/api/orders/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instrument_key: instrumentKey,
                    side,
                    quantity: Number(quantity),
                    price: orderType === 'LIMIT' ? Number(price) : undefined,
                    order_type: orderType,
                    product,
                    user_id: userId
                })
            })
            const data = await res.json()

            if (data.status === 'success') {
                setMessage({
                    text: `✓ ${data.message}`,
                    type: 'success'
                })
                await refreshOrders()
            } else {
                setMessage({
                    text: `✗ ${data.message || 'Order failed'}`,
                    type: 'error'
                })
            }
        } catch (err: any) {
            setMessage({ text: `Error: ${err.message}`, type: 'error' })
        }

        setPlacing(false)
    }

    async function handleModifyOrder(e: React.FormEvent) {
        e.preventDefault()
        setMessage(null)

        try {
            const res = await fetch('/api/orders/modify', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: modifyOrderId,
                    quantity: modifyQty ? Number(modifyQty) : undefined,
                    price: modifyPrice ? Number(modifyPrice) : undefined,
                    order_type: modifyPrice ? 'LIMIT' : undefined,
                    user_id: userId
                })
            })
            const data = await res.json()
            setMessage({
                text: data.status === 'success' ? `✓ ${data.message}` : `✗ ${data.message}`,
                type: data.status === 'success' ? 'success' : 'error'
            })
            await refreshOrders()
        } catch (err: any) {
            setMessage({ text: `Error: ${err.message}`, type: 'error' })
        }
    }

    async function handleCancelOrder(e: React.FormEvent) {
        e.preventDefault()
        setMessage(null)

        try {
            const res = await fetch(`/api/orders/cancel?order_id=${encodeURIComponent(cancelOrderId)}&user_id=${encodeURIComponent(userId)}`, {
                method: 'DELETE'
            })
            const data = await res.json()
            setMessage({
                text: data.status === 'success' ? `✓ ${data.message}` : `✗ ${data.message}`,
                type: data.status === 'success' ? 'success' : 'error'
            })
            await refreshOrders()
        } catch (err: any) {
            setMessage({ text: `Error: ${err.message}`, type: 'error' })
        }
    }

    function logout() {
        supabase.auth.signOut().then(() => router.push('/signin'))
    }

    const inputClass = "w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
    const labelClass = "block text-sm font-medium text-zinc-400 mb-2"

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30 font-light pb-24">
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-zinc-950 to-zinc-950 pointer-events-none" />

            {/* Navbar */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/70 border-b border-white/5 px-4 md:px-6 py-4 flex flex-wrap md:flex-nowrap justify-between items-center transition-all gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </div>
                    <Link href="/dashboard" className="text-xl font-medium tracking-tight hover:text-indigo-400 transition-colors bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Portfolio Engine
                    </Link>
                    <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">SANDBOX LAB</span>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
                    <Link href="/settings" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Settings</Link>
                    <button onClick={logout} className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5">Sign out</button>
                </div>
            </header>

            <main className="relative max-w-6xl mx-auto px-6 mt-12">
                <div className="mb-10">
                    <h2 className="text-3xl font-semibold mb-2">Sandbox Testing Lab</h2>
                    <p className="text-sm text-zinc-500">Test Upstox sandbox order APIs — Place, Modify, and Cancel orders in a safe sandbox environment.</p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center p-24">
                        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <p className="mt-4 text-zinc-400 animate-pulse text-sm">Loading sandbox environment...</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Connection Status */}
                        <section className="bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm p-6 shadow-2xl">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full animate-pulse ${connectionStatus?.status === 'sandbox_ready' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                                        : connectionStatus?.status === 'sandbox_mode' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                                            : connectionStatus?.status === 'token_invalid' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'
                                                : 'bg-zinc-600'
                                        }`} />
                                    <div>
                                        <h3 className="text-lg font-medium text-zinc-200">Sandbox Status</h3>
                                        <p className="text-sm text-zinc-500">{connectionStatus?.message || 'Checking...'}</p>
                                    </div>
                                </div>
                                {connectionStatus?.sandbox_order_available ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full border border-emerald-500/20">
                                        ✓ Order APIs Ready
                                    </span>
                                ) : (
                                    <Link href="/settings" className="text-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-medium px-4 py-2 rounded-lg transition-colors border border-amber-500/20">
                                        Configure Token →
                                    </Link>
                                )}
                            </div>
                            {connectionStatus?.api_base && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <p className="text-xs text-zinc-600">API Base: <code className="text-zinc-400 font-mono">{connectionStatus.api_base}</code></p>
                                </div>
                            )}
                            {connectionStatus?.status === 'token_invalid' && connectionStatus?.fix_steps && (
                                <div className="mt-4 p-4 bg-red-500/5 border border-red-500/15 rounded-xl">
                                    <p className="text-sm font-medium text-red-400 mb-3">⚠ Token Fix Required</p>
                                    <ol className="space-y-1.5">
                                        {connectionStatus.fix_steps.map((step: string, i: number) => (
                                            <li key={i} className="text-xs text-zinc-400">{step}</li>
                                        ))}
                                    </ol>
                                    <a href="https://account.upstox.com/developer/apps#sandbox" target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 mt-4 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg transition-colors">
                                        Open Upstox Sandbox Portal →
                                    </a>
                                </div>
                            )}
                        </section>

                        {/* Message Banner */}
                        {message && (
                            <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                : message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-300'
                                    : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                                }`}>
                                <p className="text-sm">{message.text}</p>
                                <button onClick={() => setMessage(null)} className="ml-auto text-zinc-500 hover:text-white transition-colors text-sm">×</button>
                            </div>
                        )}

                        {/* Order Forms Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Place Order */}
                            <section className="bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm p-6 shadow-2xl">
                                <h3 className="text-xl font-medium mb-6 pb-2 border-b border-white/5 text-zinc-200 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    Place Order
                                </h3>
                                <form onSubmit={handlePlaceOrder} className="space-y-4">
                                    <div>
                                        <label className={labelClass}>Instrument</label>
                                        <select value={instrumentKey} onChange={e => setInstrumentKey(e.target.value)} className={inputClass + ' cursor-pointer'}>
                                            {PRESET_INSTRUMENTS.map(inst => (
                                                <option key={inst.key} value={inst.key}>{inst.label} ({inst.key})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Side</label>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setSide('BUY')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border border-white/10 hover:bg-zinc-700'}`}>BUY</button>
                                                <button type="button" onClick={() => setSide('SELL')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${side === 'SELL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-zinc-800 text-zinc-400 border border-white/10 hover:bg-zinc-700'}`}>SELL</button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Quantity</label>
                                            <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputClass} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Order Type</label>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => { setOrderType('MARKET'); setPrice('') }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${orderType === 'MARKET' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-400 border border-white/10 hover:bg-zinc-700'}`}>MARKET</button>
                                                <button type="button" onClick={() => setOrderType('LIMIT')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${orderType === 'LIMIT' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-400 border border-white/10 hover:bg-zinc-700'}`}>LIMIT</button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Product</label>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setProduct('D')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${product === 'D' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-zinc-800 text-zinc-400 border border-white/10 hover:bg-zinc-700'}`}>Delivery</button>
                                                <button type="button" onClick={() => setProduct('I')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${product === 'I' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-zinc-800 text-zinc-400 border border-white/10 hover:bg-zinc-700'}`}>Intraday</button>
                                            </div>
                                        </div>
                                    </div>

                                    {orderType === 'LIMIT' && (
                                        <div>
                                            <label className={labelClass}>Limit Price (₹)</label>
                                            <input type="number" step="0.05" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className={inputClass} />
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={placing || !connectionStatus?.sandbox_order_available}
                                        className={`w-full py-3 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${side === 'BUY'
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(52,211,153,0.2)]'
                                            : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                                            }`}
                                    >
                                        {placing ? 'Placing...' : `Place ${side} Order`}
                                    </button>
                                </form>
                            </section>

                            {/* Modify & Cancel */}
                            <div className="space-y-8">
                                {/* Modify Order */}
                                <section className="bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm p-6 shadow-2xl">
                                    <h3 className="text-xl font-medium mb-6 pb-2 border-b border-white/5 text-zinc-200 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                                        Modify Order
                                    </h3>
                                    <form onSubmit={handleModifyOrder} className="space-y-4">
                                        <div>
                                            <label className={labelClass}>Order ID</label>
                                            <input type="text" value={modifyOrderId} onChange={e => setModifyOrderId(e.target.value)} placeholder="Enter Upstox order ID" className={inputClass + ' font-mono'} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClass}>New Qty</label>
                                                <input type="number" min="1" value={modifyQty} onChange={e => setModifyQty(e.target.value)} placeholder="Optional" className={inputClass} />
                                            </div>
                                            <div>
                                                <label className={labelClass}>New Price (₹)</label>
                                                <input type="number" step="0.05" value={modifyPrice} onChange={e => setModifyPrice(e.target.value)} placeholder="Optional" className={inputClass} />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={!modifyOrderId} className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">Modify Order</button>
                                    </form>
                                </section>

                                {/* Cancel Order */}
                                <section className="bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm p-6 shadow-2xl">
                                    <h3 className="text-xl font-medium mb-6 pb-2 border-b border-white/5 text-zinc-200 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-400" />
                                        Cancel Order
                                    </h3>
                                    <form onSubmit={handleCancelOrder} className="space-y-4">
                                        <div>
                                            <label className={labelClass}>Order ID</label>
                                            <input type="text" value={cancelOrderId} onChange={e => setCancelOrderId(e.target.value)} placeholder="Enter Upstox order ID to cancel" className={inputClass + ' font-mono'} />
                                        </div>
                                        <button type="submit" disabled={!cancelOrderId} className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">Cancel Order</button>
                                    </form>
                                </section>
                            </div>
                        </div>

                        {/* Order History */}
                        <section className="bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-xl font-medium text-zinc-200">Order History</h3>
                                <button onClick={refreshOrders} className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2 rounded-lg transition-colors border border-white/10">
                                    Refresh
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                {orders.length === 0 ? (
                                    <div className="p-12 text-center text-zinc-500">
                                        <p>No orders placed yet. Use the form above to place a sandbox order.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950/30 border-b border-white/5 text-xs uppercase tracking-wider text-zinc-500 font-medium">
                                                <th className="py-3 px-4 font-medium">Time</th>
                                                <th className="py-3 px-4 font-medium">Side</th>
                                                <th className="py-3 px-4 font-medium">Instrument</th>
                                                <th className="py-3 px-4 font-medium text-right">Qty</th>
                                                <th className="py-3 px-4 font-medium text-right">Price</th>
                                                <th className="py-3 px-4 font-medium">Status</th>
                                                <th className="py-3 px-4 font-medium">Order ID</th>
                                                <th className="py-3 px-4 font-medium">Source</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {orders.map((order) => (
                                                <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-3 px-4 text-xs text-zinc-500 font-mono">
                                                        {new Date(order.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${order.side === 'BUY' ? 'bg-emerald-500/15 text-emerald-400'
                                                            : order.side === 'SELL' ? 'bg-red-500/15 text-red-400'
                                                                : 'bg-zinc-500/15 text-zinc-400'
                                                            }`}>{order.side}</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-zinc-300 font-mono truncate max-w-[180px]">{order.instrument_key}</td>
                                                    <td className="py-3 px-4 text-right text-sm text-zinc-300">{order.quantity}</td>
                                                    <td className="py-3 px-4 text-right text-sm text-zinc-300">{order.price ? `₹${order.price}` : 'MKT'}</td>
                                                    <td className="py-3 px-4">
                                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${order.status === 'SUBMITTED' || order.status === 'COMPLETE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                            : order.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                                : order.status === 'CANCELLED' ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                                                    : order.status === 'MODIFIED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                                        : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                                            }`}>{order.status}</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-xs text-zinc-600 font-mono truncate max-w-[120px]">{order.external_order_id || '—'}</td>
                                                    <td className="py-3 px-4 text-xs text-zinc-600">{order.meta?.source || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </div>
    )
}
