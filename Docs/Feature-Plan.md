# Feature Plan & Roadmap

> Portfolio Engine — Implemented features and planned enhancements.

---

## Implemented Features

### Phase 1: Foundation ✅

| Feature | Status | Files |
|---------|--------|-------|
| **Type System** | Complete | `lib/types/investor-profile.ts` — 8 investor types, 5 risk levels, 4 experience levels, 5 decision styles, 6 investment goals, 19 sectors |
| **Database Migration** | Complete | `infrastructure/migrations/011_create_investor_profiles.sql` — investor_profiles + strategy_presets tables with RLS |
| **Seed Data** | Complete | `infrastructure/seeds/` — 5 system strategy presets (Conservative Income, Balanced Growth, Momentum Trader, Value Hunter, Aggressive Swing) |
| **Profile API** | Complete | `app/api/profile/investor/route.ts` — GET/POST/PATCH for investor profiles |
| **Preset API** | Complete | `app/api/profile/presets/route.ts` — GET presets, POST recommend-preset |
| **Settings API** | Complete | `app/api/settings/investor-profile/route.ts` — Merged profile + presets endpoint |
| **Onboarding Wizard** | Complete | `components/onboarding-wizard.tsx` — 9-step wizard with visual cards, sliders, multi-select |

### Phase 2: Profile-Aware Scoring Engine ✅

| Feature | Status | Files |
|---------|--------|-------|
| **Enhanced Scoring** | Complete | `lib/quant/scoring.ts` — 4-component (Momentum 0–30, Valuation 0–25, Position 0–20, Advisory 0–25) + profile-aware bands + sector bonus + overrides |
| **Real Technical Indicators** | Complete | `lib/candles/build-technicals.ts` — bridges 180-day candle data (RSI(14), MACD(12,26,9), patterns) into scoring engine |
| **Strategy Presets** | Complete | Preset-defined weights and thresholds override defaults |
| **Profile Alignment** | Complete | 0–100 alignment score (sector fit 40% + sizing fit 30% + risk fit 30%) |

### Phase 3: Personalised Signals ✅

| Feature | Status | Files |
|---------|--------|-------|
| **Signal Explainer** | Complete | `lib/signals/explainer.ts` — profile-aware, template-based signal explanations |
| **Opportunity Discovery** | Complete | `lib/signals/discovery.ts` — discovers BUY opportunities from advisory consensus, filtered by profile sectors/goals |
| **Personalised Recommendations API** | Complete | `app/api/recommendations/personalized/route.ts` — full scoring + explanations + discovery + overrides |
| **Recommendations Page** | Complete | `app/(protected)/recommendations/` — signal highlights, watchlist, opportunity cards |

### Phase 4: AI Integration ✅

| Feature | Status | Files |
|---------|--------|-------|
| **Assistant Profile Injection** | Complete | AI assistant receives investor profile context for personalised responses |
| **Health Check API** | Complete | `app/api/analysis/health-check/route.ts` — profile-aware portfolio health assessment |

### Phase 5: Settings & Nudges ✅

| Feature | Status | Files |
|---------|--------|-------|
| **Investor Profile Settings** | Complete | `app/(protected)/settings/investor-profile/page.tsx` — full CRUD with AI preset recommendation |
| **Dashboard Widget** | Complete | `app/(protected)/dashboard/page.tsx` — profile alignment widget showing signal distribution |
| **Existing Users Banner** | Complete | `components/onboarding-provider.tsx` — nudge for users without profiles |
| **Sidebar Navigation** | Complete | `components/sidebar.tsx` — "Investor Profile" link in settings submenu |

### Phase 6: Stock-Level Strategy ✅

| Feature | Status | Files |
|---------|--------|-------|
| **Holding Overrides Table** | Complete | `infrastructure/migrations/012_create_holding_overrides.sql` — per-stock goals, targets, stop-losses, signal overrides, allocation limits, hold-until dates |
| **Override Types** | Complete | `lib/types/investor-profile.ts` — HoldingOverride, HoldingGoal types + labels |
| **Overrides API** | Complete | `app/api/holdings/overrides/route.ts` — GET/POST/DELETE with validation |
| **Scoring Integration** | Complete | `lib/quant/scoring.ts` — overrides map parameter, stop-loss/target/hold-until/forced signal logic |
| **Stock Settings UI** | Complete | `components/stock-override-form.tsx` — per-stock strategy form on stock detail page |
| **Score API Integration** | Complete | `app/api/analysis/score/route.ts` — loads overrides, passes to scoring engine |
| **Recommendations Integration** | Complete | `app/api/recommendations/personalized/route.ts` — same overrides integration |

