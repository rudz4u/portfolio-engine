import Link from "next/link"

export const metadata = {
  title: "Privacy Policy — Invest Buddy AI",
}

const EFFECTIVE_DATE = "6 March 2026"
const VERSION = "Beta v1.0"

export default function PrivacyPage() {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {/* Header */}
      <div className="not-prose mb-10">
        <p className="text-xs font-mono text-violet-400/60 uppercase tracking-widest mb-2">Legal</p>
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
          <span>Effective: {EFFECTIVE_DATE}</span>
          <span>·</span>
          <span className="rounded-full bg-violet-500/15 border border-violet-400/20 text-violet-400 px-2 py-0.5">{VERSION}</span>
        </div>
        <p className="mt-4 text-white/50 text-sm leading-relaxed">
          This Privacy Policy describes how <strong className="text-white/70">Upflow Sprint Private Limited</strong> ("Company",
          "we", "us", or "our") collects, uses, stores, and protects personal data when you use{" "}
          <strong className="text-white/70">Invest Buddy AI</strong> ("Platform"). This policy is compliant with India's{" "}
          <strong className="text-white/70">Digital Personal Data Protection Act, 2023 (DPDPA 2023)</strong>.
        </p>
      </div>

      {/* ── 1. Data Controller ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">1. Data Fiduciary (Controller)</h2>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 text-sm text-white/60 space-y-1">
          <p><strong className="text-white/80">Upflow Sprint Private Limited</strong></p>
          <p>Website: <a href="https://upflowsprint.com" className="text-violet-400 hover:text-violet-300" target="_blank" rel="noopener noreferrer">https://upflowsprint.com</a></p>
          <p>Grievance Officer / Data Protection Contact: <a href="mailto:legal@upflowsprint.com" className="text-violet-400 hover:text-violet-300">legal@upflowsprint.com</a></p>
        </div>
      </section>

      {/* ── 2. Data We Collect ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">2. What Personal Data We Collect</h2>
        <div className="space-y-5 text-sm text-white/60">

          <div>
            <p className="font-semibold text-white/80 mb-2">2.1 Account & Identity Data</p>
            <ul className="space-y-1 ml-4">
              <li>Full name and email address provided at registration</li>
              <li>Encrypted session tokens managed by Supabase Auth (authentication provider)</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-white/80 mb-2">2.2 Brokerage Integration Data</p>
            <ul className="space-y-1 ml-4">
              <li>OAuth 2.0 access tokens and refresh tokens for connected brokerage accounts (e.g., Upstox) — stored encrypted using AES-256</li>
              <li>Holdings, positions, and transaction history fetched from connected brokerage accounts on your behalf</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-white/80 mb-2">2.3 User-Provided API Credentials</p>
            <ul className="space-y-1 ml-4">
              <li>Third-party LLM API keys (e.g., OpenAI, Anthropic, Google Gemini) that you voluntarily provide for AI assistant features — stored encrypted using AES-256 and never transmitted for any purpose other than forwarding your requests to the selected LLM provider</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-white/80 mb-2">2.4 Platform Usage Data</p>
            <ul className="space-y-1 ml-4">
              <li>Portfolio snapshots and watchlists you create and manage within the Platform</li>
              <li>Algorithmic configuration parameters you set (weights, indicators, scoring thresholds)</li>
              <li>Chat history with the AI assistant (stored to provide conversation continuity)</li>
              <li>Platform preferences and settings</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-white/80 mb-2">2.5 Analytics Data (Public Pages Only)</p>
            <ul className="space-y-1 ml-4">
              <li>Standard web analytics (e.g., page views, referral sources, browser/device type) collected on the public marketing/landing pages only via analytics tools such as Google Analytics, Microsoft Clarity, or Yahoo Analytics</li>
              <li><strong className="text-white/70">No personally identifiable information from authenticated app sections is shared with any analytics provider.</strong></li>
              <li>Analytics data is collected in aggregate and used only to understand website traffic.</li>
            </ul>
          </div>

        </div>
      </section>

      {/* ── 3. How We Use Data ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">3. How We Use Your Data</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>3.1 <strong className="text-white/70">Providing the Platform:</strong> Fetching and analysing your portfolio holdings, generating algorithmic scores, executing orders on your explicit instruction, running the AI assistant.</li>
          <li>3.2 <strong className="text-white/70">Authentication:</strong> Maintaining secure login sessions and verifying your identity.</li>
          <li>3.3 <strong className="text-white/70">Email Notifications:</strong> Sending portfolio summaries, alerts, or digest emails you have opted into.</li>
          <li>3.4 <strong className="text-white/70">Security:</strong> Detecting and preventing unauthorised access, fraud, or abuse.</li>
          <li>3.5 <strong className="text-white/70">Product Improvement (Beta):</strong> Aggregate, anonymised usage patterns may be analysed to improve Platform performance. We do not analyse individual financial data for this purpose.</li>
          <li>3.6 <strong className="text-white/70">Legal Compliance:</strong> Complying with applicable laws, court orders, or regulatory requirements.</li>
        </ul>
      </section>

      {/* ── 4. Data Sharing ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">4. Data Sharing & Third Parties</h2>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-5 py-4 mb-4">
          <p className="text-sm font-semibold text-green-400 mb-1">Our Commitment</p>
          <p className="text-sm text-green-300/70">
            We do <strong>not</strong> sell, rent, or share your personal or financial data with any third party for
            commercial, advertising, or marketing purposes.
          </p>
        </div>
        <p className="text-white/60 text-sm mb-3">We use the following infrastructure processors who act under contractual data-processing obligations:</p>
        <div className="space-y-3">
          {[
            { name: "Supabase", role: "Database and Authentication", url: "https://supabase.com/privacy", note: "Hosts your account data, encrypted tokens, holdings, and chat history. Operates on AWS (US regions) under SOC 2 compliance." },
            { name: "Netlify", role: "Web Hosting & CDN", url: "https://www.netlify.com/privacy/", note: "Hosts and serves the Platform's web application. Standard server logs may include IP addresses." },
            { name: "LLM Providers", role: "AI Assistant (when you provide your API key)", note: "Your chat messages are forwarded to the LLM provider of your choice (OpenAI, Anthropic, Google, etc.) using your own API key. Their respective privacy policies apply to that data. We do not store your messages with their services on your behalf." },
          ].map((p) => (
            <div key={p.name} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm">
              <p className="font-semibold text-white/80">{p.name} <span className="text-white/40 font-normal">— {p.role}</span></p>
              <p className="text-white/50 mt-1">{p.note}</p>
              {"url" in p && p.url && (
                <a href={p.url} className="text-violet-400/70 hover:text-violet-400 text-xs mt-1 inline-block" target="_blank" rel="noopener noreferrer">Privacy Policy →</a>
              )}
            </div>
          ))}
        </div>
        <p className="text-white/60 text-sm mt-4">
          We may disclose data if required to do so by law, court order, or governmental authority, or to protect the rights,
          property, or safety of the Company, our users, or the public.
        </p>
      </section>

      {/* ── 5. Data Security ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">5. Data Security</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>5.1 OAuth tokens and LLM API keys are encrypted at rest using AES-256 before being written to the database.</li>
          <li>5.2 All data access to your records is enforced using Row-Level Security (RLS) policies — no user can access another user's data.</li>
          <li>5.3 All data in transit between your browser and our servers is encrypted with TLS.</li>
          <li>5.4 We do not store your brokerage account passwords or trading PIN.</li>
          <li>5.5 While we implement industry-standard security, no system is perfectly secure. You accept residual risk by using the Platform.</li>
        </ul>
      </section>

      {/* ── 6. Data Retention ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">6. Data Retention</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>6.1 Your data is retained as long as your account is active.</li>
          <li>6.2 Upon account deletion or a valid erasure request, your personal and financial data will be deleted within <strong className="text-white/70">30 days</strong>, except where retention is required by applicable law.</li>
          <li>6.3 Anonymised aggregate analytics data may be retained indefinitely.</li>
          <li>6.4 Chat history is retained to provide conversation continuity and can be cleared by you at any time from your account settings.</li>
        </ul>
      </section>

      {/* ── 7. Your Rights (DPDPA 2023) ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">7. Your Rights under DPDPA 2023</h2>
        <p className="text-white/60 text-sm mb-3">As a Data Principal under the Digital Personal Data Protection Act 2023, you have the following rights:</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { right: "Right to Access", desc: "Request a summary of personal data we hold about you and how it is being used." },
            { right: "Right to Correction", desc: "Request correction of inaccurate or incomplete personal data." },
            { right: "Right to Erasure", desc: "Request deletion of your personal data, subject to legal retention obligations." },
            { right: "Right to Grievance Redressal", desc: "Lodge a complaint about our data handling practices with our Grievance Officer." },
            { right: "Right to Nominate", desc: "Nominate an individual to exercise your rights on your behalf in event of death or incapacity (as per DPDPA 2023)." },
            { right: "Withdrawal of Consent", desc: "Withdraw consent for data processing at any time; this will not affect lawfulness of processing before withdrawal." },
          ].map((item) => (
            <div key={item.right} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <p className="text-sm font-semibold text-white/80 mb-1">{item.right}</p>
              <p className="text-xs text-white/50">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-white/60 text-sm mt-4">To exercise these rights, contact our Grievance Officer at <a href="mailto:legal@upflowsprint.com" className="text-violet-400 hover:text-violet-300">legal@upflowsprint.com</a>. We will respond within 30 days of receiving a verifiable request.</p>
      </section>

      {/* ── 8. Cookies ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">8. Cookies & Local Storage</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>8.1 The Platform uses cookies strictly for authentication session management (HttpOnly, Secure, SameSite=Lax).</li>
          <li>8.2 Local browser storage may be used for UI preferences (e.g., sidebar state, theme), which contains no personal data.</li>
          <li>8.3 Third-party analytics cookies may be present on the public landing page only, subject to standard browser privacy controls.</li>
          <li>8.4 No advertising or tracking cookies are used in authenticated app sections.</li>
        </ul>
      </section>

      {/* ── 9. Children ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">9. Children's Privacy</h2>
        <p className="text-white/60 text-sm">The Platform is not directed at persons under 18 years of age. We do not knowingly collect personal data from minors. If you believe a minor has provided us data, please contact legal@upflowsprint.com immediately.</p>
      </section>

      {/* ── 10. Changes ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">10. Changes to This Policy</h2>
        <p className="text-white/60 text-sm">We may update this Privacy Policy from time to time. Material changes will be notified via email and/or a Platform notice at least 15 days before taking effect. Your continued use of the Platform after the effective date constitutes your acceptance of the revised policy.</p>
      </section>

      {/* Navigation */}
      <div className="not-prose mt-10 flex flex-wrap gap-3 text-xs">
        <Link href="/legal/terms" className="rounded-lg border border-white/10 px-4 py-2 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors">← Terms of Service</Link>
        <Link href="/legal/disclaimer" className="rounded-lg border border-white/10 px-4 py-2 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors">Financial Disclaimer →</Link>
        <Link href="/legal/beta-agreement" className="rounded-lg border border-white/10 px-4 py-2 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors">Beta Agreement →</Link>
      </div>
    </div>
  )
}
