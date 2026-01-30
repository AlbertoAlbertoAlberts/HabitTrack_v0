# Mobile Plan — LAB Page (mobileplan.md)

## Goal
Make the **LAB page** work cleanly on mobile while keeping desktop behavior intact.

**Target mobile layout order (top → bottom):**
1. **LAB projects** (project picker / project list)
2. **Analysis window** (Findings / tabs)
3. **Tags window** (tag list + event log list where applicable)

Other pages (Habit / Overview) are already acceptable and out-of-scope.

Mobile-readiness additions (friend’s suggestions, included here so we don’t forget when adding a real DB):
- Keep **daily input / logging flows** fast + thumb-friendly.
- Make UI **resilient to bad/slow network** (optimistic UX, clear save feedback, safe retries).
- Add **loading/empty/error states now** so the Supabase/Vercel step doesn’t force a rushed UI rewrite.

---

## Definition of “mobile” + breakpoints
This codebase is currently **desktop-first**. For LAB we’ll add explicit responsive behavior.

Proposed breakpoints (can be tuned after visual QA):
- **Mobile:** `<= 560px` (matches existing patterns e.g. `DataMaturityView.module.css`)
- **Small tablet:** `561–980px` (already used in `LabPage.module.css`)
- **Desktop:** `> 980px`

Acceptance criteria (mobile):
- No horizontal scrolling.
- No clipped panels / unreadable text.
- Buttons and menu targets remain usable.
- Content order is exactly: Projects → Analysis → Tags.

---

## Current implementation (baseline)
LAB page layout is currently:
- `LabPage.tsx`: left column contains **Projects panel** and (when a project is active) the **Tags panel**.
- `LabPage.tsx`: right/main column contains the **Analysis panel**.
- `LabPage.module.css`: `flex` layout, switching to `flex-direction: column` under `980px`.

Problem on mobile:
- When stacked vertically (under `980px`), the **Tags panel remains inside the left column**, so it appears **before** Analysis.

---

## Phase 0 — Audit & constraints (no behavior changes)
**Outcome:** a clear checklist of what breaks on narrow widths and which elements need responsive overrides.

### Step 0.1 — Visual audit
- Test LAB page at: `980px`, `768px`, `560px`, `420px`, `375px`.
- Verify:
  - Project list card layout
  - Tag list card layout
  - Findings tabs (wrapping / overflow)
  - Event log list (event mode) layout
  - Dialogs (ProjectDialog, TagDialog, delete confirm overlays)
  - Any component with `min-width` constraints

### Step 0.2 — Identify “must-fix” overflow sources
Typical suspects (to confirm in CSS):
- Fixed widths (`width: 360px` sidebar)
- `min-width` on dialogs/buttons/cards
- Grids with hard column sizes (e.g. `grid-template-columns: 220px 1fr`)
- Tabs / long labels that don’t wrap

Deliverable:
- A short list (by component/file) of the exact overflow offenders.

### Step 0.3 — Inventory async/network-sensitive UI surfaces
Even though the app is currently local-only, identify places that will become async once Supabase is used.

For LAB page specifically:
- Project list + tag list (today: local; future: fetched)
- Event logging + daily logging (today: local writes; future: network writes)
- Findings/analysis (today: local compute; future: might depend on fetched data)

Deliverable:
- A small table of components and the state they’ll need: `idle | loading | ready | error | empty | saving`.

#### LAB async/UI state matrix (DB-ready)

| Surface | Where | What changes when DB exists | States to support | Notes / UX requirements |
|---|---|---|---|---|
| Project list | `LabPage` (Projects panel) | Load projects from DB; order changes may be remote | `loading`, `ready`, `empty`, `error` | Keep list usable while loading (skeleton rows). Support retry on error. |
| Project actions (create/edit/archive/reorder) | `ProjectDialog`, Projects panel | Writes become networked | `saving`, `error` | Optimistic reorder is OK; on failure revert + toast/banner. |
| Tag list | `LabPage` (Tags panel) | Load tags + ordering from DB | `loading`, `ready`, `empty`, `error` | Must not “jump” layout on mobile; preserve scroll position. |
| Tag actions (create/edit/delete/reorder) | `TagDialog`, Tags panel | Writes become networked; delete may be blocked by server constraints | `saving`, `error` | Deletion needs clear error (“tag in use”) from server too; don’t lose dialog input. |
| Event log list (view) | `EventLogList` | Fetch paginated logs; newest-first; server timestamps | `loading`, `ready`, `empty`, `error` | Keep it thumb-friendly: scrolling inside list shouldn’t fight page scrolling. |
| Event log writes (create/edit/delete) | `EventLogList` | Create/edit/delete becomes async | `saving`, `error` | Optimistic add with “syncing…” badge; retry on failure; keep draft text. |
| Findings computation | `FindingsView` (+ analysis runner) | Might depend on fetched logs; may need server precompute later | `loading`, `ready`, `empty`, `error` | Distinguish “no data yet” vs “error loading data” vs “computing”. |
| Dataset/debug | `DatasetDebugView` | Optional; likely dev-only | `loading`, `ready`, `error` | Keep behind dev flags; don’t block main UX. |

