# Plan: Sprint — Bug Fixes, Scoring Customization, Strategy Profile, Branded Loader

## TL;DR

Six tasks spanning bug fixes (daily email, multi-user market data, advisor logo grid), new features (scoring weight customization, user investment strategy profile + diversification calculator), and UX polish (branded loader). Estimated ~14 files modified, 3 new files created, 1 migration.

---

## Phase 1 — Bug Fixes (Tasks 1, 2, 3) — *independent, can run in parallel*

### Task 1: Fix Daily Email Digest

**Root Cause:** The digest route (`app/api/cron/digest/route.ts`) inserts audit logs with columns `report_type` and `data` — but the `analysis_reports` table schema (migration 002) only has `user_id`, `instrument_key`, `report`, `created_at`. The insert silently fails or throws, breaking the audit trail. Additionally, the digest builds portfolio P&L from stale DB values (`unrealized_pl`) without refreshing LTP first, so morning digests contain yesterday's data.

**Steps:**
1. **Fix audit log insert** in `app/api/cron/digest/route.ts` (lines 209-213): Change `report_type` → use `instrument_key` field as tag, and `data` → `report` to match schema.
   ```
   Current:  { user_id, report_type: "daily_digest", data: { sent_to, sent_at } }
   Fix:      { user_id, instrument_key: "daily_digest", report: { sent_to, sent_at } }
   ```
2. **Same fix** in `app/api/notifications/digest/route.ts` (lines 361-371 audit insert) — change `report_type` → `instrument_key`, `data` → `report`.
3. **Add `NEXT_PUBLIC_APP_URL` env var** to `netlify.toml` build.environment section:
   ```
   NEXT_PUBLIC_APP_URL = "https://investbuddyai.com"
   ```
   The daily-sync function reads `NEXT_PUBLIC_APP_URL || "https://investbuddyai.com"` — without this, it works by default, but making it explicit is safer.
4. **Ensure `BREVO_API_KEY` is set** in Netlify dashboard env vars (currently only in `.env.local` — Netlify scheduled functions run remotely).

**Files:**
- `app/api/cron/digest/route.ts` — fix audit insert schema (line ~210)
- `app/api/notifications/digest/route.ts` — fix audit insert schema (line ~365)
- `netlify.toml` — add `NEXT_PUBLIC_APP_URL`

**Verification:**
- POST `/api/notifications/digest` (test digest) → check Brevo delivery + check `analysis_reports` table for new row with `instrument_key = 'daily_digest'`
- GET `/api/notifications/digest` → diagnostics should show Brevo key active, sender domain verified

---

### Task 2: Fix Market Price Fetching for Non-Owner Users

**Root Cause:** The Upstox app is an Indie App (single-user OAuth). Only the app creator (you) can complete Upstox OAuth. Other users who imported portfolios (XLSX/CSV) don't have `upstox_access_token`, so `resolveUpstoxToken()` returns `null` if `UPSTOX_ACCESS_TOKEN` env var is also empty on Netlify.

**Design:** Since Indie App only allows owner OAuth, other users MUST get market data through the server-level fallback token. The fix is twofold:

**Steps:**
1. **Set `UPSTOX_ACCESS_TOKEN` in Netlify dashboard** — this env var acts as the server fallback token for all users without their own Upstox OAuth token. Currently it's only in `.env.local`.
   - **IMPORTANT**: This token expires daily (Upstox access tokens are 24hr). The daily-sync cron already runs with your token. But for live LTP refreshes, we need a valid server token.
   - Document this as an operational requirement in the ENV docs.

2. **Fix `resolveUpstoxToken()` in `lib/upstox-token.ts`** to be more resilient:
   - Currently, if `createClient()` → `getUser()` throws (e.g. no session cookie on API routes), the function falls through to env var — this works.
   - BUT: If the user has an expired/invalid `upstox_access_token` in their preferences, it returns that invalid token instead of falling back. Add an expiry check or a try-with-fallback pattern.

3. **Enhance `app/api/portfolio/refresh-prices/route.ts`** (lines ~100-110):
   - When `resolveUpstoxToken()` returns a user token that fails (401 from Upstox), retry with the env-var fallback token before giving up.
   - Add a clear error message when no token is available at all.

4. **Update `app/api/cron/sync-all/route.ts`**: For users WITH import-only portfolios (no upstox_access_token), also refresh their LTP using the server-level token. Currently the sync-all only processes users who have `upstox_access_token` in prefs — import-only users are skipped entirely.

