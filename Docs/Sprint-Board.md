# Sprint Board — Fresh Build (v2)

Sprint length: 2 weeks
Sprint start: 2026-03-03

## Architecture Decisions (v2)
- **Single Next.js 15.5.12 app at project root** — no monorepo, no base directory complexity
- **App Router** — server components, route handlers, middleware
- **Tailwind CSS v3.4** — stable, no lightningcss binary issues
- **Custom shadcn/Radix UI components** — Radix-based accessible components
- **Supabase Auth (SSR)** — cookie-based sessions with @supabase/ssr
- **Upstox integration** — sandbox token + OAuth flow, holdings sync
- **Netlify deployment** — simple `next build`, @netlify/plugin-nextjs v5.15
- **No turbopack** — standard webpack for stability

## Sprint 1 — Foundation + Auth + Portfolio + Upstox ✅ COMPLETE

### Completed ✅
- Project documentation preserved (Docs/, infrastructure/, env)
- Codebase reset — removed old monorepo (apps/web, packages/), .venv, scripts
- Sprint Board reset
- **package.json** — Next.js 15.5.12, React 18, @supabase/ssr, Radix UI, 0 vulnerabilities
- **tsconfig.json**, **next.config.js**, **tailwind.config.ts**, **postcss.config.js**
- **netlify.toml** — simplified (no base dir, SECRETS_SCAN_OMIT_KEYS fixed)
- **lib/** — utils, supabase/{client,server,middleware}, upstox config, use-toast hook
- **middleware.ts** — route protection for /dashboard, /portfolio, /settings, /assistant
- **app/globals.css** — CSS custom properties + Tailwind base
- **UI components** — button, input, card, label, badge, skeleton, tabs, separator, toast, toaster
- **components/sidebar.tsx** — navigation with mobile toggle, sign out
- **app/page.tsx** — landing page (static, CDN-cached)
- **app/signin/** — email/password auth + sign-up with Supabase Auth
- **app/(protected)/dashboard/** — server component, portfolio KPIs + segment allocation + gainers/losers
- **app/(protected)/portfolio/** — server component, full holdings table with P&L, segments
- **app/(protected)/settings/** — Upstox connection test + OAuth connect + sandbox toggle
- **app/(protected)/sandbox/** — live Upstox fetch + sync to Supabase
- **app/(protected)/assistant/** — AI chat UI with starter prompts
- **API routes** — /api/upstox/{profile,holdings,sync,authorize,callback}, /api/assistant
- **TypeScript check** — 0 errors
- **Local build** — clean, 14 routes (all dynamic/protected + static landing)
- **Live deployment** — https://brokerai.rudz.in ✅
- **Auth** — sign in → /dashboard redirect working ✅
- **Dashboard** — real Supabase data: ₹3,37,846 invested, 50 holdings ✅
- **Portfolio** — 51-row holdings table ✅
- Fixed Netlify build cache issue (old monorepo turbopack chunks polluting webpack cache)

### Sprint 1 Acceptance Criteria
- [x] User can sign in with email/password via Supabase Auth
- [x] Authenticated users see dashboard with portfolio overview
- [x] Holdings table shows all seeded stocks with P&L
- [x] Upstox connection settings work (sandbox token)
- [x] Site deploys cleanly to Netlify with no build errors
- [x] No stale cache issues — correct webpack chunk hashes deployed
- [x] Mobile-responsive layout (sidebar with mobile toggle)

## Sprint 2 — AI + Recommendations (Next)

### Backlog
- LLM routing layer (OpenAI, Anthropic, Google Gemini)
- Chat Assistant with real message history persistence
- Quant Engine: RSI, SMA, EMA, MACD, ATR, Beta, composite scoring
- Composite scoring via `/api/analysis/score` route
- Recommendations view with buy/sell signals + reasoning
- Research agent (Tavily web search for stock news)
- Settings — API key management UI (save to user_settings)

### Sprint 2 Goals
1. Complete AI assistant with LLM routing + chat history
2. Port quant engine indicators (RSI, moving averages, bands)
3. Composite scoring endpoint + recommendations page
4. Upstox live holdings auto-sync (test with sandbox token)
5. Settings: let user enter their own OpenAI/Anthropic key

## Sprint 3 — Polish + Production (Planned)
- Analytics dashboard with charts (recharts)
- Email notifications (Brevo/SendGrid)
- Daily cron jobs (Supabase Edge Function)
- Upstox live trading mode (order execution)
- Performance optimization + bundle splitting


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
