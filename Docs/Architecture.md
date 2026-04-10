# Architecture Overview

> Portfolio Engine — A personalised, AI-powered stock portfolio management platform.

---

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router, TypeScript) + Tailwind CSS + Shadcn UI + Framer Motion |
| **Backend** | Next.js API Routes (Route Handlers) + Supabase Edge Functions |
| **Database** | Supabase (PostgreSQL) with Row-Level Security |
| **Auth** | Supabase Auth (Google OAuth + Email/Password) |
| **Brokerage** | Upstox V3 API (OAuth 2.0, Holdings, Orders, Market Data) |
| **AI Layer** | Multi-LLM routing (Gemini / OpenAI / Anthropic) |
| **Research** | Tavily API for web market data, news, and sentiment |
| **Hosting** | Netlify (Edge & Serverless Functions) |
| **PWA** | Service Worker + Web App Manifest for installable app |

---

## Project Structure

```
app/
├── (protected)/           # Auth-required pages
│   ├── dashboard/         # Portfolio overview + profile widget
│   ├── portfolio/         # Holdings table + stock detail pages
│   │   └── [symbol]/      # Per-stock analysis + override settings
│   ├── recommendations/   # Personalised signals + opportunity discovery
│   ├── analysis/          # Deep analysis tools
│   ├── analytics/         # Portfolio analytics & charts
│   ├── watchlist/         # User watchlists
│   ├── trade/             # Order execution interface
│   ├── assistant/         # AI chat assistant
│   ├── sandbox/           # Strategy testing sandbox
│   └── settings/          # All configuration pages
│       ├── investor-profile/  # Full investor profile settings
│       ├── portfolio/         # Portfolio-level settings
│       ├── connection/        # Upstox API connection
│       ├── ai/                # LLM key configuration
│       ├── notifications/     # Alert preferences
│       ├── profile/           # User profile (name, email)
│       └── database/          # Data management
├── api/
│   ├── analysis/
│   │   ├── score/         # Composite scoring API (real technicals + overrides)
│   │   └── health-check/  # Portfolio health assessment
│   ├── recommendations/
│   │   └── personalized/  # Profile-aware recommendations + discovery
│   ├── holdings/
│   │   ├── [id]/          # Individual holding CRUD
│   │   └── overrides/     # Per-stock strategy overrides API
│   ├── advisory/          # Advisory consensus endpoints
│   ├── candles/           # Historical candle data
│   ├── instruments/       # Instrument search & metadata
│   ├── orders/            # Order placement & tracking
│   ├── portfolio/         # Portfolio CRUD & sync
│   ├── profile/           # Investor profile API
│   ├── settings/          # User settings API
│   ├── trade/             # Trade execution
│   ├── assistant/         # AI assistant API
│   ├── upstox/            # Upstox proxy endpoints
│   ├── oauth/             # OAuth callback handler
│   ├── watchlist(s)/      # Watchlist CRUD
│   ├── research/          # Tavily-powered research
│   ├── notifications/     # Push notification hooks
│   └── cron/              # Scheduled jobs
├── signin/                # Authentication pages
└── legal/                 # Terms, privacy, disclaimer

lib/
├── quant/
│   ├── scoring.ts         # Composite scoring engine (4-component + overrides)
│   ├── scoring-defaults.ts # Default weights & weight validation
│   └── indicators.ts      # RSI, MACD, Bollinger, ATR, SMA, EMA
├── candles/
│   ├── fetch.ts           # Upstox V3 candle data fetcher
│   ├── technicals.ts      # Full technical analysis pipeline
│   ├── build-technicals.ts # Bridge: candles → scoring engine
│   └── types.ts           # CandleData, TechnicalAnalysis interfaces
├── signals/
│   ├── explainer.ts       # Profile-aware signal explanations
│   └── discovery.ts       # Opportunity discovery (non-held stocks)
├── advisory/
│   └── consensus.ts       # Advisory consensus aggregation
├── types/
│   └── investor-profile.ts # All investor profile types & constants
├── supabase/
│   ├── server.ts          # Server-side Supabase client
│   ├── client.ts          # Browser-side Supabase client
│   └── middleware.ts       # Auth middleware helper
├── hooks/                 # React hooks (useToast, etc.)
├── providers/             # React context providers
├── import/                # Portfolio import utilities
└── utils.ts               # Shared utility functions

components/
├── stock-override-form.tsx  # Per-stock strategy settings form
├── onboarding-wizard.tsx    # 9-step investor profile wizard
├── onboarding-provider.tsx  # Existing users profile nudge
├── portfolio-switcher.tsx   # Multi-portfolio selector
├── sidebar.tsx              # Navigation sidebar
├── candlestick-chart.tsx    # Interactive chart component
├── signal-badge.tsx         # Signal display badges
├── score-bar.tsx            # Score visualisation bars
└── ui/                      # Shadcn UI primitives

infrastructure/
├── migrations/            # 12 SQL migrations (001–012)
├── seeds/                 # Strategy presets, demo data
└── supabase/functions/    # Edge functions
```

