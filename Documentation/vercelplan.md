# Vercel deployment plan (HabitTrack)

Goal: deploy the Vite + React app in `app/` to Vercel, with Supabase Auth + sync working in production.

This plan is intentionally **phased** and **very explicit**. Each step is tagged with:
- **(You)** = you do this in Vercel/Supabase/GitHub UI or your terminal
- **(Copilot)** = I do this in the repo (code/config changes) and can run local builds/tests

---

## Assumptions (based on this repo)

- The actual Vite project lives in `app/`.
- Root scripts forward into `app/` (e.g. root `npm run build` runs `app` build).
- Vite build output is the default `dist/` (no custom `base` set).
- You’re using Supabase in the browser via:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- You use `react-router-dom` (client-side routing), so we must ensure SPA “rewrite to index.html” behavior on Vercel.

---

## Phase 0 — Preflight (local + checklist)

**Outcome:** we know the app builds and we won’t get surprised by routing/env issues.

### 0.1 Confirm the app builds locally

- **(You)** From repo root run `npm run build`.
  - Expected: it forwards to `app` and produces `app/dist/`.

- **(Copilot)** If you want, I can run a build and sanity-check the output + errors.

### 0.2 Confirm Supabase env vars are NOT committed

- **(You)** Ensure you only store secrets in `app/.env.local` (not committed).
- **(You)** Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` work locally.

### 0.3 Decide how Vercel should treat this repo

You have two viable approaches; pick **A** (recommended).

**A) Vercel Root Directory = `app/` (recommended)**
- Cleaner: Vercel sees a normal Vite project.
- Config files like `vercel.json` (if needed) live in `app/`.

**B) Vercel Root Directory = repo root**
- Works, but you must point build output to `app/dist` and run root scripts.
- Slightly more confusing.

We’ll proceed assuming **Approach A**.

---

## Phase 1 — Create Vercel + connect GitHub

**Outcome:** Vercel can see your repo and create deployments on push.

### 1.1 Create / sign in to Vercel

- **(You)** Go to https://vercel.com and sign up / sign in.

### 1.2 Connect your Git provider

- **(You)** In Vercel → Account Settings → Git Integration.
- **(You)** Connect GitHub (or the provider where this repo lives).

### 1.3 Confirm the repo is pushed

- **(You)** Confirm your repo is on GitHub and your default branch is correct (likely `master`).

---

## Phase 2 — Create the Vercel Project

**Outcome:** Vercel knows how to build + serve your app.

### 2.1 Import the repo into Vercel

- **(You)** Vercel Dashboard → Add New… project's "Import" from Git.
- **(You)** Select the HabitTrack repo.

### 2.2 Configure project settings (critical)

- **(You)** In the “Configure Project” screen:
  - **Framework Preset:** Vite
  - **Root Directory:** `app`
  - **Build Command:** `npm run build`
  - **Output Directory:** `dist`
  - **Install Command:** `npm install`

Notes:
- With Root Directory = `app`, Vercel runs commands inside `app/`.
- Output directory should be `dist` (relative to `app/`).

### 2.3 Node version (recommended)

- **(You)** In Project Settings → General → Node.js Version:
  - Use the latest stable supported by Vercel (or match your local).

Optional hardening:
- **(Copilot)** I can add an `.nvmrc` or `engines` field (if you want to pin Node).

---

## Phase 3 — Configure Environment Variables (Vercel)

**Outcome:** deployed app can talk to Supabase.

### 3.1 Add the required env vars

- **(You)** Vercel Project → Settings → Environment Variables
- **(You)** Add these variables for at least **Production** and **Preview**:
  - `VITE_SUPABASE_URL` = your Supabase Project URL
  - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key

Important notes:
- Vite only exposes env vars that start with `VITE_`.
- Never put the Supabase **service role** key in Vercel env for a frontend app.

### 3.2 Redeploy after env changes

- **(You)** If you add/change env vars after first deploy: trigger a redeploy.
  - Vercel UI → Deployments → Redeploy

---

## Phase 4 — Fix client-side routing (React Router) on Vercel

**Outcome:** deep links like `/lab` don’t 404 in production.

Vercel needs to rewrite unknown routes to `/index.html` for SPAs.

### 4.1 Decide on rewrite method

Option A (recommended): `vercel.json` rewrite
- **(Copilot)** Add a `vercel.json` file in `app/` (because Root Directory is `app`).
- **(You)** Deploy.

Option B: Vercel UI rewrites (works but config lives in UI)
- **(You)** Configure rewrites in Vercel project settings.

### 4.2 `vercel.json` content (Option A)

- **(Copilot)** Add `app/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Notes:
- This is the common SPA rewrite for static Vite apps.

