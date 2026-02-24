# Portfolio Engine — Web (Next.js)

Local dev (from `apps/web`):

```bash
# from workspace root
cd apps/web
npm install
npm run dev
```

Environment:
- Create `.env.local` at repo root with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already present in repo root `.env.local`).

Pages:
- `/signin` — email/password sign-in (Supabase)
- `/dashboard` — protected view that fetches `holdings` (RLS enforced)
