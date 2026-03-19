# Invest Buddy AI Platform Feature Document (Updated)

Last updated: 19 March 2026
Scope: Current implementation in this repository (Next.js app, API routes, Supabase schema/migrations, Netlify jobs, legal artifacts)

## 1. Executive Summary

Invest Buddy AI is a multi-tenant portfolio intelligence platform for Indian equities. It combines:

- Portfolio ingestion and synchronization (Upstox OAuth + holdings sync)
- Quant analytics (indicators, scoring, technical analysis)
- Research and advisory aggregation
- AI assistant with strict non-advisory guardrails
- Trade workflow with explicit user-triggered order placement
- Watchlist and analytics dashboards
- Privacy controls (data export and account deletion)

The product is positioned as an analytics platform, not a SEBI-registered advisory service, and this is consistently reflected in legal pages and assistant prompt guardrails.

## 2. Current Product Surface

### 2.1 Public Experience

- Landing page and sign-in flow
- Legal module:
	- Terms of Service
	- Privacy Policy
	- Financial Disclaimer
	- Beta User Agreement

### 2.2 Authenticated Product Modules

Protected user-facing modules currently implemented:

- Dashboard: portfolio KPIs, P and L, health and allocation views
- Portfolio:
	- holdings table
	- stock detail page
	- import flow
- Analytics: timeline, treemap, sector and momentum visual analysis
- Analysis: per-stock technical analysis with charting and indicators
- Recommendations: quant- and advisory-informed signal view
- Assistant: conversational analytics assistant with persistent context
- Watchlist: multi-list management and instrument tracking
- Trade: holdings, order placement, and trade/order history views
- Settings:
	- profile and privacy preferences
	- AI model and API key settings
	- broker connection settings
	- notification settings
	- portfolio and data settings
- Sandbox: integration testing and sync workflows

## 3. API Capability Inventory

Implemented API surface is broad and grouped as follows.

### 3.1 AI and Quant

- `/api/assistant` - AI response orchestration with portfolio context and compliance prompting
- `/api/analysis/score` - holding-level composite score and signal generation
- `/api/analysis/technicals` - candle-derived technical analysis
- `/api/public/score-preview` - public score preview endpoint

### 3.2 Advisory Intelligence

- `/api/advisory/consensus` - consensus retrieval by symbol/date
- `/api/advisory/sources` - advisory source metadata access
- `/api/advisory/trigger` - advisory pipeline trigger path
- `/api/cron/advisory-scan` - scheduled advisory ingestion and consensus compute

### 3.3 Portfolio and Holdings

- `/api/portfolio/import/parse` and `/api/portfolio/import/confirm` - import pipeline
- `/api/portfolio/refresh-prices` - valuation refresh
- `/api/portfolio/snapshots` - historical snapshot series
- `/api/holdings/[id]` - holding operations

### 3.4 Instruments and Market Data

- `/api/instruments/search`, `/api/instruments/ltp`, `/api/instruments/count`, `/api/instruments/seed`
- `/api/candles/[instrumentKey]`
- `/api/upstox/historical-candle`

### 3.5 Broker Integration and Trading

- OAuth/connectivity:
	- `/api/oauth/upstox/authorize`, `/api/oauth/upstox/callback`
	- `/api/upstox/authorize`, `/api/upstox/callback`
- Upstox data:
	- `/api/upstox/profile`, `/api/upstox/holdings`, `/api/upstox/sync`
- Order and trade operations:
	- `/api/orders/execute`, `/api/orders/history`
	- `/api/trade/order-book`, `/api/trade/order-history`, `/api/trade/trade-book`, `/api/trade/historical-trades`

### 3.6 Notifications and Scheduled Operations

- `/api/notifications/digest`, `/api/notifications/send-test-digest`
- `/api/cron/sync-all`, `/api/cron/daily-sync`, `/api/cron/digest`

### 3.7 User Settings and Privacy APIs

- `/api/settings` - user preferences and provider key state
- `/api/profile` - profile and privacy preference management
- `/api/profile/export-data` - personal data export
- `/api/profile/delete-account` - account and data deletion workflow

### 3.8 Watchlist APIs

- `/api/watchlist`
- `/api/watchlists`
- `/api/watchlists/[id]/items`

## 4. Data and Schema Footprint

Migration history indicates progressive capability rollout from quant core to advisory intelligence.

### 4.1 Core Data Domains

- User/account domain: users, user_settings
- Portfolio domain: portfolios, holdings, portfolio_snapshots
- Trading domain: orders (+ provider dimension)
- Quant domain: indicators, composite_scores
- AI domain: chat history and analysis reports
- Market master domain: instruments
- Advisory domain:
	- advisory_sources
	- advisory_recommendations
	- advisory_consensus
	- advisory_track_record (from advisory system migration)

### 4.2 Data Model Characteristics

- Multi-tenant design centered on `user_id`
- Hybrid structure: normalized entities plus JSONB for flexible metadata
- Daily snapshot strategy for trend visualizations
- Advisory consensus model supports weighted scoring and source-level explainability

## 5. Integrations and Runtime Architecture

### 5.1 Application Stack

