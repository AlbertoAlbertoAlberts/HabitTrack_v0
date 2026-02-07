# Quick Fixes Plan

Date: 2026-02-04

This plan is focused on two urgent needs:
1) Get production back to the last known-good build (pre “Add smooth UI animations”).
2) Stabilize sync so that *pulling on one device cannot erase newer data created on another device*.

---

## Phase 0 — Stop the bleeding (deploy the known-good version)

### Goal
Ensure Vercel production is running the version you trust (the commit **“Set app title and favicon”**), before we do any deeper debugging.

### Why
Right now production can be on a bad commit and you’ll keep seeing confusing behavior while testing.

### Steps
- Identify the exact “good” commit hash (currently: `f0451b5` in your repo history).
- Roll back production via Git:
  - Preferred: **create a revert commit** of the bad change (keeps history linear):
    - `git revert <bad_commit_hash>`
    - `git push`
  - Alternative (only if needed): hard reset + force push (more dangerous):
    - `git reset --hard f0451b5`
    - `git push --force-with-lease`

### Validation
- Vercel Deployments shows the latest production deployment referencing the rollback/revert commit.
- Open the app on laptop + phone and confirm UI matches the known-good baseline.

---

## Phase 1 — Reproduce + capture facts (don’t guess)

### Goal
Reproduce the exact data-loss sequence and capture what the sync engine *thought* it was doing.

### What we observed (from your report)
- You created a new **Lab daily event** on laptop.
- Phone did not show it.
- Phone “force pull” didn’t bring it in.
- After the phone “pull”, the event later disappeared from the browser too.

### Update from your controlled repro (2026-02-04)
You shared two state snapshots (Browser vs Mobile) that look **identical** for the visible core data (categories/habits/todos/scores), but have different timestamps:
- Browser `savedAt`: `2026-02-04T21:01:36.249Z`
- Mobile `savedAt`: `2026-02-04T21:02:20.425Z` (newer)

Key implications:
1) **`savedAt` can advance without an obvious user-visible data difference**, which makes “newer/older” decisions based purely on `savedAt` risky.
2) The snapshot you pasted does **not include LAB state**, so it can’t confirm whether the Lab daily event existed in one device’s state but not the other.
3) A device with an “older-but-newer-timestamp” state can (depending on policy) become the winner and prevent the other device’s changes from propagating.

### Update from Supabase Sync “Copy debug info” (2026-02-04)
You later captured full sync debug info from both devices and the event did sync.

What the logs show (high-signal points):
- **Same user on both devices**: `userId` matches.
- Both devices hit an initial **`reconcile:pull-failed`** right after sign-in, then succeeded on a subsequent reconcile.
   - This suggests a transient network/timeout on the first pull (not a data-model bug).
- Browser saw remote as stale (`remoteSavedAt` around `21:01Z`) and then did **`reconcile:local-newer-but-prefer-remote->pull`**.
   - This is a *dangerous but intentional* path in the current design: when “prefer remote on login” is true, we will hydrate from Supabase even if local has a newer `savedAt`.
- After that, the browser made a change that triggered **`push:ok (conditional)`**, advancing remote to `21:37Z`.
- Phone then observed remote at `21:37Z` and hydrated successfully; it never pushed (as expected).

Why this still matters:
- The “prefer remote on login” path can **discard local edits** if local has real data but `preferRemoteOnLogin` is set.
- The initial `pull-failed` can create a confusing delay where a device looks “signed in” but hasn’t reconciled yet.

This pattern strongly suggests a **conflict / overwrite** situation where a device with older data writes over the newer remote state.

### Steps
1) Confirm both devices are signed into the **same Supabase user**.
2) On both devices, record:
   - The Sync status (signed-in, user email, last pulled/pushed times).
   - Whether a conflict state is shown.
   - Use **Copy debug info** in the Sync dialog (this captures userId + decision breadcrumbs).
