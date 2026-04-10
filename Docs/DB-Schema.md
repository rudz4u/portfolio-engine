# Database Schema

> Complete schema for Portfolio Engine. Managed via 12 SQL migrations in `infrastructure/migrations/`.

---

## Tables

### `auth.users` (Supabase-managed)

Supabase Auth manages user accounts. All other tables reference `auth.users(id)`.

---

### `user_settings`

User-level encrypted API keys and preferences.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | Unique per user |
| `encrypted_upstox` | jsonb | Encrypted Upstox OAuth credentials |
| `encrypted_llm_keys` | jsonb | Encrypted LLM API keys (Gemini/OpenAI/Anthropic) |
| `encrypted_tavily` | jsonb | Encrypted Tavily API key |
| `preferences` | jsonb | UI preferences, custom scoring weights, notification settings |
| `created_at` | timestamptz | |

---

### `portfolios`

User portfolios (supports multiple portfolios per user).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `source` | text | `upstox`, `manual`, `import` |
| `name` | text | Portfolio display name (migration 008) |
| `holdings` | jsonb | Raw holdings snapshot |
| `fetched_at` | timestamptz | Last sync timestamp |
| `created_at` | timestamptz | |

---

### `holdings`

Individual holdings within a portfolio.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `portfolio_id` | uuid FK → portfolios | |
| `instrument_key` | text | Upstox instrument key |
| `trading_symbol` | text | Display symbol (migration 005) |
| `company_name` | text | Company display name (migration 005) |
| `quantity` | numeric | Shares held |
| `avg_price` | numeric | Average buy price |
| `ltp` | numeric | Last traded price |
| `invested_amount` | numeric | Total invested |
| `unrealized_pl` | numeric | Unrealised P&L |
| `segment` | text | Sector/segment classification |
| `raw` | jsonb | Full Upstox response data (day_change, etc.) |

---

### `indicators`

Pre-computed technical indicators (populated by cron/analysis).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `symbol` | text | Trading symbol |
| `date` | date | |
| `rsi` | numeric | RSI(14) |
| `sma_50` | numeric | 50-day SMA |
| `ema_12` | numeric | 12-day EMA |
| `macd` | numeric | MACD value |
| `atr_14` | numeric | 14-day ATR |
| `beta` | numeric | Stock beta |
| `composite_score` | numeric | Pre-computed composite score |

---

### `analysis_reports`

Persisted scoring results per user per instrument.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `instrument_key` | text | |
| `report` | jsonb | `{score, signal, signal_reason, pnl_pct, weight_pct, momentum_score, valuation_score, position_score, advisory_score, computed_at}` |
| `created_at` | timestamptz | Rate-limited to 1 write/hour per user |

---

### `advisory_consensus`

Aggregated analyst recommendations from SEBI-registered sources (migration 010).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `trading_symbol` | text | |
| `consensus_date` | date | |
| `consensus_signal` | text | `STRONG_BUY`, `BUY`, `HOLD`, `SELL`, `STRONG_SELL` |
| `weighted_score` | numeric | Weighted consensus score |
| `advisory_score` | numeric | 0–25 score for scoring engine |
| `buy_count` | integer | |
| `sell_count` | integer | |
| `hold_count` | integer | |
| `total_sources` | integer | Number of advisory sources |
| `segment` | text | Stock sector classification |
| `sources` | jsonb | Individual source recommendations |
| `created_at` | timestamptz | |

Unique constraint: `(trading_symbol, consensus_date)`

---

### `investor_profiles`

Full investor profile for personalised scoring (migration 011).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | Unique per user |
| `investor_type` | text | `short_term_trader`, `swing_trader`, `medium_term`, `long_term`, `sector_specialist`, `value_investor`, `growth_investor`, `income_investor` |
| `investment_horizon` | jsonb | `{default_months, min_months, max_months}` |
| `risk_tolerance` | text | `very_conservative` → `very_aggressive` |
| `risk_capacity` | text | `low`, `medium`, `high` |
| `max_portfolio_drawdown_pct` | numeric | 5–50% |
| `max_single_stock_allocation_pct` | numeric | 2–25% |
| `preferred_sectors` | text[] | Sectors to overweight |
| `avoided_sectors` | text[] | Sectors to avoid |
| `investment_goals` | text[] | Multi-select goals |
| `annual_investment_budget` | text | Budget range enum |
| `experience_level` | text | `beginner` → `expert` |
| `decision_style` | text | `data_driven`, `fundamental`, `technical`, `hybrid`, `advisory_dependent` |
| `rebalance_frequency` | text | `weekly` → `manual` |
| `active_strategy_preset_id` | uuid FK → strategy_presets | Active preset (nullable) |
| `custom_overrides` | jsonb | Partial weight/threshold overrides |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### `strategy_presets`

