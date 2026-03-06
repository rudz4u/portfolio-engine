import Link from "next/link"
import { Zap } from "lucide-react"

export const metadata = {
  title: "Legal — Invest Buddy AI",
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[hsl(222,47%,4%)] text-white">
      {/* Minimal nav */}
      <header className="border-b border-white/[0.07] sticky top-0 z-40 backdrop-blur-sm bg-[hsl(222,47%,4%)]/90">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sm">
              <span className="text-violet-400">Invest Buddy</span>{" "}
              <span className="text-white">AI</span>
            </span>
          </Link>
          <Link href="/legal" className="text-xs text-white/40 hover:text-white/70 transition-colors">
            ← Legal Index
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/30">
          <p>© {new Date().getFullYear()} Upflow Sprint Private Limited. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/legal/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
            <Link href="/legal/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            <Link href="/legal/disclaimer" className="hover:text-white/60 transition-colors">Disclaimer</Link>
            <Link href="https://upflowsprint.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">Upflow Sprint</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