3) Add temporary debugging (dev-only) logging around:
   - `reconcileRemoteLocal()` decisions
   - any calls to `upsertRemoteState()`
   - `forceSupabasePull()` and what it hydrates
4) Reproduce with a controlled sequence:
   - Laptop: add a Lab daily event.
   - Wait for push confirmation.
   - Phone: open app, wait for pull/realtime.
   - If missing: run force pull.
   - Observe if/when remote changes.

### Validation
We can answer these questions with evidence:
- Did the phone push anything after you “pulled”?
- Did the phone consider its local state “newer” than remote due to timestamps?
- Did the remote row `saved_at` change unexpectedly?

---

## Phase 2 — Fix the most likely root cause: timestamp-based conflict + last-write-wins

### Why this is the prime suspect
In [app/src/persistence/supabaseSync.ts](../app/src/persistence/supabaseSync.ts):
- Conflict resolution defaults to `last-write-wins`.
- “Newer” is decided by comparing `savedAt` timestamps (from the client state).

If one device’s clock is ahead, or if `savedAt` is updated in a way that doesn’t reflect actual semantic freshness, an older dataset can appear “newer” and overwrite Supabase.

### Quick safety fix (minimize data loss risk)
- Change default conflict policy to **manual** until we’re confident.
- Ensure that **force pull never triggers a follow-up push** implicitly.
  - Today: `forceSupabasePull()` hydrates remote, sets `readyToPush = true`, and only suppresses one push.
  - A small subsequent local change could push unexpectedly.
- Ensure **sign-in / initial reconcile never auto-overwrites Supabase** when local appears “newer”.
   - Treat this as a conflict requiring explicit pull/push.

### Durable fix options (choose one)
1) **Optimistic concurrency + remote-newer protection** (recommended quick win)
   - Before any automatic push, do a lightweight pull to learn remote `saved_at`.
   - If Supabase is newer than local, **block the push** and surface a conflict.
   - When pushing, use a conditional update: only update when `saved_at == expected_saved_at`.
     - If it doesn’t match, remote changed → conflict.
   - Result: stale devices can’t silently overwrite newer remote state.
2) **Use remote `saved_at` for comparisons**
   - Compare local vs remote using the DB `saved_at` rather than state’s `savedAt`.
   - Still needs careful handling because local changes must eventually advance remote.
3) **Per-domain merge**
   - More complex: merge Lab events instead of overwriting whole app state.
   - Likely out of “quick fix” scope.

### Validation
- Create event on laptop → phone always eventually sees it.
- “Force pull” on phone never causes remote to lose newer laptop changes.
- Multi-device edits surface a conflict or resolve predictably.

---

## Phase 3 — Supabase “Performance/Security Lints” quick fixes

You attached a Supabase lints CSV showing:
- **Auth RLS Initialization Plan** warnings on `public.app_states` policies.

### Meaning
Your RLS policies likely call `auth.uid()` (or similar) directly in a way that is re-evaluated per-row.

### Fix
In RLS policies, rewrite:
- `auth.uid()` → `(select auth.uid())`

This is an easy, safe performance improvement and can reduce load/latency at scale.

### Validation
- Re-run Supabase linter; warnings disappear for those policies.

---

## Phase 4 — Data recovery / guardrails (optional but high value)

### Add guardrails
- Add a “Download my data” export in the UI before risky operations.
- Add a “Restore from Supabase” action that is **pull-only** (never pushes).
- Add a “Preview remote saved_at + device savedAt” diagnostic view.

### If data is missing now
- Query the `app_states` row history (if you have backups/logs) or restore from local export.
- Consider enabling point-in-time recovery / backups for the Supabase project.

---

## Phase 5 — Regression checklist

- Create/update Lab daily event on device A → appears on device B.
- Force pull on device B → never causes data loss on device A.
- Offline edits behave predictably.
- Realtime + polling do not cause flip-flopping.

---

## Next phase to execute

Start with Phase 0 (rollback production), then Phase 1 (reproduce with logging) before attempting deeper changes.
