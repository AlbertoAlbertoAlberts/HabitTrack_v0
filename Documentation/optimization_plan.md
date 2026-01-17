# optimization_plan.md — HabitTrack code optimization (no behavior change)

## Purpose
Reduce VS Code/Copilot lag and long-term maintenance pain by restructuring the codebase **without changing UI or behavior**.  
Main issue from repo stats: a few “mega-files” (especially `DailyPage.tsx` and `DailyPage.module.css`) rather than total project size.

## Non-negotiable rules
1. **No feature changes. No redesign. No logic changes.**
2. **No new libraries** unless absolutely required (prefer deletion over additions).
3. **Small steps only**: 1–2 extractions per commit.
4. After each step: run **`npm run build`** (and `npm run lint` if available).
5. If anything is uncertain: **pause and ask**, don’t guess.
6. Keep behavior identical: same routes, same interactions, same data model.

## Success criteria
- `DailyPage.tsx` becomes mostly composition and stays under ~250–350 lines.
- `DailyPage.module.css` shrinks drastically (ideally < 300–400 lines) by splitting into component CSS modules.
- `OverviewPage.tsx` shrinks (secondary priority).
- Storage/state access becomes **single-path** (no scattered localStorage reads/writes).
- Build remains green after every step.

---

## Step 0 — Baseline & safety (must do first)
### 0.1 Create refactor branch + checkpoint
- Create branch: `refactor/optimization`
- Commit current state as a checkpoint (even if messy).

### 0.2 Confirm current health
Run:
- `npm run build`
- `npm run lint` (or the closest available)
Record results briefly in the chat.

### 0.3 Create a smoke checklist
Create `Documentation/refactor_smoke_checklist.md` (tiny checklist):
- Daily page renders
- Can select scores
- Date navigation works
- Locking behavior unchanged
- Overview renders chart + filters
- Todos add/complete/archive/restore works

---

## Step 1 — Split DailyPage.tsx into components (highest ROI)
### Target structure
Create:
- `app/src/pages/DailyPage/components/`
- `app/src/pages/DailyPage/hooks/`

### 1.1 Extract UI-only components FIRST (lowest risk)
Extract in this order (stop after each, build, commit):
1) `ScoreRow.tsx`  
   - Responsible only for rendering the 0/1/2 control and current selection visuals.
   - Props: `value`, `locked`, `onChange(score)`, optional `size/variant`.
2) `HabitRow.tsx`  
   - Renders habit name + ScoreRow.
3) `HabitGroupCard.tsx`  
   - Renders one category card with a list of HabitRow.
4) `LeftNavPanel.tsx`  
   - Categories/priorities list and menu UI (but keep actions wired from parent).
5) `WeekPanel.tsx`  
   - Weekly tiles panel.
6) `RightTodosPanel.tsx`  
   - Todos list + add/delete/archive UI (logic still passed from parent).

**Rule:** At this stage, DailyPage keeps all state/handlers. Components are “dumb” and receive props.

### 1.2 Split DailyPage.module.css alongside extraction
For each component extracted:
- Create a matching `*.module.css` next to it.
- Move only relevant selectors from `DailyPage.module.css`.
- Keep only layout-grid + page wrapper styles in `DailyPage.module.css`.

### 1.3 Reduce prop drilling minimally (optional)
If props get excessive, introduce a small `DailyPageContext` ONLY if needed (prefer hooks in Step 2).

---

## Step 2 — Extract logic into hooks (reduce complexity, keep behavior)
Create `app/src/pages/DailyPage/hooks/`:

### 2.1 `useDailyData(selectedDate)`
Purpose: centralize data selection + derived lists.  
Return:
- categories, habits, grouping by category/priority
- scores map for day
- lock status for day
- any computed values used by UI

### 2.2 `useScoreHandlers(selectedDate)`
Purpose: centralize mutations (set score, commit/lock rules).  
Return:
- `setScore(habitId, score)`
- any “commit day” / “lock day” functions already in app
- `canEdit` / `isLocked`

### 2.3 `useResponsiveLayout()` (if you currently have resize fixes)
Purpose: isolate any resize listeners and header/layout CSS var updates.  
Rule: avoid duplicating viewport math across components.

---

## Step 3 — Tackle OverviewPage.tsx (secondary priority)
### 3.1 Extract components
Create:
- `app/src/pages/Overview/components/`
Extract:
- `OverviewFilters.tsx`
- `OverviewChart.tsx`
- `OverviewHabitList.tsx` (or equivalent list panel)

### 3.2 Extract hook
- `useOverviewData(rangeDays, mode, selection)`  
Return data ready for chart + list.

---

## Step 4 — Normalize state/storage access (stop scattered persistence)
Goal: one clear API for persistence.

### 4.1 Identify all storage touchpoints
Search for:
- `localStorage`
- `JSON.parse`
- `JSON.stringify`
- `save`, `load`, `persist`, `hydrate`

### 4.2 Centralize
Create or confirm one module (example):
- `app/src/services/storage/StorageService.ts`
All reads/writes must go through it.  
Components/pages must never call localStorage directly.

### 4.3 Cleanup duplicates
Remove any duplicated persistence logic from components once centralized (commit separately).

---

## Step 5 — Remove dead code & leftovers (safe deletions only)
### 5.1 Identify candidates
- unused components
- unused CSS selectors
- unused helper functions
- old experiments, debug code

### 5.2 Delete safely
Delete only if:
- not imported anywhere
- not referenced by routes
- build stays green

Produce a short “Removed items” report in commit message or `Documentation/optimization_notes.md`.

---

## Step 6 — Optional: tiny shared UI primitives (only if duplication is obvious)
Create `app/src/components/ui/` with ONLY a few primitives:
- `Card`
- `IconButton`
- `SegmentedToggle`
- `PanelHeader`

Do not create a full design system.  
Only refactor repeated patterns if it reduces code in multiple places.

---

## Commit discipline
- One extraction = one commit, e.g.:
  - `refactor(daily): extract ScoreRow`
  - `refactor(daily): extract HabitGroupCard`
- After each commit:
  - build passes
  - smoke checklist OK

---

## Stop conditions (when to pause)
- If a step causes layout or behavior change
- If build fails and fix is unclear
- If Copilot suggests large rewrites or new libs
In those cases: revert the commit, regroup, proceed with smaller steps.