---

## Phase 5 — Configure Supabase Auth for Vercel URLs

**Outcome:** magic links work on the deployed domain.

Your app uses `redirectTo: window.location.origin`, which is great: on Vercel it will redirect back to your Vercel domain automatically.

### 5.1 Add Vercel URLs to Supabase allowlist

- **(You)** Supabase Dashboard → Authentication → URL Configuration
- **(You)** Add **Redirect URLs** for:
  - Your production domain, e.g. `https://your-project.vercel.app`
  - Your auth callback path too, e.g. `https://your-project.vercel.app/auth/callback`
  - Wildcard variants if you use them (Supabase supports patterns depending on settings; keep it strict if possible).

For Preview deployments:
- **(You)** If you want magic links to work on Preview deploys too, you must allow those preview URLs.
  - Preview URLs look like `https://<hash>-your-project.vercel.app`.
  - Many teams skip preview auth to avoid broad allowlists.

### 5.2 (Optional) Set Site URL

- **(You)** In the same Supabase auth settings, set your “Site URL” to your production domain.
  - This can help with consistent redirects.

---

## Phase 6 — First Deploy

**Outcome:** production deployment is live.

### 6.1 Deploy from Vercel UI

- **(You)** Click Deploy.
- **(You)** Watch the build logs for errors.

### 6.2 Verify the deployment

- **(You)** Open the deployed URL and verify:
  - App loads
  - Navigation works
  - Direct deep link works (open `/lab` directly)

If deep links 404:
- **(Copilot)** Add `app/vercel.json` rewrite (Phase 4) and redeploy.

---

## Phase 7 — Supabase Sync verification (Production)

**Outcome:** login + pull/push works on Vercel.

### 7.1 Test login

- **(You)** Open the deployed site.
- **(You)** Use the Sync UI and send a magic link.
- **(You)** Open the magic link promptly (links can expire).

If you see rate limits:
- **(You)** Wait 10–20 minutes and try again.
- **(You)** Check Supabase → Authentication → Logs for “Send OTP” events.

### 7.2 Test state hydration

- **(You)** After login, confirm the app hydrates your Supabase state.
- **(You)** Check Sync UI “Last pulled” updates.

### 7.3 Test state push

- **(You)** Make a small change (toggle habit / edit todo).
- **(You)** Confirm Sync UI “Last pushed” updates.
- **(You)** In Supabase Table Editor, confirm `app_states.updated_at` changes.

---

## Phase 8 — Automatic deployments (Preview + Production)

**Outcome:** pushes create preview deploys; merges to main create production deploys.

### 8.1 Preview deployments

- **(You)** Create a test branch and push.
- **(You)** Confirm Vercel created a Preview deployment.

### 8.2 Production deployments

- **(You)** Merge to the production branch (e.g. `master`).
- **(You)** Confirm Vercel created a Production deployment.

Optional:
- **(You)** Project Settings → Git → set which branch maps to Production.

---

## Phase 9 — Custom domain (optional but recommended)

**Outcome:** use your own domain and keep Supabase auth working.

### 9.1 Add domain in Vercel

- **(You)** Vercel Project → Settings → Domains
- **(You)** Add your domain (e.g. `habittrack.com`).
- **(You)** Follow DNS instructions (usually add CNAME / A records).

### 9.2 Add domain in Supabase Auth redirect URLs

- **(You)** Supabase → Authentication → URL Configuration
- **(You)** Add:
  - `https://habittrack.com`
  - `https://www.habittrack.com` (if used)

---

## Phase 10 — Hardening + troubleshooting (optional)

### 10.1 Add a health checklist

- **(You)** After each deployment:
  - Deep link test (`/lab`)
  - Login test (magic link)
  - Push test (Last pushed)

### 10.2 Rollback strategy

- **(You)** Vercel → Deployments → pick an older deployment → “Promote to Production”.

### 10.3 Common failure modes

- **Build fails**
  - **(You)** Inspect Vercel build logs.
  - **(Copilot)** Fix TypeScript/build issues in repo and push.

- **Deployed app loads but Supabase calls fail**
  - **(You)** Confirm Vercel env vars exist in Production and Preview.
  - **(You)** Redeploy after changing env vars.

- **Magic link returns “redirect URL not allowed”**
  - **(You)** Add the exact deployed URL(s) to Supabase redirect allowlist.

- **Deep links 404**
  - **(Copilot)** Add `app/vercel.json` rewrite and redeploy.

---

## If you want me to do the repo-side work now

Say: “Add the Vercel SPA routing config.”

- **(Copilot)** I’ll add `app/vercel.json` and run a local build.
- **(You)** You’ll redeploy on Vercel (or it’ll deploy on push).
