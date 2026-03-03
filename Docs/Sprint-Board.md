# Sprint Board — Fresh Build (v2)

Sprint length: 2 weeks
Sprint start: 2026-03-03

## Architecture Decisions (v2)
- **Single Next.js 14 app at project root** — no monorepo, no base directory complexity
- **App Router** — server components, route handlers, middleware
- **Tailwind CSS v3.4** — stable, no lightningcss binary issues
- **shadcn/ui** — Radix-based accessible components
- **Supabase Auth (SSR)** — cookie-based sessions with @supabase/ssr
- **Upstox integration** — sandbox token + OAuth flow, holdings sync
- **Netlify deployment** — simple `next build`, @netlify/plugin-nextjs v5

## Sprint 1 — Foundation + Auth + Portfolio + Upstox (Current)

### Backlog
- Multi-Agent AI System (Research, Analysis, Execution agents)
- Chat Assistant UI with LLM routing
- Quant Engine (RSI, SMA, EMA, MACD, ATR, Beta, composite scoring)
- Recommendations view with composite scores
- Analytics dashboard with portfolio performance charts
- Daily cron job for holdings sync + indicator computation
- Email notifications (Brevo/SendGrid)

### To Do
- Settings page (API key management)
- Holdings detail view with per-stock analytics

### In Progress

### Done
- Project documentation (Docs/)
- DB schema design & migrations (infrastructure/)
- Supabase project setup (auth, DB, RLS policies)
- Demo user created (r.ni.das@gmail.com / RudzPortfolio@test123#)
- Portfolio data seeded in Supabase
- Codebase reset — removed old broken code, kept docs/infra/env

### Sprint 1 Goals
1. ✅ Clean codebase reset
2. Fresh Next.js 14 project setup (root-level, App Router)
3. Supabase Auth integration (sign in, sign up, sign out, session management)
4. Protected dashboard with auth middleware
5. Portfolio management (view holdings from Supabase, P&L display)
6. Upstox sandbox integration (direct token + OAuth flow)
7. Holdings sync from Upstox API
8. Deploy to Netlify and verify live site

### Sprint 1 Acceptance Criteria
- [ ] User can sign in with email/password via Supabase Auth
- [ ] Authenticated users see dashboard with portfolio overview
- [ ] Holdings table shows all seeded stocks with P&L
- [ ] Upstox connection settings work (sandbox token)
- [ ] Holdings sync from Upstox populates/updates portfolio
- [ ] Site deploys cleanly to Netlify with no build errors
- [ ] No stale cache issues — proper CDN headers
- [ ] Mobile-responsive layout

## Sprint 2 — AI + Recommendations (Planned)
- LLM routing layer (OpenAI, Anthropic, Google)
- Chat Assistant with tool calling
- Quant Engine indicators
- Composite scoring + recommendations
- Research agent (Tavily)
- Settings page for API keys

## Sprint 3 — Polish + Production (Planned)
- Analytics dashboard with charts
- Email notifications
- Daily cron jobs
- Upstox live trading mode
- Performance optimization
