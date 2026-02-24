# Apps Script Analysis & Upgraded AI-Powered Algorithm Design

This document analyzes the provided Google Apps Script implementation, extracts its functional components, points out limitations, and proposes an upgraded architecture and AI/tools-powered algorithm suitable for migration to a Supabase + Next.js + Edge Functions stack.

1) Summary of current Apps Script behavior
- UI helpers: `addStock`, `addInvestment` — manual portfolio row insertion and quantity updates.
- Recommendation generator: `generateInvestmentRecommendations2` — reads `Portfolio`, `Technical_Indicators`, `Settings`, `Recommendations` sheets and:
  - Reads user inputs (max investment, VIX, segment weights, composite weights, limits).
  - Filters eligible stocks by Buy/Moving flags and presence of technical indicators.
  - Normalizes metrics, computes weighted composite score across 12 metrics.
  - Applies India VIX-based dynamic discount to compute `targetBuyPrice`.
  - Allocates segment-level budgets and computes integer quantity to buy for each selected stock.
  - Outputs top recommendations to `Recommendations` sheet and emails a formatted table.
- Technical indicators module (multiple functions): batch fetches historical data using `GOOGLEFINANCE`, computes Beta, RSI (Wilder), SMA/EMA/MACD, Bollinger Bands, ATR, and writes back to sheet.

2) Key formulas and spreadsheet-derived logic (from `Docs/XLSX-Formulas.md`)
- Sheets with formulas use heavy `GOOGLEFINANCE` and derived column formulas for price, returns, volume, marketcap, PE.
- `Recommendations` sheet references India VIX via an IMPORTXML-like call.
- Normalization pattern: min-max normalization per metric with inversion for metrics where lower is better (PE, CMP, RSI, ATR).
- Composite score: weighted linear sum of normalized components.

3) Limitations & Risks in current Apps Script
- Scalability: `GOOGLEFINANCE` and sheet formulas are brittle and slow for many symbols; Apps Script execution limits require batch triggers and sleeps.
- Data quality: `GOOGLEFINANCE` may miss corporate actions, delisted instruments, and has rate/availability issues.
- Reproducibility: spreadsheet formulas and ad-hoc helper columns make unit testing and CI difficult.
- Security & Access: storing keys or sender email in script is not production-grade; Upstox integration missing.
- Automation safety: script triggers place no live trades (good), but any future execution agent must confirm trades explicitly.

4) Goals for upgraded AI + Tools powered algorithm
- Deterministic, testable technical indicator library with unit tests reproducing sheet outputs (TypeScript + Jest).
- Replace in-sheet `GOOGLEFINANCE` with scheduled historical price pulls via reliable market data (Upstox historical endpoints or commercial market-data API) into `historical_prices` table.
- Move computation into server-side Edge Functions (Supabase) running in controlled runtime; persist indicators to `indicators` table with provenance metadata.
- Implement a Multi-Agent AI pipeline: Research Agent (news), Analysis Agent (synthesizer), Execution/Assistant Agent (conversation + manual confirmation).
- Maintain human-in-the-loop: manual confirmation required before any order execution.

5) Upgraded System Components & Flow
- Data layer (Supabase Postgres):
  - `instruments`, `historical_prices`, `indicators`, `composite_scores`, `portfolios`, `holdings`, `orders`, `users`, `user_settings`.
  - CRON/Edge function: daily at 09:30 IST, fetch price data, refresh `instruments`, compute indicators and composite scores.
- Quant Engine (TypeScript Edge Function):
  - Inputs: list of tickers + historical OHLCV + NIFTY 50 series for Beta.
  - Outputs: `indicators` rows (RSI, SMA_50, EMA_12, MACD, ATR_14, Beta) and `composite_scores` entries.
  - Implementation: use `technicalindicators` npm or custom, include precise normalization and inversion logic to match spreadsheet.
  - Tests: Jest tests that validate outputs against sample XLSX values (tolerance configurable).
- AI Agents:
  - Research Agent (Tavily / Bing / Google programmable search): fetch news, corp filings, target-level sentiment; produce structured notes.
  - Analysis Agent (LLM like OpenAI/Claude/Gemini): takes `composite_scores` + `indicators` + `research` and outputs classification (Buy/Hold/Sell), rationale, confidence score, and suggested position size.
  - Execution Assistant (Chat UI): prompts user each morning (or on-demand) with recommended buys, asks for investable amount, confirms each order, and transmits order to Upstox only after explicit user confirmation.
