# Database Schema (Sketch)

This is an initial schema to support multi-tenant portfolios, API keys, preferences, and chat history.

Tables:

- users
  - id: uuid (PK)
  - email: text
  - full_name: text
  - created_at: timestamptz

- user_settings
  - id: uuid (PK)
  - user_id: uuid (FK -> users.id)
  - encrypted_upstox: jsonb (encrypted)
  - encrypted_llm_keys: jsonb (encrypted)
  - encrypted_tavily: jsonb (encrypted)
  - created_at: timestamptz

- user_preferences
  - id: uuid (PK)
  - user_id: uuid (FK)
  - risk_level: text (Low|Medium|High)
  - preferred_segments: text[]
  - daily_investment_target: numeric
  - created_at: timestamptz

- portfolios
  - id: uuid (PK)
  - user_id: uuid (FK)
  - source: text (upstox)
  - holdings: jsonb
  - fetched_at: timestamptz

- transactions
  - id: uuid (PK)
  - user_id: uuid (FK)
  - portfolio_id: uuid (FK)
  - instrument: text
  - side: text (BUY|SELL)
  - quantity: numeric
  - price: numeric
  - status: text
  - external_order_id: text
  - created_at: timestamptz

- indicators
  - id: uuid (PK)
  - symbol: text
  - date: date
  - rsi: numeric
  - sma_50: numeric
  - ema_12: numeric
  - macd: numeric
  - atr_14: numeric
  - beta: numeric
  - composite_score: numeric

- analysis_reports
  - id: uuid (PK)
  - user_id: uuid (FK)
  - symbol: text
  - report: jsonb (LLM output + signals)
  - created_at: timestamptz

- chat_history
  - id: uuid (PK)
  - user_id: uuid (FK)
  - role: text (user|assistant|system)
  - message: text
  - metadata: jsonb
  - created_at: timestamptz

Notes:
- Store sensitive API keys encrypted using Supabase (or KMS) and never log plaintext keys.
- Use row-level security policies to ensure multi-tenant isolation by `user_id`.
