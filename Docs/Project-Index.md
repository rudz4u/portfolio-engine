# Project Index — Repository Map

Purpose: provide a single, concise index so developer-role agents (and humans) can quickly find docs, agent instructions, boards, mocks, and code scaffolds regardless of frontend framework or data-model decisions.

Top-level (workspace root)
- [README.md](../README.md) — repo overview and next steps.

Docs/
- [Docs/Project-Index.md](Project-Index.md) — this index.
- [Docs/README.md](README.md) — docs folder entrypoint.
- [Docs/Architecture.md](Architecture.md) — architecture overview and data flow.
- [Docs/DB-Schema.md](DB-Schema.md) — initial DB schema sketch and notes.
- [Docs/Implementation-Plan.md](Implementation-Plan.md) — phased implementation plan and acceptance criteria.
- [Docs/Sprint-Board.md](Sprint-Board.md) — sprint 1 kanban and goals.
- [Docs/Agent-Instructions.md](Agent-Instructions.md) — agent roles, MCP tools, and extraction workflow.
- Docs/mocks/ — (created by agents) store representative API responses and fixtures.

Source & Scaffold (expected locations once created)
- `apps/frontend/` — Next.js (TypeScript) frontend scaffold.
  - `apps/frontend/README.md` — how to run the frontend locally.
- `packages/quant-engine/` — TypeScript quant engine microservice (edge function) + tests.
  - `packages/quant-engine/README.md` — run tests and examples.
- `infrastructure/` — DB migrations and Supabase schema files.
  - `infrastructure/schema.sql` or `infrastructure/migrations/` — migration files for Supabase.

Key files for integrations
- `Docs/Agent-Instructions.md` — agent developer guidance and extraction checklist.
- `Docs/mocks/upstox/` — expected output from Integration Tester Agent (OAuth, holdings, orders, historical prices samples).
- `infrastructure/supabase/` — Supabase config, RLS policies, and seed data.

Where agents should write outputs
- Extraction agent:
  - `Docs/upstox-endpoints.md` — extracted endpoints + request/response shapes.
  - `Docs/mocks/upstox/*.json` — representative API responses.
- Data mapper agent:
  - `Docs/db-mapping.md` — spreadsheet column → DB column mapping.
  - `infrastructure/schema.sql` — proposed SQL migration.
- Quant validation agent:
  - `packages/quant-engine/src/` — implementation files for indicators.
  - `packages/quant-engine/tests/` — Jest tests comparing XLSX sample values.

Quick navigation for agents
- To find agent guidance: open [Docs/Agent-Instructions.md](Agent-Instructions.md).
- To start sprint work: open [Docs/Sprint-Board.md](Sprint-Board.md).
- To view proposed DB schema: open [Docs/DB-Schema.md](DB-Schema.md) and `infrastructure/schema.sql` when available.

Conventions
- Use `Docs/mocks/` for API fixtures; name files by endpoint, e.g., `oauth_token.json`, `holdings_GET_user_{id}.json`.
- Persist any decisions in `Docs/decisions.md` (create when first decision is recorded).
- Always update `Docs/Project-Index.md` when new top-level folders or key files are added.

If something is missing
- Agents should create the relevant files under `Docs/` and add links here. Keep entries minimal and linkable.