---

## Data Flow

### Signal Generation Pipeline

```
1. Upstox Sync (cron/manual)
   ├── Fetch holdings (LTP, quantity, avg_price, day_change)
   ├── Fetch 180-day candles for each instrument
   └── Store in portfolios + holdings tables

2. Advisory Pipeline (daily cron)
   ├── Aggregate SEBI advisor recommendations
   ├── Compute weighted consensus score (0–25)
   └── Store in advisory_consensus table

3. Scoring API Request (/api/analysis/score)
   ├── Load holdings from DB
   ├── Load investor profile + active strategy preset
   ├── Load per-stock holding overrides
   ├── Load advisory consensus for today
   ├── Build technical indicators map (RSI, MACD, patterns)
   │   └── lib/candles/build-technicals.ts
   │       ├── Resolve Upstox market data token
   │       ├── Fetch 180-day daily candles in batches
   │       ├── Compute RSI(14), MACD(12,26,9), patterns
   │       └── Return Map<instrument_key, RealTechnicalData>
   ├── Run composite scoring engine
   │   └── lib/quant/scoring.ts
   │       ├── Momentum (0–30): P&L%, day change, RSI, MACD, patterns
   │       ├── Valuation (0–25): LTP vs avg_price gap
   │       ├── Position (0–20): portfolio weight vs ideal band
   │       ├── Advisory (0–25): SEBI consensus
   │       ├── Sector bonus (+4/-6)
   │       └── Holding overrides (stop-loss, target, forced signal)
   └── Persist scored report to analysis_reports table

4. Personalised Recommendations (/api/recommendations/personalized)
   ├── All of step 3 above, plus:
   ├── Attach signal explanations (lib/signals/explainer.ts)
   ├── Discover investment opportunities (lib/signals/discovery.ts)
   └── Segment by actionability (BUY/SELL highlighted, WATCH listed)
```

### Authentication Flow

```
User → Next.js Middleware → Supabase Auth check
├── Authenticated → Access protected routes
├── Unauthenticated → Redirect to /signin
└── OAuth callback → /api/oauth/callback → Set session → Redirect
```

### Upstox Integration Flow

```
1. User connects Upstox in Settings → Connection
2. OAuth 2.0 flow → /api/oauth/upstox/callback
3. Access token stored encrypted in user_settings
4. Token used for:
   ├── Holdings sync (portfolio data)
   ├── Market data (LTP, candles)
   ├── Order placement
   └── WebSocket live prices
```

---

## Key Design Decisions

1. **Server Components by default** — Only `"use client"` where interactivity is needed (forms, charts, real-time data).
2. **Score caching** — Analysis reports are persisted per instrument, rate-limited to 1 write per hour to avoid DB bloat.
3. **Graceful degradation** — All features work without an investor profile (moderate defaults), without Upstox token (P&L approximations for technicals), and without advisory data (neutral 12/25 fallback).
4. **RLS everywhere** — Every user-facing table has Row-Level Security policies ensuring `auth.uid() = user_id`.
5. **Dark UI** — Consistent dark theme with `bg-[hsl(222,47%,6%)]` base, indigo/violet accents, Framer Motion page transitions.
6. **PWA support** — Installable on mobile with service worker, manifest.json, and app icons.