- Integration Layer (Edge + Webhooks):
  - Upstox OAuth 2.0 (Authorization Code Flow) stored in `api_tokens` (encrypted).
  - Upstox fetchers: holdings, positions, funds.
  - Order execution: create an order object in DB, then call Upstox Place Order API on confirmation; store external_order_id and monitor status with webhooks or polling.

6) Upgraded Algorithm Details (stepwise)
Step A — Data collection & normalization
  - Fetch last N days OHLCV for each symbol and NIFTY 50.
  - Compute required indicators server-side using deterministic functions.
  - Normalize each metric across the candidate universe (min-max) and apply inversion where necessary.

Step B — Composite scoring
  - Allow dynamic weight overrides per user (persisted in `user_preferences`).
  - Use robust scaling (optionally z-score + min-max fallback) configurable per metric.
  - Add confidence weighting to metrics with low data quality.

Step C — VIX-based discount and position sizing
  - Replace linear VIX mapping with configurable piecewise mapping or small LLM-suggested multiplier (LLM can recommend a multiplier range based on macro-news sentiment).
  - Use integer position sizing with min ticket size logic and OR use rounding via lot size from `instruments` table.

Step D — AI analysis overlay
  - Construct a prompt template that provides: symbol, top quantitative signals (top 5 contributing metrics and values), recent news bullets, and user risk profile.
  - Ask LLM to produce: action (Buy/Hold/Sell), rationales, risk flags, and a textual summary limited to N tokens.
  - Store LLM output in `analysis_reports` with `sources` pointer (URLs) and `confidence` score from model output.

Step E — Conversation & Execution
  - Chat Assistant composes a short list (top K) and asks the user for investable amount.
  - Assistant displays suggested orders with `targetBuyPrice` and `quantity` and a checkbox-confirm per order.
  - On user confirm, create `orders` row with `status=queued` and call Upstox Place Order through a secure server process; update status according to response.

7) AI / Tools Integration Patterns
- Use agent orchestration (LangChain-style) or a lightweight router: the Analysis Agent uses provenance by including `sources` and `tool outputs` in LLM context.
- Use sequential thinking (MCP sequential thinking tool) to break down computational validation steps and store intermediate checkpoints in memory for audit.
- Use Playwright + Chrome DevTools for initial Upstox sandbox integration validation and to capture concrete request/response examples.

8) Mapping Spreadsheet Formulas → Functions
- The spreadsheet uses `GOOGLEFINANCE` and direct formula combinations. Map each formula to a pure function in `packages/quant-engine/src/`:
  - pricePosition(symbol) = cmp / high52
  - volumeRatio = todayVolume / dailyAvgVolume
  - rsi = computeRSI(closes, period=14)
  - sma50 = sma(closes, 50)
  - ema12 = ema(closes, 12)
  - macd = ema12 - ema26
  - atr14 = atr(highs, lows, closes, 14)
  - beta = covariance(returns(symbol), returns(nifty)) / variance(returns(nifty))

9) Testing & Verification
- Unit tests: Jest for each indicator function with sample arrays extracted from XLSX.
- Integration tests: mock Upstox endpoints (use `Docs/mocks/upstox`) to validate fetchers and order payload formation.
- LLM prompt tests: run deterministic prompts against small model with cached responses to verify expected structure.

10) Operational & Security Notes
- Encrypt Upstox client_secret, refresh tokens; store encrypted blobs in `user_settings.encrypted_upstox`.
- Implement RLS in Supabase to scope reads/writes to the owning `user_id`.
- Rate-limit calls to Upstox with per-user throttling and a shared caching layer for `instruments` JSON.

11) Deliverables to implement next (short list)
- `packages/quant-engine/` scaffold + Jest tests that reproduce RSI and SMA for one example from the XLSX.
- Supabase migration: create `indicators`, `composite_scores`, `instruments`, `historical_prices`.
- Upstox sandbox integration test using Playwright to capture OAuth token exchange and sample holdings response.
- LLM prompt templates for Analysis Agent with minimal examples.

Appendix: Quick mapping of spreadsheet columns to DB columns
- `Portfolio!C` (Symbol) → `instruments.trading_symbol` / `instruments.instrument_key`
- `Portfolio!F` (Quantity) → `holdings.quantity`
- `Portfolio!H` (Avg Buy Price) → `holdings.avg_price`
- `Technical_Indicators` columns → `indicators` table columns (beta, rsi, sma_50, ema_12, macd, atr_14)
