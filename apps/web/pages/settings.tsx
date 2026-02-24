import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

export default function Settings() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

    const [openaiKey, setOpenaiKey] = useState('')
    const [anthropicKey, setAnthropicKey] = useState('')
    const [upstoxApiKey, setUpstoxApiKey] = useState('')
    const [upstoxSecret, setUpstoxSecret] = useState('')

    useEffect(() => {
        let mounted = true
        async function loadSettings() {
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData?.session) {
                router.push('/signin')
                return
            }

            const { data, error } = await supabase
                .from('user_settings')
                .select('encrypted_keys')
                .eq('user_id', sessionData.session.user.id)
                .single()

            if (!mounted) return

            if (data?.encrypted_keys) {
                try {
                    // In a real application, keys should be properly encrypted/decrypted securely.
                    // For MVP demo, storing as JSON string representing encrypted content.
                    const keys = JSON.parse(data.encrypted_keys)
                    setOpenaiKey(keys.openai_key || '')
                    setAnthropicKey(keys.anthropic_key || '')
                    setUpstoxApiKey(keys.upstox_api_key || '')
                    setUpstoxSecret(keys.upstox_secret || '')
                } catch (e) {
                    console.error("Failed to parse settings keys", e)
                }
            }
            setLoading(false)
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
            upstox_secret: upstoxSecret
        }

        // Using upsert since the user might not have a settings row yet
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
            setMessage({ text: 'API Keys saved successfully.', type: 'success' })
        }
    }

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
                    <Link href="/dashboard" className="text-xl font-medium tracking-tight hover:text-indigo-400 transition-colors bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Portfolio Engine
                    </Link>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                        Dashboard
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            </div>

                            <div className="pt-4 flex items-center justify-between border-t border-white/5">
                                <div className="flex-1">
                                    {message && (
                                        <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
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
                )}
            </main>
        </div>
    )
}
