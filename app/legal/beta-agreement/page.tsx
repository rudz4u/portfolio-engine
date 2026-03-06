import Link from "next/link"

export const metadata = {
  title: "Beta User Agreement — Invest Buddy AI",
}

const EFFECTIVE_DATE = "6 March 2026"
const VERSION = "Beta v1.0"

export default function BetaAgreementPage() {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {/* Header */}
      <div className="not-prose mb-10">
        <p className="text-xs font-mono text-violet-400/60 uppercase tracking-widest mb-2">Legal</p>
        <h1 className="text-3xl font-bold text-white mb-2">Beta User Agreement</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
          <span>Effective: {EFFECTIVE_DATE}</span>
          <span>·</span>
          <span className="rounded-full bg-amber-500/15 border border-amber-400/20 text-amber-400 px-2 py-0.5">Beta Program</span>
          <span>·</span>
          <span className="rounded-full bg-violet-500/15 border border-violet-400/20 text-violet-400 px-2 py-0.5">{VERSION}</span>
        </div>
        <p className="mt-4 text-white/50 text-sm leading-relaxed">
          This Beta User Agreement ("Beta Agreement") supplements the{" "}
          <Link href="/legal/terms" className="text-violet-400 hover:text-violet-300">Terms of Service</Link> and applies
          specifically to your participation in the closed beta testing phase of{" "}
          <strong className="text-white/70">Invest Buddy AI</strong>, operated by{" "}
          <strong className="text-white/70">Upflow Sprint Private Limited</strong>. By accessing the beta version, you
          acknowledge and agree to this agreement in addition to the Terms of Service.
        </p>
      </div>

      {/* ── Beta Status Banner ── */}
      <div className="not-prose mb-10 rounded-xl border border-amber-400/25 bg-amber-400/5 px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">🧪</span>
          <div>
            <p className="text-sm font-bold text-amber-400 mb-1">You are accessing a Beta version of Invest Buddy AI</p>
            <p className="text-sm text-amber-300/70">
              This is an early-access, non-production version of the Platform. It may contain bugs, incomplete features,
              and unexpected behaviour. Thank you for helping us build and improve the platform.
            </p>
          </div>
        </div>
      </div>

      {/* ── 1. Beta Access ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">1. Closed Beta Access</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>1.1 The current version of Invest Buddy AI is a <strong className="text-white/70">closed beta</strong>. Access is restricted to users who have been invited or approved by Upflow Sprint Private Limited.</li>
          <li>1.2 Beta access is granted free of charge during the beta period. The Company reserves the right to introduce pricing when the Platform transitions to general availability.</li>
          <li>1.3 Beta access is non-transferable. You may not share your account, invite link, or beta credentials with any other person without written consent from the Company.</li>
        </ul>
      </section>

      {/* ── 2. Beta Software Limitations ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">2. Beta Software — Nature & Limitations</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>2.1 The beta Platform is provided in an <strong className="text-white/70">"as-is" state</strong> for the purposes of testing and evaluation. It is not a finished, production-ready product.</li>
          <li>2.2 You acknowledge that beta software may:
            <ul className="mt-2 ml-4 space-y-1">
              <li>Contain bugs, errors, or defects that may cause unexpected behaviour</li>
              <li>Experience downtime, data processing delays, or temporary outages</li>
              <li>Produce inaccurate or incomplete outputs due to ongoing model tuning</li>
              <li>Have features that are partially implemented or in an experimental state</li>
            </ul>
          </li>
          <li>2.3 <strong className="text-white/70">No SLA (Service Level Agreement) applies during the beta phase.</strong> Uptime, response time, and availability are not guaranteed.</li>
          <li>2.4 The Company provides no warranty of any kind for the beta Platform, express or implied, including fitness for a particular purpose or merchantability.</li>
        </ul>
      </section>

      {/* ── 3. Feature Changes ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">3. Feature Changes During Beta</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>3.1 Features of the Platform may be added, modified, temporarily disabled, or permanently removed at any time during the beta phase, without prior notice or compensation.</li>
          <li>3.2 The final general availability version of the Platform may differ significantly from the current beta version in terms of features, design, functionality, and pricing.</li>
          <li>3.3 API endpoints, data schemas, and integration methods may change without notice during the beta phase.</li>
        </ul>
      </section>

      {/* ── 4. Data During Beta ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">4. Data Handling During Beta</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>4.1 Your portfolio data, chat history, settings, and configurations are stored and persisted across sessions during the beta.</li>
          <li>4.2 In the event of a <strong className="text-white/70">major infrastructure migration, schema change, or data reset</strong>, the Company will make reasonable efforts to notify you in advance via email. However, no guarantee of complete data preservation is made during beta.</li>
          <li>4.3 At the transition from beta to general availability, your account and data will be migrated. If migration is not possible, you will be notified and given at least 14 days to export your data.</li>
          <li>4.4 All data handling during beta is subject to the <Link href="/legal/privacy" className="text-violet-400 hover:text-violet-300">Privacy Policy</Link>.</li>
        </ul>
      </section>

      {/* ── 5. Feedback ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">5. Feedback & Bug Reporting</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>5.1 As a beta user, you are encouraged — but not obligated — to provide feedback, report bugs, and suggest improvements.</li>
          <li>5.2 Any feedback or bug reports you submit become the property of the Company and may be used to improve the Platform without obligation, attribution, or compensation to you.</li>
          <li>5.3 You can submit feedback or report issues by emailing <a href="mailto:support@upflowsprint.com" className="text-violet-400 hover:text-violet-300">support@upflowsprint.com</a>.</li>
          <li>5.4 Please report any security vulnerabilities responsibly to <a href="mailto:security@upflowsprint.com" className="text-violet-400 hover:text-violet-300">security@upflowsprint.com</a> — do not disclose them publicly until the Company has had a reasonable opportunity to address them.</li>
        </ul>
      </section>

      {/* ── 6. Confidentiality ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">6. Confidentiality</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>6.1 As a beta user, you may be exposed to unreleased features, designs, or functionality. You agree to treat any such non-public information as confidential.</li>
          <li>6.2 You agree not to publicly share screenshots, descriptions, or details of unreleased features without explicit written permission from the Company.</li>
          <li>6.3 You may share general feedback about the product (e.g., "I'm testing an AI portfolio tool") without violating this clause.</li>
        </ul>
      </section>

      {/* ── 7. Termination of Beta Access ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">7. Termination of Beta Access</h2>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>7.1 The Company reserves the right to terminate your beta access at any time, for any reason, with or without notice, including at the end of the overall beta program.</li>
          <li>7.2 You may also voluntarily terminate your beta participation at any time by contacting <a href="mailto:support@upflowsprint.com" className="text-violet-400 hover:text-violet-300">support@upflowsprint.com</a>.</li>
          <li>7.3 Termination of beta access does not automatically delete your account or data. Data deletion is governed by the <Link href="/legal/privacy" className="text-violet-400 hover:text-violet-300">Privacy Policy</Link> upon your request.</li>
        </ul>
      </section>

      {/* ── 8. Transition to Production ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">8. Transition to General Availability</h2>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-5 py-4 mb-4">
          <p className="text-sm text-green-300/70">
            When Invest Buddy AI launches officially to the general public, all beta users will receive advance notice by email.
            You will be invited to review and accept the updated Terms and Pricing applicable to the production version. We appreciate
            your early support and will do our best to ensure a smooth transition for active beta users.
          </p>
        </div>
        <ul className="space-y-2 text-white/60 text-sm">
          <li>8.1 Upon transition to general availability, this Beta User Agreement will be superseded by the updated Terms of Service for the production version.</li>
          <li>8.2 Continued use of the Platform after the production launch date will constitute acceptance of the production Terms.</li>
          <li>8.3 Beta users who do not wish to accept the production Terms may request account deletion before the transition date.</li>
        </ul>
      </section>

      {/* ── 9. Thank You ── */}
      <div className="not-prose mt-10 rounded-xl border border-violet-400/20 bg-violet-400/5 px-6 py-5">
        <p className="text-sm font-semibold text-violet-400 mb-2">Thank you for being an early tester! 🙏</p>
        <p className="text-sm text-violet-300/60">
          Your participation in the Invest Buddy AI beta helps us build a better, more reliable product. We value your
          patience with rough edges and your feedback in shaping the platform. Questions or concerns? Reach us at{" "}
          <a href="mailto:support@upflowsprint.com" className="text-violet-300 hover:text-violet-200">support@upflowsprint.com</a>.
        </p>
      </div>

      {/* Navigation */}
      <div className="not-prose mt-10 flex flex-wrap gap-3 text-xs">
        <Link href="/legal/terms" className="rounded-lg border border-white/10 px-4 py-2 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors">← Terms of Service</Link>
        <Link href="/legal/privacy" className="rounded-lg border border-white/10 px-4 py-2 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors">← Privacy Policy</Link>
        <Link href="/legal/disclaimer" className="rounded-lg border border-white/10 px-4 py-2 text-white/50 hover:text-white/80 hover:border-white/20 transition-colors">← Financial Disclaimer</Link>
      </div>
    </div>
  )
}
