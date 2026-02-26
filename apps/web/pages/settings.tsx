import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

export default function Settings() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

    const [openaiKey, setOpenaiKey] = useState('')
    const [anthropicKey, setAnthropicKey] = useState('')
    const [upstoxApiKey, setUpstoxApiKey] = useState('')
    const [upstoxSecret, setUpstoxSecret] = useState('')
    const [upstoxAccessToken, setUpstoxAccessToken] = useState('')
    const [brokerStatus, setBrokerStatus] = useState<any>(null)

    useEffect(() => {
        let mounted = true
        async function loadSettings() {
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData?.session) {
                router.push('/signin')
                return
            }

            // Use maybeSingle() to avoid 406 error when no row exists
            const { data, error } = await supabase
                .from('user_settings')
                .select('encrypted_keys')
                .eq('user_id', sessionData.session.user.id)
                .maybeSingle()

            if (!mounted) return

            if (error) {
                console.error("Failed to load settings:", error)
            }

            if (data?.encrypted_keys) {
                try {
                    const keys = JSON.parse(data.encrypted_keys)
                    setOpenaiKey(keys.openai_key || '')
                    setAnthropicKey(keys.anthropic_key || '')
                    setUpstoxApiKey(keys.upstox_api_key || '')
                    setUpstoxSecret(keys.upstox_secret || '')
                    setUpstoxAccessToken(keys.upstox_access_token || '')
                } catch (e) {
                    console.error("Failed to parse settings keys", e)
                }
            }
            setLoading(false)

            // Check broker connection status
            try {
                const res = await fetch('/api/portfolio/profile')
                const data = await res.json()
                if (mounted) setBrokerStatus(data)
            } catch {
                // ignore
            }
        }
        loadSettings()
        return () => { mounted = false }
    }, [router])

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData?.session) return

        const keysToStore = {
            openai_key: openaiKey,
            anthropic_key: anthropicKey,
            upstox_api_key: upstoxApiKey,
            upstox_secret: upstoxSecret,
            upstox_access_token: upstoxAccessToken
        }

        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: sessionData.session.user.id,
                encrypted_keys: JSON.stringify(keysToStore),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })

        setSaving(false)

        if (error) {
            setMessage({ text: error.message, type: 'error' })
        } else {
            setMessage({ text: 'Configuration saved successfully.', type: 'success' })
        }
    }

    async function handleTestConnection() {
        setTesting(true)
        setMessage(null)

        try {
            // Test the sandbox order endpoint
            const res = await fetch('/api/upstox/test-connection')
            const data = await res.json()

            if (data.status === 'connected' || data.status === 'sandbox_ready') {
                setMessage({ text: `✓ ${data.message}`, type: 'success' })
            } else {
                setMessage({ text: `${data.message || 'Connection test failed'}`, type: 'error' })
            }
            setBrokerStatus(data)
        } catch (err: any) {
            setMessage({ text: 'Connection test failed: ' + err.message, type: 'error' })
        }

        setTesting(false)
    }

    function logout() {
        supabase.auth.signOut().then(() => router.push('/signin'))
    }

    const sandboxMode = brokerStatus?.status === 'sandbox_mode' || brokerStatus?.status === 'sandbox_ready'

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
                    <Link href="/dashboard" className="text-xl font-medium tracking-tight hover:text-indigo-400 transition-colors bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Portfolio Engine
                    </Link>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                        Dashboard
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
                    <button
                        onClick={logout}
                        className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5"
                    >
                        Sign out
                    </button>
                </div>
            </header>

            <main className="relative max-w-4xl mx-auto px-6 mt-12">
                <div className="mb-10">
                    <h2 className="text-3xl font-semibold mb-2">Settings</h2>
                    <p className="text-sm text-zinc-500">Manage your LLM capabilities and broker configurations securely.</p>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center p-24">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-zinc-400 animate-pulse text-sm">Loading configurations...</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Broker Connection Status Card */}
                        <section className="bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm p-6 shadow-2xl">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full ${sandboxMode ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : brokerStatus?.status === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-zinc-600'} animate-pulse`} />
                                    <div>
                                        <h3 className="text-lg font-medium text-zinc-200">Broker Connection</h3>
                                        <p className="text-sm text-zinc-500">
                                            {sandboxMode
                                                ? '🧪 Sandbox Mode — Order APIs available for testing'
                                                : brokerStatus?.status === 'connected'
                                                    ? '✓ Connected to Upstox Live'
                                                    : brokerStatus?.status === 'no_token'
                                                        ? 'Not configured — add your access token below'
                                                        : 'Status unknown'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {sandboxMode && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-full border border-amber-500/20">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                            SANDBOX
                                        </span>
                                    )}
                                    <button
                                        onClick={handleTestConnection}
                                        disabled={testing}
                                        className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 border border-white/10"
                                    >
                                        {testing ? 'Testing...' : 'Test Connection'}
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Main Settings Form */}
                        <section className="bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm p-8 shadow-2xl">
                            <form onSubmit={handleSave} className="space-y-8">

                                {/* LLM Keys */}
                                <div>
                                    <h3 className="text-xl font-medium mb-4 pb-2 border-b border-white/5 text-zinc-200">AI / LLM Integrations</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-2">OpenAI API Key</label>
                                            <input
                                                type="password"
                                                value={openaiKey}
                                                onChange={e => setOpenaiKey(e.target.value)}
                                                placeholder="sk-..."
                                                className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-2">Anthropic API Key</label>
                                            <input
                                                type="password"
                                                value={anthropicKey}
                                                onChange={e => setAnthropicKey(e.target.value)}
                                                placeholder="sk-ant-..."
                                                className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Broker Config */}
                                <div>
                                    <h3 className="text-xl font-medium mb-4 pb-2 border-b border-white/5 text-zinc-200">Upstox Configuration</h3>

                                    {/* Sandbox info callout */}
                                    <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                                        <div className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <div className="text-sm text-zinc-400">
                                                <p className="font-medium text-amber-400 mb-1">Sandbox Mode Active</p>
                                                <p>Generate a sandbox access token from the <a href="https://account.upstox.com/developer/apps#sandbox" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">Upstox Developer Portal</a>. Sandbox supports <strong className="text-zinc-300">Order APIs only</strong> (Place/Modify/Cancel). Holdings and profile data come from your seeded Supabase database.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-2">API Key / Client ID</label>
                                            <input
                                                type="text"
                                                value={upstoxApiKey}
                                                onChange={e => setUpstoxApiKey(e.target.value)}
                                                placeholder="Enter Client ID"
                                                className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-2">API Secret</label>
                                            <input
                                                type="password"
                                                value={upstoxSecret}
                                                onChange={e => setUpstoxSecret(e.target.value)}
                                                placeholder="Enter API Secret"
                                                className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                                            Sandbox Access Token
                                            <span className="ml-2 text-xs text-amber-500/70 font-normal">(30-day validity — paste from Upstox Developer Portal)</span>
                                        </label>
                                        <input
                                            type="password"
                                            value={upstoxAccessToken}
                                            onChange={e => setUpstoxAccessToken(e.target.value)}
                                            placeholder="Paste your sandbox access token here..."
                                            className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                        />
                                        <p className="mt-2 text-xs text-zinc-600">
                                            This token is stored in your Supabase user_settings and used to call sandbox-enabled Upstox APIs.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center justify-between border-t border-white/5">
                                    <div className="flex-1">
                                        {message && (
                                            <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : message.type === 'info' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                {message.text}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-6 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                                    >
                                        {saving ? 'Saving...' : 'Save Configuration'}
                                    </button>
                                </div>

                            </form>
                        </section>

                        {/* Sandbox API Reference */}
                        <section className="bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm p-6 shadow-2xl">
                            <h3 className="text-lg font-medium mb-4 text-zinc-200">Sandbox-Enabled Endpoints</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { method: 'POST', path: '/v2/order/place', label: 'Place Order' },
                                    { method: 'PUT', path: '/v2/order/modify', label: 'Modify Order' },
                                    { method: 'DELETE', path: '/v2/order/cancel', label: 'Cancel Order' },
                                    { method: 'POST', path: '/v3/order/place', label: 'Place Order V3' },
                                ].map((ep, i) => (
                                    <div key={i} className="flex items-center gap-3 px-4 py-3 bg-zinc-950/30 rounded-xl border border-white/5">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${ep.method === 'POST' ? 'bg-emerald-500/15 text-emerald-400' : ep.method === 'PUT' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>
                                            {ep.method}
                                        </span>
                                        <code className="text-sm text-zinc-400 font-mono">{ep.path}</code>
                                        <span className="text-xs text-zinc-600 ml-auto">{ep.label}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-xs text-zinc-600">
                                Profile, Holdings, Positions, and Fund endpoints require a live account token.
                                In sandbox mode, these are served from your seeded Supabase data.
                            </p>
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <Link href="/sandbox" className="inline-flex items-center gap-2 text-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-medium px-4 py-2 rounded-lg transition-colors border border-amber-500/20">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                    Go to Sandbox Testing Lab →
                                </Link>
                            </div>
                        </section>
                    </div>
                )}
            </main>
        </div>
    )
}