- Frontend and backend: Next.js App Router (TypeScript)
- Database/Auth: Supabase Postgres + Supabase Auth + RLS
- Hosting/compute: Netlify (SSR + scheduled functions)
- Visualization: chart-based analytics in protected pages

### 5.2 External Integrations

- Upstox (OAuth, profile, holdings, orders, history)
- LLM providers (OpenAI, Anthropic, Gemini, DeepSeek, Qwen routing support)
- Tavily-style research ingestion paths
- Brevo email for digest notifications

### 5.3 Automation and Scheduling

Netlify scheduled jobs include:

- Daily sync pipeline (weekday schedule)
- Digest dispatch after sync
- Four advisory scans per business day (morning, midday, afternoon, evening)

## 6. Security Readiness (Current State)

Security posture is strong at the foundation level and moderate at operational hardening level.

### 6.1 Controls Implemented

- Authentication and session management:
	- Supabase Auth SSR pattern with middleware session refresh
	- protected route enforcement and sign-in redirection
- Authorization:
	- RLS policies across user data tables
	- owner-scoped access policies for portfolio, holdings, settings, and snapshots
- Tenant isolation:
	- `user_id`-bound data model
	- service-role only paths for batch jobs
- API protections:
	- cron endpoints check bearer token against service role key
	- unauthorized users receive 401/403 in protected handlers
- Security headers at edge:
	- `X-Content-Type-Options: nosniff`
	- `X-Frame-Options: DENY`
	- strict referrer policy
- Data rights support:
	- export endpoint and delete-account endpoint exist

### 6.2 Security Gaps to Address

- Secrets at rest gap:
	- code currently reads provider tokens/keys from `user_settings.preferences` JSON fields directly
	- true field-level encryption at rest is not consistently enforced in application logic
- Policy quality gap:
	- one migration uses `FOR ALL` RLS policies in multiple places, which is functional but less auditable than operation-specific policies
- Abuse protection gap:
	- no explicit application-layer rate limiting, anti-automation control, or WAF policy codified in repo
- Auditability gap:
	- no dedicated immutable security audit log table/stream for privileged and sensitive operations
- Crypto hygiene visibility gap:
	- key rotation cadence and secret lifecycle controls are not documented as enforceable runtime policy

## 7. Compliance Readiness (Current State)

Compliance posture is directionally strong for beta analytics software, with clear legal framing and privacy rights APIs, but not yet enterprise-grade complete.

### 7.1 Strong Signals

- Regulatory positioning consistency:
	- legal pages clearly state the platform is not a SEBI-registered IA/RA/PMS
	- AI assistant system prompt enforces non-advisory language and mandatory disclaimer
- Trade control posture:
	- product framing and legal docs emphasize explicit user-triggered order actions (no autonomous trading intent)
- Privacy controls:
	- DPDPA-style rights are represented through data export and account deletion endpoints
	- privacy preference capture exists in profile/settings flows
- Data segregation:
	- user-scoped access policies and RLS structure align with least-privilege tenancy goals

### 7.2 Compliance Gaps to Close Before Scale

- Evidence and governance:
	- no formal policy pack in repo for incident response, data retention schedule, access reviews, vendor risk, and BCP/DR testing
- Consent and records:
	- privacy/marketing consent fields exist, but systematic consent evidence lifecycle and audit trails are not yet formalized
- Deletion workflow robustness:
	- delete endpoint references `chat_messages` while the schema history includes `chat_history`; this mismatch should be reconciled to guarantee full erasure integrity
- Data classification and minimization:
	- no codified data classification matrix and retention-by-data-type policy in docs
- Assurance readiness:
	- no control mapping artifacts for SOC 2 / ISO 27001 style audits yet

## 8. Overall Readiness Assessment

### 8.1 Feature Readiness

- Portfolio analytics platform: production-capable beta
- AI-assisted insights: functional with explicit legal guardrails
- Broker integration and order workflows: operational with user-triggered flows
- Advisory intelligence: advanced and differentiated, with weighted consensus pipeline

### 8.2 Security and Compliance Readiness Scorecard (Qualitative)

- Application security foundations: High
- Multi-tenant data isolation (RLS + auth): High
- Operational security hardening: Medium
- Privacy rights implementation: Medium-High
- Formal compliance program maturity: Medium

## 9. Recommended Next 30-60 Day Hardening Plan

1. Encrypt sensitive BYOK and broker tokens using KMS-backed envelope encryption before DB persistence.
2. Refactor RLS into explicit SELECT/INSERT/UPDATE/DELETE policies with policy test coverage.
3. Add API rate limiting and anomaly detection for auth, assistant, and trading endpoints.
4. Implement immutable security audit logs for login, token updates, order placement, and data export/deletion.
5. Reconcile erasure path table coverage and add automated deletion verification tests.
6. Publish internal compliance pack in `Docs/` for retention, incident response, access control, and vendor governance.
7. Create control mapping document for DPDPA obligations and target assurance framework (for example SOC 2 readiness mapping).

## 10. Supporting Documentation

- [Project Index](Project-Index.md)
- [Architecture](Architecture.md)
- [Database Schema](DB-Schema.md)
- [Implementation Plan](Implementation-Plan.md)
- [Sprint Board](Sprint-Board.md)
- [Environment & Secrets](ENV.md)
