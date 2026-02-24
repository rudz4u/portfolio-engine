# Sprint Board — Sprint Run (Markdown Kanban)

Sprint length: 2 weeks
Sprint start: 2026-02-24

Columns:

## Backlog
- Finalize Requirements
- Draft Architecture
- Design DB Schema
- LLM Routing Layer

## Sprint 3 — To Do

## In Progress

## Blocked
- Upstox Sandbox credentials (awaiting user test keys)

## Done
- Project documentation files added to `Docs/`
- Init Next.js Repo (Scaffold frontend with TypeScript + Tailwind)
- Setup Supabase Project (Auth, DB skeleton)
- Create secure `user_settings` storage and RLS policy
- Implement Upstox OAuth skeleton (no execution)
- Add Quant Engine test harness (Jest)
- E2E Testing & Frontend Fixes (Auth bypass, Mobile Layouts, Loaders)
- Implement Upstox Holdings Sync (Mock Data Service)
- Build remaining Quant Engine Indicators (SMA, EMA, MACD, Bollinger Bands)
- Implement Composite Scoring & VIX Discount Logic
- Build LLM Routing Layer & Chat Assistant API
- Create Settings UI for managing API Keys
- Build Mock Order Execution Endpoint (Upstox)
- Build Chat Assistant UI Panel
- Implement Recommendations View based on Composite Score
- Setup Supabase Edge Function skeleton & Cron job

Sprint Goals & Acceptance:
- End of sprint: working frontend scaffold, Supabase project linked locally, basic Upstox OAuth flow returns mock token, Quant Engine unit tests pass for one indicator (RSI).

How to use this board:
- Move items from `To Do` → `In Progress` → `Done` by editing this file during the sprint or using your team's project tracker.
