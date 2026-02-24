import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    const returnTo = (router.query.next as string) || '/dashboard'
    router.push(returnTo)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return setError('Please enter your email first')
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (error) return setError(error.message)
    setMessage('Magic link sent to your email (check inbox).')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-white font-sans selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />

      <div className="w-full max-w-4xl flex gap-8 p-6 z-10 mx-auto">
        <section className="flex-1 bg-zinc-900/50 backdrop-blur-xl p-10 rounded-3xl border border-zinc-800/50 shadow-2xl">
          <div className="mb-10">
            <h1 className="text-4xl font-bold tracking-tight mb-3 bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent">
              Access your Engine
            </h1>
            <p className="text-zinc-400 text-lg">Portfolio management, reimagined.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Email address</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                placeholder="Enter password"
              />
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-white text-zinc-950 font-semibold rounded-xl px-6 py-3 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
              >
                {loading ? 'Authenticating...' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading || !email}
                className="flex-1 bg-zinc-800/50 text-white font-medium rounded-xl px-6 py-3 border border-zinc-700 hover:bg-zinc-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send magic link'}
              </button>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                {message}
              </div>
            )}
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-800/50 md:hidden text-center">
            <p className="text-xs text-zinc-500 mb-1">Testing Credentials</p>
            <p className="text-sm font-mono text-indigo-400">r.ni.das@gmail.com</p>
          </div>
        </section>

        <aside className="w-80 hidden md:flex flex-col justify-center bg-zinc-900/30 p-8 rounded-3xl border border-zinc-800/30 backdrop-blur-md">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-6">
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-white mb-2">Quant precision</h3>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            Leverage advanced market indicators, optimize your strategies, and confidently deploy capital.
          </p>

          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-xs font-medium text-indigo-300 mb-1">Testing Credentials</p>
            <p className="text-sm text-indigo-100 font-mono">r.ni.das@gmail.com</p>
          </div>
        </aside>
      </div>
    </main>
  )
}
