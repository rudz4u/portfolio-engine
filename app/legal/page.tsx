import Link from "next/link"
import { FileText, Shield, AlertTriangle, BookOpen } from "lucide-react"

export const metadata = {
  title: "Legal — Invest Buddy AI by Upflow Sprint",
}

const LAST_UPDATED = "6 March 2026"

const docs = [
  {
    href: "/legal/terms",
    icon: FileText,
    title: "Terms of Service",
    description:
      "Governs your use of the Invest Buddy AI platform, including beta access terms, acceptable use, limitation of liability, and your rights as a user.",
    badge: "Beta Edition",
  },
  {
    href: "/legal/privacy",
    icon: Shield,
    title: "Privacy Policy",
    description:
      "Explains what personal and financial data we collect, how it is stored and used, and your rights under applicable Indian data‑protection law (DPDPA 2023).",
    badge: null,
  },
  {
    href: "/legal/disclaimer",
    icon: AlertTriangle,
    title: "Financial Disclaimer",
    description:
      "Clarifies that Invest Buddy AI is not a SEBI‑registered investment advisor, that all outputs are algorithmic results, and that users are solely responsible for their investment decisions.",
    badge: "Important",
  },
  {
    href: "/legal/beta-agreement",
    icon: BookOpen,
    title: "Beta User Agreement",
    description:
      "Specific terms for users accessing Invest Buddy AI during the current closed‑beta phase, including limitations, feedback expectations, and service level disclaimers.",
    badge: "Beta",
  },
]

export default function LegalIndex() {
  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-mono text-violet-400/60 uppercase tracking-widest mb-2">Legal Centre</p>
        <h1 className="text-3xl font-bold text-white mb-3">Invest Buddy AI — Legal Documents</h1>
        <p className="text-white/50 max-w-2xl">
          Invest Buddy AI is operated by <strong className="text-white/70">Upflow Sprint Private Limited</strong> (CIN registration,
          India). Please read these documents carefully before using the platform.
        </p>
        <p className="mt-3 text-xs text-white/30">Last updated: {LAST_UPDATED}</p>
      </div>

      {/* Beta notice banner */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-5 py-4 mb-10">
        <p className="text-sm font-semibold text-amber-400 mb-1">⚠ Beta Platform Notice</p>
        <p className="text-sm text-amber-300/70">
          Invest Buddy AI is currently in <strong>closed beta</strong>. All users onboarded during this period are participating
          as beta testers under the Beta User Agreement. Services, features, and terms are subject to change. By accessing the
          platform, you acknowledge and accept this status.
        </p>
      </div>

      {/* Document cards */}
      <div className="grid sm:grid-cols-2 gap-5">
        {docs.map(({ href, icon: Icon, title, description, badge }) => (
          <Link
            key={href}
            href={href}
            className="group block rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-violet-400/40 hover:bg-white/[0.05] transition-all duration-200 p-6"
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Icon className="h-4.5 w-4.5 text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="text-base font-semibold text-white group-hover:text-violet-300 transition-colors">
                    {title}
                  </h2>
                  {badge && (
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-400 border border-violet-400/20">
                      {badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/45 leading-relaxed">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Company info */}
      <div className="mt-12 rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5">
        <p className="text-xs font-mono text-white/30 uppercase tracking-widest mb-3">Platform Operator</p>
        <p className="text-sm text-white/70 font-medium">Upflow Sprint Private Limited</p>
        <p className="text-sm text-white/40 mt-1">
          Website:{" "}
          <a
            href="https://upflowsprint.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            https://upflowsprint.com
          </a>
        </p>
        <p className="text-sm text-white/40 mt-0.5">Contact: legal@upflowsprint.com</p>
        <p className="text-xs text-white/25 mt-3">
          For legal notices, DPDPA data requests, or grievances, please write to the above address.
          We aim to respond within 30 business days.
        </p>
      </div>
    </div>
  )
}