**Files:**
- `lib/upstox-token.ts` — add fallback-on-failure pattern
- `app/api/portfolio/refresh-prices/route.ts` — retry with server token on 401, add helpful error
- `app/api/cron/sync-all/route.ts` — include import-only users in LTP refresh pass
- `Docs/ENV.md` — document UPSTOX_ACCESS_TOKEN as required for multi-user

**Verification:**
- Create a test user with imported portfolio (no Upstox OAuth) → hit "Refresh Prices" → should get live LTP
- Check Netlify function logs for daily-sync → should show LTP updates for all users

---

### Task 3: Fix Advisor Logo Scoring Grid

**Root Cause:** The advisor logo chips display correctly IF `sourceBreakdown[symbol]` has data. The issue is likely one of these:

A) **Advisory scans haven't populated data** — The `advisory_recommendations` table may be empty or have stale data (older than 7 days, which is the filter in the consensus API).
B) **Symbol mismatch** — The `advisory_recommendations.trading_symbol` may not match the `holdings.trading_symbol` exactly (case, suffix differences).
C) **`advisory_sources.website_url` is null** — If sources were seeded without website_url, `advisorLogoUrl()` returns null and no logo renders (the chip still shows but without the favicon).

**Steps:**
1. **Verify seed data** — Read `infrastructure/seeds/seed_advisory_sources.sql` to check if `website_url` is populated for all sources.
2. **Fix advisory source seed** — Ensure all active sources have valid `website_url` values. The Google Favicons API (`https://www.google.com/s2/favicons?sz=32&domain=...`) needs a real domain.
3. **Fix symbol matching** in `app/api/advisory/consensus/route.ts` (line ~80):
   - Currently uses `.in("trading_symbol", symbolFilter)` — this is case-sensitive in Postgres.
   - Holdings store symbols as uppercase (e.g. "RELIANCE"), but advisory recommendations may store them differently from scraper output.
   - Add `.ilike` filter or normalize both sides to uppercase.
4. **Add fallback UI** in recommendations page for when sourceBreakdown is empty — show "No advisory signals yet. Run a scan to populate." with the scan button.
5. **Verify advisory_recommendations table** has recent entries — if empty, the entire grid will be blank regardless.

**Files:**
- `infrastructure/seeds/seed_advisory_sources.sql` — verify/fix website_url values
- `app/api/advisory/consensus/route.ts` — fix symbol case matching
- `app/(protected)/recommendations/page.tsx` — add empty-state UI for advisor chips

**Verification:**
- Run "Scan Advisors" from recommendations page → check advisory_recommendations table → reload page → chips should appear
- Check Network tab: `GET /api/advisory/consensus` response → `sourceBreakdown` object should have entries

---

## Phase 2 — Scoring Weight Customization (Task 4) — *depends on Phase 1 completion for advisory fix*

### Task 4: User-Tweakable Scoring Weights

**Current Hardcoded Weights in `lib/quant/scoring.ts`:**
- Momentum: 0–30 (30% of total)
- Valuation: 0–25 (25% of total)
- Position: 0–20 (20% of total)
- Advisory: 0–25 (25% of total)

**Design:** Users can adjust the 4-component maximum weights (must sum to 100). Defaults stay as current. Weights stored in `user_settings.preferences` JSONB.

**Steps:**

1. **Define default weights constant** — Create `lib/quant/scoring-defaults.ts`:
   ```typescript
   export const DEFAULT_WEIGHTS = {
     momentum: 30,
     valuation: 25,
     position: 20,
     advisory: 25,
   }
   export type ScoringWeights = typeof DEFAULT_WEIGHTS
   ```

2. **Modify scoring engine** — Update `lib/quant/scoring.ts`:
   - `scoreHoldings(holdings, weights?)` — accept optional `ScoringWeights` second parameter
   - Each component score is computed as before (0–max), but max is now `weights.momentum` instead of hardcoded 30, etc.
   - Normalize sub-component thresholds proportionally: e.g., if momentum weight is 40 instead of 30, the neutral base becomes `40/30 * 15 = 20` and all breakpoints scale by `40/30`.
   - Final score stays 0–100 (since weights sum to 100).

3. **Update API route** — `app/api/analysis/score/route.ts`:
   - Read `scoring_weights` from user's `user_settings.preferences`
   - Pass to `scoreHoldings(inputs, weights)`
   - Fallback to `DEFAULT_WEIGHTS` if not set

4. **Update settings API** — `app/api/settings/route.ts`:
   - Add `scoring_weights` to allowed fields whitelist
   - Validate: all 4 values are positive numbers, sum to 100, each ≥ 5 (prevent zeroing out a component)

