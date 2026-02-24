# Environment & Secrets

Store runtime secrets locally in a `.env.local` file at the repository root. Do NOT commit this file to source control.

Steps:

1. Copy the example file:

   cp .env.local.example .env.local

2. Edit `.env.local` and fill in real secret values for the Supabase keys, Upstox app credentials, LLM API keys, and any email/service keys.

3. In Next.js, access client-side-safe values as `process.env.NEXT_PUBLIC_*` and server-only values (service role keys, secrets) as `process.env.*` on the server/Edge functions.

Security guidance:

- NEVER commit `.env.local` or paste secrets into the codebase.
- Use Supabase service role key only on trusted server-side code (Edge functions, backend). Do NOT expose it to the client.
- Rotate keys regularly and use provider-managed key scoping when possible.

Applying migrations / running locally:

- When running migrations locally or from CI, provide the full Postgres connection URL via an environment variable, for example:

  SUPABASE_DB_URL=postgres://user:password@db.host:5432/postgres

  Then run with:

  psql "$SUPABASE_DB_URL" -f infrastructure/migrations/001_create_indicators_and_composite_scores.sql

CI / Deployment:

- For Netlify/Vercel, add the same environment variables through their dashboard (do not add `.env.local` to the repo).
- For Supabase Edge Functions, configure secrets via the Supabase project settings or use the `supabase secrets` mechanisms.
