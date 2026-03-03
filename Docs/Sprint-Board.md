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

## Sprint 2 — AI + Recommendations ✅ COMPLETE

### Completed ✅
- LLM routing layer (OpenAI, Anthropic, Google Gemini, DeepSeek) with user-configurable API keys
- **Chat Assistant with multi-turn history** — last 20 messages sent as context to LLM; history persisted in `chat_history` table; clear-history button
- **Quant Engine** — `lib/quant/indicators.ts`: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, ROC fully implemented; `lib/quant/scoring.ts`: wired RSI approximation + MACD trend proxy into composite scoring; `ScoredHolding` now includes `rsi_approx`, `technical_signal`, `macd_trend`
- Composite scoring endpoint `/api/analysis/score` — 0–100 score + BUY/HOLD/SELL/WATCH per holding
- **Recommendations page** — RSI≈ and MACD trend chips per holding card; colour-coded oversold/overbought
- **Research agent** — Tavily news search via `/api/research/news` expanded inline per stock
- Settings page — API key management (OpenAI / Anthropic / Gemini / DeepSeek / preferred model)
- Upstox OAuth + holdings sync working (sandbox + live)

### Sprint 2 Acceptance Criteria
- [x] AI assistant responds with portfolio context (RSI, MACD, signals)
- [x] Conversation history persists across page reloads
- [x] Multi-turn context passed to LLM (last 20 messages)
- [x] Recommendations page shows BUY/HOLD/SELL/WATCH + RSI/MACD chips
- [x] Quant indicators (RSI, SMA, EMA, MACD, Bollinger, ATR) implemented in lib/quant
- [x] Research agent fetches live news per stock

## Sprint 3 — Production Features ✅ COMPLETE

### Completed ✅
- **Analytics dashboard** — sector pie chart, top gainers/losers bar, portfolio value area chart (recharts)
- **Email digest** — Brevo integration; `/api/cron/digest` sends daily HTML email with portfolio snapshot
- **Daily cron sync** — Netlify Scheduled Function `Mon–Fri 4:30 AM UTC (10 AM IST)` calls `/api/cron/sync-all`; multi-user batch Upstox sync; self-contained (no Supabase Edge Function needed)
- **Portfolio value snapshots** — `portfolio_snapshots` table (migration 007); daily upsert per portfolio after every sync; dashboard area chart shows trend when ≥2 days of data exist
- Upstox live trading mode — Trade page with live order placement + history
- Sortable portfolio table — all columns sortable, inline segment editing, colour exchange badges
- **Upstox OAuth flow** — `/api/oauth/upstox/authorize` + callback; auto-sync on connect

### Sprint 3 Acceptance Criteria
- [x] Dashboard shows portfolio trend chart (area chart, snapshots)
- [x] Daily cron syncs all users automatically
- [x] Email digest sends via Brevo
- [x] Trade page works with live Upstox orders
- [x] Migration 007 (portfolio_snapshots) executed

## Sprint 4 — Next Milestones (Planned)
- Per-stock detail page with historical indicators chart
- Portfolio analytics: Sharpe ratio, Beta, sector correlation matrix
- Watchlist enhancements: price alerts, target price tracking
- Mobile PWA: offline support, push notifications
- Performance: bundle splitting, ISR for static pages
- Multi-portfolio support improvements


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
