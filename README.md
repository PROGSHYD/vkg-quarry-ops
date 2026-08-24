# VKG Quarry Ops — Stage 1 (Schema + Setup, live on Supabase)

This is the first real, backed-by-a-database stage of the app — replacing the standalone HTML
demo. It covers the database schema and the Setup screen (Pit Master + Mass Master), wired to
real Supabase Auth and Row Level Security, same pattern as VKG Production MIS / Gobyk Daily Ops.

## What's in this stage
- `supabase/schema.sql` — tables (pits, masses, slices, daily_activities, profiles), RLS
  policies matching your role rules, and a server-side trigger that auto-creates/prunes `slices`
  rows whenever a mass's target changes (the live equivalent of `ensureSlices()` in the demo).
- `app/login` — email/password sign-in via Supabase Auth.
- `app/setup` — Pit Master + Mass Master, editable only by Management; Admin sees everything
  read-only; Pit Manager sees only their own pit, read-only.

## Not built yet (next stages)
Daily Entry (sequential slice engine), DAR, Dashboard, Reports, exports (Image/PDF/Excel),
WhatsApp — these come in the following stages once this foundation is confirmed working.

## Manager assignment is flexible, not fixed

Managers aren't locked to one pit. Management can assign anyone to any pit(s) at any time from
Setup → Manager Assignments — a simple checkbox grid. Whatever's checked right now governs that
manager's Daily Entry access and pit-wise targets, until Management changes it again. No history,
no monthly lock-in — current Setup state is the source of truth.

If you already ran the original `schema.sql` and have live data (pits, profiles, logins), **don't
re-run schema.sql** — instead run `supabase/migration-flexible-pit-managers.sql`, which adds this
on top of what you already have without touching your existing logins.

## Setup steps

1. **Create a new Supabase project** under `Progs.ceo@gmail.com`.
2. In the Supabase SQL Editor, run `supabase/schema.sql`. This creates all tables, RLS, and the
   slice-sync trigger, and seeds the 6 pits with placeholder manager names/emails — edit those
   emails in the SQL before running if you want the real ones from day one.
3. **Create logins**: in Supabase Auth → Users, add one user per pit manager (email = the
   `manager_email` from the `pits` table, e.g. `b.manager@vkg.in`), plus one for yourself and one
   for Admin. For each user, add a matching row in the `profiles` table:
   ```sql
   insert into profiles (id, full_name, role, pit_id) values
     ('<user-uuid-from-auth>', 'RN', 'pit_manager', 'B');
   ```
   Use `role = 'management'` or `'admin'` (with `pit_id = null`) for the owner/admin accounts.
4. Copy `.env.local.example` to `.env.local` and fill in your Supabase project URL + anon key
   (Supabase dashboard → Settings → API).
5. **Push to GitHub**: create a new repo (suggest `mvrsdhar/vkg-quarry-ops`, matching your other
   VKG repos), then:
   ```
   git init && git add . && git commit -m "Stage 1: schema + Setup"
   git remote add origin https://github.com/mvrsdhar/vkg-quarry-ops.git
   git push -u origin main
   ```
6. **Deploy on Cloudflare Pages** (same platform as your Western Square site and
   `vkgquarry.pages.dev`):
   - Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
   - Framework preset: **Next.js**.
   - Build command: `npx @cloudflare/next-on-pages@1`
   - Build output directory: `.vercel/output/static`
   - Add the two env vars from step 4 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
     under Settings → Environment variables, for both Production and Preview.
   - Deploy. You'll get a `*.pages.dev` URL; add a custom domain later if you want one.
   - Note: this stack uses `@cloudflare/next-on-pages`, which requires every route to run on
     Cloudflare's edge runtime — the page files already have `export const runtime = 'edge'` set
     for you, so no extra changes needed as you add more pages, just remember to add that line
     to any new `page.js` you create.
7. Test: sign in as a Pit Manager login and confirm Setup is read-only and shows only their pit;
   sign in as Management and confirm you can edit targets and see `slices` rows appear/adjust
   automatically in Supabase's Table Editor when you change a target.

Once you've confirmed this stage works end-to-end, tell me and I'll build Stage 2 (Daily Entry
with the sequential slice engine) directly on top of this same schema.
