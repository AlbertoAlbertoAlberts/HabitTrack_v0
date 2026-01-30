# Supabase migration plan (localStorage → Supabase)

Goal: move HabitTrack persistence from browser-only `localStorage` to Supabase **without losing any current content (including dummy data)** and **without duplicating anything**.

This plan is intentionally phased so you can get a safe “works on Supabase” baseline first, then improve towards multi-device sync and better conflict handling.

---

## Quick questions to confirm (affects security + UX)

1) **Do you want user accounts (recommended)?**
   - Recommended: Supabase Auth (email magic link or email+password). Data is stored per-user with Row Level Security.
   - If “no auth”: the only truly simple alternative is a public table (not recommended) or building your own auth layer.

2) **Single-user or multi-user?**
   - Single-user still benefits from Auth for multi-device.

3) **Conflict policy if two devices edit at the same time** (later phase):
   - Simplest: “last write wins”.
   - Better: merge by entity (requires normalized tables or event log).

I’ll assume **Auth is enabled** and data is **per-user**.

---

## Phase 0 — Safety / backup (do this first)

**Outcome:** you can always restore your current data if something goes wrong.

1) Make a local backup JSON.
   - Open the app in the browser.
   - Open DevTools → Console.
   - Run:
     - `localStorage.getItem('habitTracker.appState')`
   - Copy the entire JSON string into a file, e.g. `habittrack_backup_2026-01-30.json`.

2) (Optional but recommended) Validate it’s valid JSON.
   - Paste into any JSON validator or run `JSON.parse(...)` in console.

3) Confirm you can restore locally.
   - Keep that backup file somewhere safe.

---

## Phase 1 — Supabase website setup (you do this in Supabase UI)

### 1.1 Get your project connection details

In Supabase Dashboard:
- Settings → API
  - Copy **Project URL**
  - Copy **anon public** key

You will later set these as Vite env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 1.2 Configure Auth (recommended default)

In Supabase Dashboard:
- Authentication → Providers
  - Enable **Email** provider
  - Choose one:
    - Magic link (simplest UX)
    - Email + password (also fine)

- Authentication → URL Configuration
  - Add redirect URLs for dev + prod.
  - For local dev add:
    - `http://localhost:5173`
    - `http://localhost:5173/*`
  - If you deploy later (Vercel), add your deployed domain too.

### 1.3 Create the database table (minimal “lift-and-shift” schema)

**Why this approach:**
- Your app already has a well-defined root state object (see `habitTracker.appState`).
- Storing that state as JSONB gets you a safe migration quickly with **no duplication risk**.

In Supabase Dashboard:
- SQL Editor → New query
- Run this SQL:

```sql
create table if not exists public.app_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version int not null,
  state jsonb not null,
  saved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_states_updated_at on public.app_states;
create trigger trg_app_states_updated_at
before update on public.app_states
for each row
execute function public.set_updated_at();

alter table public.app_states enable row level security;

-- Only the logged-in user can read/write their own state
drop policy if exists "app_states_select_own" on public.app_states;
drop policy if exists "app_states_insert_own" on public.app_states;
drop policy if exists "app_states_update_own" on public.app_states;

create policy "app_states_select_own" on public.app_states
for select
using (auth.uid() = user_id);

create policy "app_states_insert_own" on public.app_states
for insert
with check (auth.uid() = user_id);

create policy "app_states_update_own" on public.app_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 1.4 Validate table + policies

In Supabase:
- Table Editor → `app_states` should exist.
- RLS should be enabled.
- Policies should be listed.

---

## Phase 2 — Codebase integration (I do this in the repo)

**Outcome:** app can sign in to Supabase and load/save state from `app_states`.

### 2.1 Add Supabase client dependency

- Add `@supabase/supabase-js` to `app/package.json`.

### 2.2 Add environment variables

- Create `app/.env.local` (not committed) with:
  - `VITE_SUPABASE_URL=...`
  - `VITE_SUPABASE_ANON_KEY=...`

### 2.3 Implement a persistence adapter

Current persistence is `localStorage` via `loadState()` / `saveState()` in `app/src/persistence/storageService.ts`.

Plan:
- Add a Supabase-backed storage module, e.g.:
  - `app/src/persistence/supabaseStorage.ts`
- Keep `storageService.ts` as the “local” implementation.
- Add a tiny abstraction so the app can switch between:
  - Local only
  - Supabase (with local cache)

### 2.4 Auth UX

Minimal UX to start:
- If not logged in, show a small panel/button: “Sign in to sync”.
- After login, persistence switches to Supabase.

Later enhancements:
- Add sign-out
- Show current user email

### 2.5 Save strategy (important)

Because you currently update state frequently (habit toggles, todos, lab logs):
- Save locally immediately (fast UI).
- Sync to Supabase with a debounce (e.g. 500–1500ms) and “dirty flag”.

### 2.6 Load strategy

On startup:
1) Load local state (current behavior).
2) If user is logged in:
   - Fetch `app_states` row.
   - If it exists → use it as source of truth.
   - If it does not exist → run migration upload (Phase 3).

---

## Phase 3 — Migration (no loss, no duplicates)

**Outcome:** existing local content (including dummy data) is copied once into Supabase safely.

### 3.1 Idempotent migration rule

We must guarantee migration is safe to run multiple times.

For the JSONB approach, idempotency is straightforward:
- Use `upsert` on `user_id`.
- That ensures there is only ever one row per user.

### 3.2 One-time migration trigger

When the user logs in and `app_states` row doesn’t exist:
1) Read local `AppStateV1` from localStorage.
2) Run the existing repair pass (the app already repairs on load).
3) `upsert` into `public.app_states`:
   - `user_id = auth.uid()`
   - `schema_version = 1`
   - `state = <full AppStateV1 JSON>`
   - `saved_at = state.savedAt`

### 3.3 What if both exist (remote + local)

If user has data in both places:
- Default safe behavior: **don’t auto-merge**.
- Show a one-time choice:
  - “Use Supabase data”
  - “Overwrite Supabase with this device’s local data”

(We can add a merge later, but it’s easy to get wrong.)

---

## Phase 4 — Verification checklist

**Outcome:** confident cutover without surprises.

1) Fresh login migration test
- Clear Supabase table (optional) or use a new test user.
- Ensure first login creates `app_states` row.

2) No duplication test
- Login twice, refresh, ensure still only 1 row per user.

3) Data parity test
- Compare local backup JSON vs Supabase `state` JSON for:
  - categories/habits
  - dailyScores/dayLocks
  - weekly tasks/progress/completion days
  - todos + archive
  - LAB projects/tags/logs

4) Multi-device test
- Login on a second browser/device.
- Confirm the same state loads.

---

## Phase 5 (optional) — Upgrade path (normalized tables + better syncing)

Only do this after Phase 1–4 is stable.

Reasons to normalize:
- Avoid “whole document overwrite” conflicts.
- Query history / analytics directly in SQL.
- Merge changes per entity (less data loss risk).

Possible normalized schema direction:
- `categories`, `habits`, `daily_scores`, `day_locks`, `weekly_tasks`, `weekly_completion_days`, `todos`, `todo_archive`
- LAB:
  - `lab_projects`, `lab_tags`, `lab_daily_logs`, `lab_event_logs`, `lab_absence_markers`

In normalized mode, “no duplicates” is enforced via primary keys (existing IDs) + `upsert`.

---

## What I need from you (when you’re ready)

1) Confirm: **Are you OK adding Supabase Auth (login) to keep data private?**
2) Provide (or paste) your:
   - Supabase Project URL
   - Supabase anon key
3) Tell me the intended deployment URL (if any) so redirects are correct.