Implementation guideline (for later Supabase phase):
- Prefer a consistent status enum per surface: `idle | loading | ready | empty | error | saving`.
- For writes, keep a separate `saveStatus` so reads and writes don’t fight (`ready` + `saving` is common).
- Always show “saved/syncing/failed” feedback near the action area on mobile.

---

## Phase 1 — Restructure layout to support mobile ordering
**Outcome:** the LAB page supports different visual ordering on mobile without duplicating UI.

### Step 1.1 — Convert top-level LAB layout from `flex` to `grid`
Reason: we need **different visual order** on mobile vs desktop. CSS grid with named areas is the cleanest way to do this.

Proposed grid areas:
- `projects`
- `analysis`
- `tags`

Desktop grid (2 columns):
- Row 1: `projects | analysis`
- Row 2: `tags     | analysis`

Mobile grid (1 column):
- Row 1: `projects`
- Row 2: `analysis`
- Row 3: `tags`

Files:
- Update layout rules in `app/src/pages/LabPage/LabPage.module.css`.

### Step 1.2 — Split DOM sections in `LabPage.tsx` into 3 wrappers
Today, tags are nested in the sidebar. To let CSS reorder properly, make 3 explicit sections:
- `<div className={styles.projectsArea}>…projects panel…</div>`
- `<div className={styles.analysisArea}>…analysis panel…</div>`
- `<div className={styles.tagsArea}>…tags panel…</div>`

Notes:
- This is mostly a **structural move** (same content, new wrappers).
- Ensure the “no active project” state still reads well (e.g., show projects + analysis placeholder; tags area can be hidden or show a small hint).

### Step 1.3 — Keep desktop UX the same
- On desktop, the sidebar still visually appears as projects + tags stacked.
- Analysis remains the large right-side panel.

Acceptance criteria:
- Desktop layout unchanged.
- Mobile layout order exactly matches requested ordering.

---

## Phase 2 — Make each panel responsive (mobile ergonomics)
**Outcome:** each of the three panels works well at small widths.

### Step 2.1 — Projects panel on mobile
Adjustments (CSS-first):
- Ensure project cards wrap cleanly (name + badge + meta).
- Reduce padding/margins slightly at `<= 560px`.
- Ensure menu button (`LabMenu`) and close button don’t cause header overflow.

Optional usability improvements (only if needed after Phase 1):
- Add a collapsed “Projects” header with an expand/collapse affordance using `<details>` (same as existing menu patterns) so the page doesn’t become extremely long.

### Step 2.2 — Analysis panel (FindingsView)
Common mobile issues:
- Tab rows overflow horizontally.
- Dense multi-column metric grids are too wide.

Planned actions:
- Make tabs wrap or scroll horizontally (prefer wrap first; scroll if wrapping looks bad).
- Ensure any tables/rows use `min-width: 0` in container flex/grid items.
- Verify charts (if any) are responsive or allow horizontal scroll within the chart container.

Files to inspect/tune:
- `app/src/pages/LabPage/components/FindingsView.module.css`
- `app/src/pages/LabPage/components/LabResultsTabs.module.css`
- Any subviews used by Findings (TagStatsView/EventFrequencyView/etc)

### Step 2.3 — Tags panel on mobile
Tags panel includes:
- Tag list
- Tag CRUD modes (edit/delete/reorder)
- Event mode: EventLogList under tags

Planned actions:
- Ensure tag cards wrap: name + optional group + intensity line.
- Make the Tag list a single column on mobile.
- Ensure drag/reorder affordances do not create accidental horizontal overflow.
- In event mode, ensure `EventLogList` is full-width and buttons/inputs wrap.

Optional (if needed):
- Add a “Tags” collapse/expand on mobile to keep page height manageable.

### Step 2.4 — Thumb-friendly input (fast daily flow)
Even though you said other pages are “mostly fine”, mobile usability tends to break first in fast-entry flows.
This step is about ensuring the *input interactions* are mobile-friendly and stay that way when network writes are introduced.

Checklist:
- Ensure primary actions are reachable with one thumb (bottom half of screen when feasible).
- Increase tap targets for icon buttons to ~40–44px on mobile.
- Avoid tiny inline menus that require precision; prefer a single large action button + a clear menu.
- For any quick-entry UI (Daily outcome/tags, event log add):
  - Keep the “Save/Update” action stable in location
  - Avoid layout shifts when validation errors appear
  - Ensure the screen can scroll to reveal validation errors

Network resilience (implementation approach, for when Supabase arrives):
- Prefer optimistic UI where safe (append event immediately, mark “syncing…”).
- Always show a “saved / last saved / syncing / failed” hint.
- Add retry affordance on failure; don’t lose user input.
- Consider offline queueing (store pending writes locally and sync later).