5. **Add Settings UI section** — `app/(protected)/settings/page.tsx`:
   - New "Scoring Configuration" card between AI Access and Notifications
   - 4 slider controls (range 5–60), labeled: Momentum, Valuation, Position Size, Advisory
   - Real-time "Total" display that must equal 100
   - Visual warning (red text) when total ≠ 100
   - "Reset to Defaults" button
   - Save button calls `POST /api/settings` with `scoring_weights` object
   - Info text: "Adjust how much each factor contributes to your composite score. Must total 100."

6. **Display weights on recommendations page** — Add small weight indicators next to each score component bar showing the user's current max.

**Files:**
- `lib/quant/scoring-defaults.ts` — new file, default weights + type
- `lib/quant/scoring.ts` — accept weights param, scale components proportionally
- `app/api/analysis/score/route.ts` — read user weights, pass to scoring engine
- `app/api/settings/route.ts` — add `scoring_weights` to allowed fields + validation
- `app/(protected)/settings/page.tsx` — new "Scoring Configuration" card with sliders
- `app/(protected)/recommendations/page.tsx` — display user's weight config in score breakdown

**Verification:**
- Set weights (e.g., Momentum 40, Valuation 20, Position 20, Advisory 20) → Save → Visit recommendations → scores should shift toward momentum-heavy
- Reset to defaults → scores should match previous behavior
- Try setting total to 90 → should show validation error, prevent save

---

## Phase 3 — User Investment Strategy Profile (Task 5) — *depends on Phase 2 for settings infrastructure*

### Task 5: Investment Strategy & Diversification Calculator

**Design:** A new section in Settings (or a dedicated Strategy tab) where users define:
- Investment philosophy in free text
- Target diversification across sectors AND market cap
- Visualize current vs target allocation with a diversification health score

**Steps:**

1. **Create Strategy Profile schema** — Store in `user_settings.preferences.strategy_profile` JSONB:
   ```json
   {
     "philosophy": "Long-term growth focused, value investing...",
     "risk_appetite": "moderate",
     "investment_horizon": "3-5 years",
     "sector_targets": {
       "IT": 20, "Banking": 15, "Pharma": 10, "Auto": 10, "FMCG": 10,
       "Energy": 10, "Metals": 5, "Infra": 5, "Others": 15
     },
     "mcap_targets": {
       "Large Cap": 60, "Mid Cap": 25, "Small Cap": 15
     }
   }
   ```

2. **Create Diversification Calculator component** — `app/(protected)/settings/strategy-section.tsx`:
   - **Investment Philosophy** — Text area (max 500 chars) for user's investment approach
   - **Risk Appetite** — 3-option selector: Conservative / Moderate / Aggressive (with descriptions)
   - **Investment Horizon** — Dropdown: < 1 year, 1-3 years, 3-5 years, 5-10 years, 10+ years
   - **Sector Allocation** — Interactive sliders for each sector:
     - Pre-populated list: IT, Banking & Finance, Pharma & Healthcare, Auto, FMCG, Energy & Oil, Metals & Mining, Infrastructure, Chemicals, Real Estate, Telecom, Others
     - Each slider 0–50%, total must equal 100%
     - Color-coded bars showing current portfolio allocation (from holdings segments) vs target
     - **Diversification Score** (0-100): HHI-based (Herfindahl-Hirschman Index) — lower concentration = higher score
     - Formula: `diversification_score = 100 - (HHI / 100)` where `HHI = Σ(weight_i²)` for weights in percentages
   - **Market Cap Allocation** — 3 sliders: Large Cap, Mid Cap, Small Cap (must sum to 100%)
     - Side-by-side comparison: Current (computed from holdings) vs Target
   - **Diversification Health Meter** — Combined visual:
     - Gauge/arc showing 0-100 diversification score
     - Color: Red (<40), Amber (40-70), Green (>70)
     - Text explanation: "Your portfolio is {well-diversified | moderately concentrated | highly concentrated}"
   - **Rebalance Suggestions** — Auto-generated text:
     - "You're overweight in Banking (32% vs 15% target). Consider reducing by ~₹X."
     - "You're underweight in IT (5% vs 20% target). Consider adding ~₹X."
     - Non-advisory framing: "Based on YOUR defined targets" (not our recommendation)

3. **Add API support**:
   - `app/api/settings/route.ts` — add `strategy_profile` to allowed fields, validate JSON structure
   - `app/api/analytics/diversification/route.ts` — NEW endpoint:
     - Computes current sector/mcap allocation from holdings
     - Compares with user's target allocation
     - Returns diversification score + rebalance deltas

4. **Show strategy context on recommendations page** — If user has defined strategy:
   - Show small badge per holding: "Over target sector weight" or "Under target"
   - This helps contextualize BUY/SELL signals (buying overweight sectors is less desirable)

