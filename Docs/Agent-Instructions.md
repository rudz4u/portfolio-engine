# Agent Instruction Sets — Developer Role Agents

Purpose
- Provide clear, repeatable instructions for developer-role agents (MCP-based) to deep-dive the Upstox OpenAPI, parse the project's existing XLSX strategy, and produce a finalized DB schema and mapping before implementation.

Agent Types
- API Analyst Agent — focuses on reading API docs, extracting endpoints, request/response shapes and rate limits.
- Data Mapper Agent — parses XLSX, compares existing spreadsheet formulas and fields, and maps them to database tables/columns.
- Integration Tester Agent — uses Playwright + Chrome DevTools to exercise sandbox endpoints and capture representative responses for mocks.
- Quant Validation Agent — reimplements sheet calculations (RSI, SMA, EMA, MACD, ATR, Beta, composite score) in TypeScript and verifies with unit tests (Jest).

Required Tools & MCPs
- Memory: persist extracted endpoint models, sample payloads, and mapping decisions across runs.
- Sequential Thinking (use `mcp_sequentialthi_sequentialthinking`): for multi-step reasoning (e.g., reconciling composite score math from sheets to code).
- Playwright + Chrome DevTools: interact with Upstox sandbox web flows, capture network traces, and inspect live websockets/requests.
- fetch_webpage / read_file: to obtain docs, attachments, and local files.
- apply_patch: to persist schema suggestions and code scaffolding in the repo.
- run_in_terminal: to run tests, linters, and quick scripts.
- activate_memory_management_tools: store facts (e.g., OAuth URL, token fields) for future agents.

High-Level Workflow (ordered)
1. Read Upstox OpenAPI docs (authentication, endpoints, rate limits, sandbox): extract OAuth flow, tokens, endpoints for `instruments`, `orders`, `holdings/portfolio`, `positions`, `funds`, `historical/prices`, `websocket` feed.
2. Record endpoint models in memory with sample request/response shapes and rate-limit notes.
3. Parse the attached XLSX (the quantitative Google-Sheets migration): identify column names, formulas and intermediate metrics used to compute the 12 composite metrics and VIX discount rules.
4. Cross-reference spreadsheet fields with Upstox data shapes (e.g., symbol naming, exchange codes); list mismatches and transformation rules.
5. Propose a normalized DB schema (tables + minimal column types) and a mapping document linking each spreadsheet field and API field to DB columns.
6. Create a small Jest harness that re-calculates at least one indicator (e.g., RSI) and verifies numbers against the XLSX sample values.
7. Using Playwright and Chrome DevTools, exercise the Upstox sandbox for the OAuth flow and one holdings/orders endpoint. Save representative mocked responses in `docs/mocks/upstox/`.

Detailed Extraction Checklist — Upstox docs
- Authentication:
  - OAuth endpoints, redirect URIs, token fields, refresh token behavior, token TTL.
  - Scopes required for holdings, orders, and historical data.
- Instruments & Symbols:
  - Instrument schema, exchange codes, expiry (derivatives), symbol normalization rules.
- Market Data:
  - Historical price endpoints (OHLC), available intervals, and sample payloads for a symbol.
- Portfolio & Positions:
  - Holdings/positions endpoints, response fields (avg_price, qty, realised/unrealised P/L), and required permissions.
- Orders & Execution:
  - Order placement payload, order types, validity, status lifecycle, error codes.
- Websocket / Streams:
  - How to subscribe, authentication method (token), message schemas.
- Rate Limits & Idempotency:
  - Limits per endpoint and recommended backoff/retry strategy.

XLSX Parsing Checklist
- Identify raw inputs (prices, volumes, PE, EPS) and derived columns (RSI, SMA, EMA, MACD, ATR, Beta, Volume Ratio). 
- Capture composite score formula and each weight applied.
- Identify how India VIX is used (look for references to dynamic discount logic or target price multipliers).
- Identify segment allocation logic (EV, Technology, Green Energy, Defence, PSU, Others).

DB Mapping / Schema Guidance (initial suggestions)
- `users` (uuid PK, email, name, created_at)
- `api_tokens` (id, user_id FK, provider enum (upstox), encrypted_token jsonb, refresh_token, expires_at, created_at)
- `user_settings` (id, user_id FK, encrypted_keys jsonb, preferences jsonb)
- `instruments` (symbol, exchange, instrument_token, lot_size, expiry, instrument_type)
- `market_prices` (id, instrument_id FK, date_ts, open, high, low, close, volume)
- `historical_prices` (instrument_id, date, interval, o,h,l,c,volume)
- `indicators` (instrument_id, date, rsi, sma_50, ema_12, macd, atr_14, beta)
- `composite_scores` (instrument_id, date, score, components jsonb)
- `portfolios` (id, user_id, source, fetched_at, meta jsonb)
- `holdings` (portfolio_id, instrument_id, quantity, avg_price, ltp, unrealized_pl)
- `orders` (id, user_id, external_order_id, instrument_id, side, qty, price, status, submitted_at)
- `analysis_reports` (id, user_id, instrument_id, signals jsonb, llm_summary jsonb, created_at)
- `chat_history` (id, user_id, session_id, role, message, metadata jsonb, created_at)

Security & Operational Rules
- NEVER store upstream API keys in plaintext in repo or logs. Use Supabase encrypted storage or a KMS.
- Use Row-Level Security (RLS) with `user_id` to enforce tenant isolation.
- Treat sandbox responses as untrusted: validate shapes before inserting into DB.

Sequential Thinking & Memory Usage Patterns
- For multi-step calculations (e.g., replicating composite score or Beta calculation), call `mcp_sequentialthi_sequentialthinking` with numbered thoughts. Store intermediate numeric checkpoints in memory (e.g., computed SMA, RSI) so other agents can reuse them.
- Example flow:
  1. Thought 1: Identify input series & window sizes.
  2. Thought 2: Compute SMA/EMA and verify against XLSX sample.
  3. Thought 3: Compute composite score and reconcile differences.

Playwright + Chrome DevTools Guidance
- Use Playwright to automate OAuth redirect flow in sandbox (headful when necessary). Capture the `network` tab to collect actual Authorization and Token exchange requests.
- Use Chrome DevTools Protocol to inspect websocket handshake and message frames for market data streams.
- Save captured request/response bodies as mock fixtures in `Docs/mocks/upstox/`.

Outputs & Deliverables (per run)
1. `Docs/upstox-endpoints.md` — extracted endpoints and sample payloads.
2. `Docs/mocks/upstox/` — representative JSON responses for key endpoints.
3. `Docs/db-mapping.md` — spreadsheet-field → DB column mapping with transformations.
4. `Docs/schema.sql` or migration file — the proposed schema suitable for Supabase.
5. `tests/quant/*.test.ts` — Jest test(s) validating indicator(s) against XLSX values.

Acceptance Criteria before proceeding to implementation
- All Upstox endpoints required for the MVP (holdings, positions, orders, historical prices, instruments) are mapped to DB tables and columns.
- XLSX composite score calculations are reproduced in TypeScript with test assertions matching sample XLSX values (within tolerance).
- Mocked Upstox responses are saved and validated by the Integration Tester Agent.

Notes / To Request from User
- Please attach the XLSX file containing the current quantitative strategy or confirm it's present in `Docs/attachments/`.
- Provide Upstox sandbox credentials (or a sandbox app client id/secret) if available; otherwise the Integration Tester Agent will rely on the public sandbox flows and logged sample responses.