---

## Phase 3 — Fix known mobile edge cases (dialogs, overlays, hard min-width)
**Outcome:** dialogs and overlays fit mobile screens safely.

### Step 3.1 — Delete confirm overlays
Current CSS shows a `min-width: 320px` dialog in `LabPage.module.css`. On small devices (or narrow windows), that can cause overflow.

Planned changes:
- Replace `min-width` with responsive sizing:
  - `width: min(92vw, 420px)`
  - `max-width: 92vw`
  - Keep padding comfortable

### Step 3.2 — ProjectDialog + TagDialog
- Verify dialog layouts at `<= 560px`.
- Convert multi-column grids to single column on mobile.
- Ensure form controls are full-width.

Files:
- `app/src/pages/LabPage/components/ProjectDialog.module.css`
- `app/src/pages/LabPage/components/TagDialog.module.css`

### Step 3.3 — Any remaining fixed widths / grids
Examples already present in codebase:
- `TagStatsView.module.css`: `grid-template-columns: 220px 1fr` (needs a mobile override to `1fr`).

Deliverable:
- Add `@media (max-width: 560px)` overrides for any fixed multi-column grids.

### Step 3.4 — Add loading / empty / error states now (DB-ready)
Some empty states already exist (e.g. “No projects yet”, “No tags yet”). Extend this into a consistent pattern so the DB migration doesn’t force UI rewrites.

Planned states to support:
- `loading`: skeleton rows/cards or lightweight spinner
- `empty`: existing empty state blocks (keep)
- `error`: friendly error panel + a retry button
- `saving`: disable save button, show progress text
- `offline`: show a small banner (optional) and queue writes

Where to apply (LAB page):
- Project list panel
- Tags panel
- Event log list (append-only) and any save/update flows
- Findings panel (if analysis depends on async data later)

Acceptance criteria:
- User never wonders “did it save?” on mobile.
- No data loss if a save fails (input remains available).
- UI doesn’t jump around when states change.

---

## Phase 4 — QA pass + polish
**Outcome:** mobile LAB page feels intentional, not just “shrunk desktop”.

### Step 4.1 — Manual QA checklist

Run this as a **manual checklist** (no code changes). Target widths:
- iPhone-ish width: `375px`
- Small Android width: `360px`

Setup (Chrome/Edge devtools):
- Toggle device toolbar
- Test `375×812` and `360×800` (or similar)
- Keep the viewport at `<= 560px` for “mobile” behavior

Checklist:
- Layout order is exactly: **Projects → Analysis → Tags** (no tag panel appearing above analysis)
- No horizontal scroll anywhere:
  - Try swipe/trackpad horizontal movement on the page
  - Also check inside: Analysis panel, Tags panel, Event log list
- Headers don’t overflow:
  - Long project name doesn’t push the menu/close button off-screen
  - Tag names and badges wrap/ellipsis without breaking layout

Projects panel:
- Create at least 1 project and confirm:
  - Cards are fully tappable
  - Edit mode: edit icon is easy to tap
  - Delete mode: delete icon is easy to tap
  - Reorder mode: dragging doesn’t create horizontal overflow

Analysis panel:
- With an active project:
  - Findings view renders without clipped text
  - Any tabs/rows wrap or remain readable
  - Empty-state screens are readable and centered

Tags panel:
- With an active project:
  - “No tags yet” empty state looks OK
  - Create a tag and confirm the list stays single-column on mobile
  - Delete a tag that is in use:
    - Should show an inline error notice (no browser `alert()`)
    - Notice is dismissible and doesn’t break layout

Event mode (only for event projects):
- Add event:
  - Open add form, fill fields, Save
  - If severity is required and empty: inline validation error is shown (no browser `alert()`)
- Edit event:
  - Edit, change fields, Save
  - If severity is required and empty: inline validation error is shown
- Scrolling:
  - Log list scrolls without fighting the page scroll
  - Expanding/collapsing an item doesn’t cause horizontal scroll

Dialogs/overlays:
- Project/Tag dialogs fit on mobile (no clipped footer)
- Delete confirm overlay fits and buttons are tappable

### Step 4.2 — Polish (only if it improves usability)
- Slightly larger touch targets for icon buttons on mobile.
- Reduce visual density by increasing line-height in dense findings blocks.
- Ensure empty states remain readable and don’t look “lost” in tall panels.

---

## Implementation notes / guardrails
- Prefer **CSS-first** fixes (media queries, `min-width: 0`, wrapping) before refactoring logic.
- Keep desktop visuals stable; mobile overrides should be additive.
- Avoid new abstractions/utilities unless reused.

---

## Completion criteria
This plan is “done” when:
- LAB page is usable at `<= 560px` without horizontal scrolling.
- Mobile ordering is exactly: Projects → Analysis → Tags.
- Dialogs fit the viewport on mobile.
- Desktop layout remains effectively unchanged.