5. **Settings page integration** — New "Investment Strategy" section in settings page with all the components above.

**SEBI Compliance:**
- All rebalance suggestions explicitly framed as "Based on YOUR defined targets"
- No absolute buy/sell recommendations
- Disclaimer: "This tool calculates diversification based on your own target allocation. It is not investment advice."
- Never suggest specific stocks to buy — only show which sectors/caps to adjust

**Files:**
- `app/(protected)/settings/strategy-section.tsx` — new component (diversification calculator + strategy profile)
- `app/(protected)/settings/page.tsx` — import and render strategy section
- `app/api/settings/route.ts` — add `strategy_profile` to allowed fields
- `app/api/analytics/diversification/route.ts` — new endpoint for diversification computation
- `app/(protected)/recommendations/page.tsx` — add strategy context badges

**Verification:**
- Set sector targets → view diversification score → should reflect HHI calculation
- Compare current allocation bar chart vs target → overweight/underweight sections highlighted
- Change targets → observe score change dynamically
- Save → reload → values persist

---

## Phase 4 — Branded Loader (Task 6)

### Task 6: Branded Loader with Logo & Mascot

**Design:** Two-tier loader system:
- **Full-screen splash** — Initial app load (before React hydrates)
- **In-app transition** — Between page navigations within the protected area

**Steps:**