---

## Documentation ✅

| Document | Status | File |
|----------|--------|------|
| **Signal Methodology** | Complete | `Docs/Signal-Methodology.md` — comprehensive scoring formula, technical indicators, thresholds, override hierarchy |
| **Investor Profile System** | Complete | `Docs/Investor-Profile-System.md` — all profile fields, type defaults, presets, onboarding flow, per-stock overrides |
| **Architecture** | Updated | `Docs/Architecture.md` — full project structure, data flow, technology stack |
| **Database Schema** | Updated | `Docs/DB-Schema.md` — all 12 tables with columns, types, and migration history |
| **Feature Plan** | Complete | `Docs/Feature-Plan.md` (this file) |

---

## Planned Enhancements

### Near-term

| Feature | Priority | Description |
|---------|----------|-------------|
| **Trailing Stop-Loss Engine** | High | Auto-adjust stop-loss from peak price using `trailing_stop_pct`. Requires live price monitoring via WebSocket or cron. |
| **Horizon-Aware Scoring** | High | Factor `investment_horizon` into signal generation — short-horizon stocks should have higher momentum weight, long-horizon should emphasise valuation. |
| **ATR/Volatility Integration** | Medium | Use ATR(14) and `volatility_tolerance` from presets to adjust position sizing recommendations and risk scoring. |
| **Batch Override Management** | Medium | Bulk edit overrides from the portfolio page (set stop-loss for all holdings, etc.) |
| **Override Templates** | Medium | Pre-built override templates (e.g. "Swing Trade" auto-sets 10% trailing stop + 3-month hold) |
| **Profile-Weighted Score** | Medium | Factor profile alignment into the composite score (not just informational) — maybe a 5th scoring component or a multiplier. |
| **Notification Alerts** | Medium | Push notifications when stop-loss or target price is hit, when signals change, or when rebalance is due. |

### Medium-term

| Feature | Priority | Description |
|---------|----------|-------------|
| **Multi-Portfolio Support** | Medium | Full support for multiple portfolios with different profiles/strategies per portfolio. |
| **Paper Trading / Sandbox** | Medium | Simulate trades without executing to test strategies. |
| **Performance Attribution** | Medium | Show how each scoring component contributed to portfolio performance over time. |
| **Social Signals** | Low | Incorporate social sentiment (Twitter/Reddit) as an additional scoring component. |
| **Fundamental Data** | Low | Integrate fundamental data (P/E, earnings, revenue) for deeper valuation scoring. |
| **Backtesting Engine** | Low | Test historical performance of different strategy presets and override configurations. |

### Long-term

| Feature | Priority | Description |
|---------|----------|-------------|
| **Multi-Broker Support** | Low | Extend beyond Upstox to Zerodha, Groww, Angel One, etc. |
| **Portfolio Optimizer** | Low | Suggest optimal portfolio allocation using Modern Portfolio Theory (Markowitz). |
| **Tax-Loss Harvesting** | Low | Identify tax-loss harvesting opportunities based on P&L and holding period. |
| **Custom Indicator Builder** | Low | Let advanced users define custom technical indicators and scoring formulas. |

---

## API Inventory

### Analysis & Scoring
- `GET /api/analysis/score` — Composite scoring with real technicals + overrides
- `GET /api/analysis/health-check` — Portfolio health assessment
- `GET /api/recommendations/personalized` — Full personalised recommendations + discovery

### Holdings & Overrides
- `GET /api/holdings/overrides` — List all overrides (optional `?instrument_key=` filter)
- `POST /api/holdings/overrides` — Create/upsert a holding override
- `DELETE /api/holdings/overrides?instrument_key=` — Remove an override

### Investor Profile
- `GET /api/profile/investor` — Get profile
- `POST /api/profile/investor` — Create profile (from onboarding)
- `PATCH /api/profile/investor` — Update profile
- `GET /api/profile/presets` — List strategy presets
- `POST /api/profile/presets/recommend` — AI-powered preset recommendation

### Portfolio & Market Data
- `GET /api/portfolio` — Portfolio holdings
- `POST /api/portfolio/sync` — Sync from Upstox
- `GET /api/candles/[instrumentKey]` — Historical candle data
- `GET /api/instruments/search` — Instrument search

### Trading & Orders
- `POST /api/orders` — Place order
- `GET /api/orders` — Order history

### AI & Research
- `POST /api/assistant` — AI chat assistant
- `GET /api/research/[symbol]` — Tavily-powered research

### Advisory
- `GET /api/advisory/consensus` — Advisory consensus data

### Settings
- `GET/PATCH /api/settings` — User settings management
