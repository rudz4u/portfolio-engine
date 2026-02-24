import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white font-sans selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />

      <div className="z-10 text-center max-w-3xl px-6">
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
          Engine v0.1.0 Beta
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
          AI-Powered Equity Management
        </h1>

        <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Track holdings, analyze with quantitative precision, and get AI-driven execution recommendations.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/signin"
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-white text-zinc-950 font-semibold hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Access Platform
          </Link>
          <a
            href="https://github.com/r-ni-das" target="_blank" rel="noreferrer"
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-medium hover:bg-zinc-800 transition-all"
          >
            Documentation
          </a>
        </div>
      </div>

      <footer className="absolute bottom-8 text-zinc-600 text-sm">
        &copy; {new Date().getFullYear()} Portfolio Engine. Secure, private, and powerful.
      </footer>
    </main>
  )
}