1. **Create loader component** — `components/brand-loader.tsx`:
   - CSS-only animation (no JS dependency, works before React hydrates)
   - Dark background (#080c18) matching app theme
   - Center: `investbuddy_favicon_transparent.svg` (ring + chart icon) with pulse + rotate animation
   - Below icon: "InvestBuddy AI" text with gradient shimmer animation (reuse existing `holo-text` class)
   - Below text: animated progress dots "● ● ●" or a thin gradient bar animating left→right
   - Mascot peek: Small mascot head from `investbuddy_mascot_logo.svg` peeking from bottom-right corner with a bounce-in animation (delayed 0.5s)

2. **Add full-screen splash to root layout** — `app/layout.tsx`:
   - Inline `<style>` + `<div>` in the `<body>` BEFORE the React root — this renders instantly before JS loads
   - The React app hides it on mount via a `useEffect` that adds `display:none` class
   - Uses CSS `@keyframes` for animations (no JS needed for the splash itself)

3. **Integrate in-app loader** — `app/(protected)/layout.tsx`:
   - Use the `page-transition.tsx` component (already exists) but replace its content with the branded mini-loader
   - Small version: just the favicon icon spinning with "Loading..." text
   - Triggered by Next.js route transitions

4. **Add CSS animations** to `app/globals.css`:
   ```css
   @keyframes brand-pulse { 0%,100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.08); opacity: 1; } }
   @keyframes brand-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
   @keyframes brand-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
   @keyframes mascot-peek { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
   ```

**Files:**
- `components/brand-loader.tsx` — new branded loader component (in-app version)
- `app/layout.tsx` — add inline splash screen HTML/CSS
- `app/(protected)/layout.tsx` — use branded loader for page transitions
- `app/globals.css` — add loader animation keyframes

**Verification:**
- Hard refresh the app → should see branded splash with logo animation before React loads
- Navigate between pages in the protected area → should see mini branded loader
- Test on mobile → loader should be centered and responsive

---

## Relevant Files (All Phases)

### Phase 1 — Bug Fixes
- `app/api/cron/digest/route.ts` — fix audit insert (line ~210, `report_type`/`data` → `instrument_key`/`report`)
- `app/api/notifications/digest/route.ts` — same fix (line ~365)
- `netlify.toml` — add `NEXT_PUBLIC_APP_URL`
- `lib/upstox-token.ts` — add expired-token fallback to env var
- `app/api/portfolio/refresh-prices/route.ts` — retry with server token on 401
- `app/api/cron/sync-all/route.ts` — include import-only users in LTP refresh
- `infrastructure/seeds/seed_advisory_sources.sql` — verify/fix `website_url`
- `app/api/advisory/consensus/route.ts` — fix symbol case matching
- `app/(protected)/recommendations/page.tsx` — add empty-state for advisor chips

### Phase 2 — Scoring Customization
- `lib/quant/scoring-defaults.ts` — **new file**: default weights + type
- `lib/quant/scoring.ts` — accept `ScoringWeights` param, scale proportionally
- `app/api/analysis/score/route.ts` — read user weights, pass to engine
- `app/api/settings/route.ts` — add `scoring_weights` to allowed fields
- `app/(protected)/settings/page.tsx` — new scoring sliders section
- `app/(protected)/recommendations/page.tsx` — show weight config

### Phase 3 — User Investment Strategy
- `app/(protected)/settings/strategy-section.tsx` — **new file**: diversification calculator + strategy profile
- `app/(protected)/settings/page.tsx` — import strategy section
- `app/api/settings/route.ts` — add `strategy_profile` to allowed fields
- `app/api/analytics/diversification/route.ts` — **new file**: diversification computation endpoint
- `app/(protected)/recommendations/page.tsx` — strategy context badges

### Phase 4 — Branded Loader
- `components/brand-loader.tsx` — **new file**: branded loader component
- `app/layout.tsx` — inline splash screen
- `app/(protected)/layout.tsx` — in-app page transition loader
- `app/globals.css` — loader animation keyframes

---

## Decisions

- **Upstox remains Indie App** — multi-user market data served through server-level `UPSTOX_ACCESS_TOKEN` fallback (token refreshed daily via owner's OAuth session)
- **Scoring weights** stored in `user_settings.preferences.scoring_weights` JSONB — no schema migration needed
- **Strategy profile** stored in same `user_settings.preferences.strategy_profile` JSONB — no migration needed
- **Diversification calculator** uses both sector AND market-cap dimensions per user preference
- **Loader** appears both on initial load (splash) and between page transitions (mini)
- **HHI formula** for diversification: `score = 100 - (Σ(w_i²) / 100)` where w_i are percentage weights
- **Minimum weight per scoring component**: 5 (prevents zeroing out any factor)
- **No new database migration needed** — all user preferences fit in existing JSONB column

---

## Discipline Precautions & Best Practices for Coding Agent

### Stack-Specific Rules (Next.js 15 + Supabase + Netlify + Tailwind)

1. **Never import server modules in client components** — `lib/supabase/server.ts` uses `cookies()` from `next/headers`. Only import in `app/api/` routes or Server Components. Client components must use `lib/supabase/client.ts`.

2. **Always check `"use client"` directive** — Any component using `useState`, `useEffect`, `onClick`, or browser APIs MUST have `"use client"` at the top. Settings page, recommendations page, and all new interactive components need this.

3. **Use `createAdminClient()` for service-role operations only** — Never expose service role key to client. Used in: cron routes, OAuth callback, token resolution. Regular user queries use `createClient()` (cookie-based session with RLS).

4. **Supabase RLS awareness** — All tables have Row-Level Security. User queries only return their own data. When writing endpoints that fetch cross-user data (like cron jobs), MUST use admin client.

5. **Netlify function constraints** — Scheduled functions (`netlify/functions/*.mts`) run in a separate runtime from Next.js. They can't import Next.js modules. They communicate with the app via HTTP (fetch to `/api/` routes).

6. **Tailwind class order** — Follow project convention: layout → spacing → sizing → colors → effects → state. Use `cn()` utility from `lib/utils.ts` for conditional classes.

7. **No `<img>` in client components without eslint-disable** — Use `next/image` or add `{/* eslint-disable-next-line @next/next/no-img-element */}` comment. Rule is set to warn-only in eslint config.

8. **React 19 strict mode** — `setState` inside `useEffect` body triggers warnings (already set to warn). Use async patterns: fetch in effect → setState in `.then()` callback, not synchronously.

9. **SEBI compliance** — Never phrase outputs as "investment advice". Use: "based on your configuration", "algorithmic calculation", "your defined targets". Include disclaimers on any scoring or strategy output.

10. **Type safety** — Use `interface` for API response shapes. Cast Supabase `.select()` results through `as unknown as Type` for foreign-key joins (Supabase types infer arrays for joins).

11. **Error boundaries** — All new API routes must return structured JSON errors with appropriate HTTP status codes. Never expose stack traces or internal details.

12. **Scoring engine purity** — `scoreHoldings()` must remain a pure function (no side effects, no DB calls). All data fetching happens in the API route, passed in as parameters.

13. **CSS animations** — Use CSS `@keyframes` in `globals.css` layer for loader animations. Avoid JS-based animations for the splash screen (must render before React hydrates).

14. **JSONB preferences** — When updating preferences, always MERGE with existing values (read → spread → write). Never overwrite the entire preferences object. The settings API already does this correctly.

15. **Rate limiting** — Follow existing patterns: advisory triggers are capped at 4/day, analysis reports at 1/hour. New endpoints should consider similar rate limits.

16. **Environment variable access** — Client-safe vars: `NEXT_PUBLIC_*`. Server-only: everything else. Never log full secret values — use `secret.slice(0,3)...slice(-3)` pattern for diagnostics.
