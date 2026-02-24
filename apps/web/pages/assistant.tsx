import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
}

export default function Assistant() {
    const router = useRouter()
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        let mounted = true
        async function load() {
            const { data: sessionData } = await supabase.auth.getSession()
            if (!sessionData?.session) {
                router.push('/signin')
                return
            }

            if (!mounted) return

            // Initialize with a welcome message
            setMessages([
                {
                    id: 'welcome',
                    role: 'assistant',
                    content: 'Hello! I am your AI execution assistant. I am constantly monitoring your portfolio and the Quant Engine signals. How can I help you today?',
                    timestamp: new Date().toISOString()
                }
            ])
        }
        load()
        return () => { mounted = false }
    }, [router])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    async function handleSend(e: React.FormEvent) {
        e.preventDefault()
        if (!input.trim() || loading) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date().toISOString()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setLoading(true)

        try {
            const response = await fetch('/api/chat/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage.content })
            })

            const data = await response.json()

            if (response.ok) {
                setMessages(prev => [...prev, {
                    id: Date.now().toString() + '_ai',
                    role: 'assistant',
                    content: data.content,
                    timestamp: data.timestamp
                }])
            } else {
                throw new Error(data.error || 'Failed to communicate with assistant')
            }
        } catch (error: any) {
            setMessages(prev => [...prev, {
                id: Date.now().toString() + '_error',
                role: 'assistant',
                content: `Error: ${error.message}. Please check your API keys inside Settings.`,
                timestamp: new Date().toISOString()
            }])
        } finally {
            setLoading(false)
        }
    }

    function logout() {
        supabase.auth.signOut().then(() => router.push('/signin'))
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30 font-light flex flex-col">
            {/* Background gradients */}
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-zinc-950 to-zinc-950 pointer-events-none" />

            {/* Navbar */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/70 border-b border-white/5 px-4 md:px-6 py-4 flex flex-wrap md:flex-nowrap justify-between items-center transition-all gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                    </div>
                    <Link href="/dashboard" className="text-xl font-medium tracking-tight hover:text-indigo-400 transition-colors bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Portfolio Engine
                    </Link>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
                        Dashboard
                    </Link>
                    <Link href="/settings" className="text-zinc-400 hover:text-white transition-colors">
                        Settings
                    </Link>
                    <button
                        onClick={logout}
                        className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5"
                    >
                        Sign out
                    </button>
                </div>
            </header>

            <main className="relative flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col min-h-0">
                <div className="mb-6 flex-shrink-0">
                    <h2 className="text-3xl font-semibold mb-2">Quant Assistant</h2>
                    <p className="text-sm text-zinc-500">Query your portfolio algorithms using natural language.</p>
                </div>

                <section className="flex-1 bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm shadow-2xl flex flex-col min-h-[50vh] overflow-hidden">
                    {/* Chat History */}
                    <div className="flex-1 p-6 overflow-y-auto space-y-6">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                                        <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                )}

                                <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-600/20'
                                        : 'bg-zinc-800/60 border border-white/5 text-zinc-200 rounded-bl-none'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mr-3 flex-shrink-0">
                                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <div className="bg-zinc-800/60 border border-white/5 text-zinc-400 rounded-2xl rounded-bl-none px-5 py-3.5 shadow-sm text-sm flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-zinc-950/50 border-t border-white/5">
                        <form onSubmit={handleSend} className="relative flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Ask about MACD momentum or VIX discounts..."
                                className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-4 pr-14 py-3.5 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </form>
                    </div>
                </section>
            </main>
        </div>
    )
}
