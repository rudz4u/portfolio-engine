# Implementation Plan (Condensed)

Phases:

Phase 1 — Planning & Architecture
- Finalize requirements and confirm manual-execution policy.
- Design DB schema and component interfaces.

Phase 2 — Project Setup & Foundation
- Scaffold Next.js + TypeScript + Tailwind + Shadcn UI.
- Configure Supabase (Auth, Postgres, Edge functions).
- Implement secure user settings for API keys.

Phase 3 — Core Integrations
- Upstox OAuth flow, holdings sync, order execution (manual confirmation enforced).
- Implement Quant Engine (indicators, composite scoring, VIX discount logic).

Phase 4 — Multi-Agent AI System
- Build LLM routing, Research and Analysis agents, and conversational Execution Assistant.

Phase 5 — Frontend Dashboard
- Settings, Portfolio, Recommendations, Chat Assistant views.

Phase 6 — Testing & Deployment
- Unit tests for Quant Engine (Jest), integration tests for Upstox (mocked), LLM prompt testing.
- Deploy Supabase edge functions, schedule daily cron at 9:30 AM IST.

Acceptance Criteria for MVP:
- Users can connect Upstox and fetch holdings.
- Quant Engine computes indicators and composite scores matching the current Google Sheets outputs.
- Chat Assistant can present recommendations and require manual confirmation before order execution.