Pre-configured scoring weight sets and signal thresholds (migration 011).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `description` | text | |
| `investor_types` | text[] | Compatible investor types |
| `scoring_weights` | jsonb | `{momentum, valuation, position, advisory}` |
| `signal_thresholds` | jsonb | `{strong_buy_min, buy_min, hold_min, sell_max, strong_sell_max}` |
| `horizon_filter_months` | integer | Applicable horizon (nullable) |
| `volatility_tolerance` | numeric | ATR multiplier |
| `is_system` | boolean | System-provided vs user-created |
| `created_at` | timestamptz | |

---

### `holding_overrides`

Per-stock strategy settings (migration 012).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `instrument_key` | text | |
| `trading_symbol` | text | |
| `goal` | text | `growth`, `income`, `swing_trade`, `short_term_trade`, `value_hold`, `sector_bet`, `speculative`, `learning` |
| `goal_notes` | text | Free-form notes |
| `target_price` | numeric | User's target sell price |
| `stop_loss_price` | numeric | Stop-loss trigger price |
| `trailing_stop_pct` | numeric | % trailing stop-loss |
| `strategy_preset_id` | uuid FK → strategy_presets | Per-stock preset override |
| `custom_signal_override` | text | `force_hold`, `force_watch`, or null |
| `max_allocation_pct` | numeric | 1–50% |
| `risk_note` | text | |
| `hold_until` | date | Don't suggest SELL before this |
| `min_hold_months` | integer | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Unique constraint: `(user_id, instrument_key)`

---

### `portfolio_snapshots`

Daily portfolio value snapshots for analytics (migration 007).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `portfolio_id` | uuid FK → portfolios | |
| `user_id` | uuid FK → auth.users | |
| `snapshot_date` | date | |
| `total_invested` | numeric | |
| `total_current_value` | numeric | |
| `total_pnl` | numeric | |
| `total_pnl_pct` | numeric | |
| `holdings_count` | integer | |
| `snapshot_data` | jsonb | Per-stock breakdown |
| `created_at` | timestamptz | |

Unique constraint: `(portfolio_id, snapshot_date)`

---

### `chat_history`

AI assistant conversation history (migration 002, fixed in 006).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `role` | text | `user`, `assistant`, `system` |
| `content` | text | Message content |
| `metadata` | jsonb | Tool calls, sources, etc. |
| `conversation_id` | text | Groups messages into conversations |
| `created_at` | timestamptz | |

---

### `orders`

Trade orders placed through the platform (migration 009).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `instrument_key` | text | |
| `trading_symbol` | text | |
| `side` | text | `BUY`, `SELL` |
| `quantity` | numeric | |
| `price` | numeric | |
| `order_type` | text | `LIMIT`, `MARKET`, etc. |
| `status` | text | `pending`, `placed`, `filled`, `cancelled`, `failed` |
| `provider` | text | `upstox` |
| `external_order_id` | text | Upstox order ID |
| `response` | jsonb | Full API response |
| `created_at` | timestamptz | |

---

### `watchlists`

User-created watchlists.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users | |
| `name` | text | |
| `instruments` | jsonb | Array of instrument objects |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## Migration History

| # | File | Description |
|---|------|-------------|
| 001 | `001_create_indicators_and_composite_scores.sql` | Technical indicators table |
| 002 | `002_create_core_tables.sql` | Core tables (users, portfolios, holdings, analysis, chat) |
| 003 | `003_enable_rls_and_policies.sql` | RLS policies for all tables |
| 004 | `004_create_user_settings.sql` | User settings with encrypted keys |
| 005 | `005_add_holdings_display_columns.sql` | Add trading_symbol, company_name to holdings |
| 006 | `006_fix_chat_history_schema.sql` | Fix chat_history column names |
| 007 | `007_portfolio_snapshots.sql` | Daily portfolio value snapshots |
| 008 | `008_portfolio_name.sql` | Add name column to portfolios |
| 009 | `009_orders_provider.sql` | Orders table with provider field |
| 010 | `010_advisory_system.sql` | Advisory consensus aggregation table |
| 011 | `011_create_investor_profiles.sql` | Investor profiles + strategy presets |
| 012 | `012_create_holding_overrides.sql` | Per-stock strategy overrides |

---

## Row-Level Security

All user-facing tables enforce:

```sql
CREATE POLICY "Users can only access own data"
  ON <table> FOR ALL
  USING (auth.uid() = user_id);
```

This ensures complete multi-tenant isolation at the database level.
