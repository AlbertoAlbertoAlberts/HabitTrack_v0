# task_add_plan.md — “Start from added day/week” + Elastic max score (Overview)

## Problem statement
When a **new habit** (daily) or **weekly task** is added, it currently only appears starting from that day/week. This causes:
- **Daily/Weekly pages**: going back to earlier days/weeks hides the new item, which is confusing.
- **Overview chart**: the **max possible score** changes mid-window when habits are added/removed (and when filters aggregate multiple habits). A fixed Y-axis based on “current total habits” makes the chart misleading.

## User decisions / constraints (captured)
1) Daily/Weekly pages behavior for newly added items when viewing earlier periods: **B — show but disabled** (not rateable).
2) Deletion: for now, **deleted is deleted** (no archive). This means history will change retroactively when items are deleted.
3) Category/priority changes: **not historical**. Past days should use the habit’s **current** category/priority.
4) Weekly tasks: “start week” is **week-based** (Monday–Sunday).
5) Overview “elastic max” concept:
   - Each day has its own **maxPossible(day)** based on which habits are active that day (under current filters).
   - The chart should keep the **max line at a fixed top position** (never out of bounds) even if maxPossible changes over time.

---

## High-level approach
### A) Add an explicit “effective start” to items
- Daily habits: add `startDate: LocalDateString`.
- Weekly tasks: add `startWeekStart: LocalDateString` (Monday date).

This makes “active vs. not yet active” computable without guessing from timestamps.

### B) Enforce active rules in actions (not only UI)
- Prevent scoring a habit on a date earlier than its `startDate`.
- Prevent weekly completion on weeks earlier than `startWeekStart`.

### C) Make Overview chart “elastic” by normalizing per-day scores
The core “twist” requirement implies a single global Y-scale can’t represent changing maxPossible while keeping the max line fixed.

So:
- Compute per day:
  - `earned(day)` = sum of scores for habits active that day (and matching current filter).
  - `maxPossible(day)` = `2 * countActiveHabits(day)` (or `2` for single-habit mode).
- Plot `completion(day) = earned(day) / maxPossible(day)` (0..1).
- Draw the **max line** as constant at `completion=1` across the window (always at the top).
- Keep the “max dots” (if desired) at the top as well, and show the **actual maxPossible(day)** via labels or hover.

This keeps the chart visually bounded while still reflecting real changes in daily maxPossible.

---

## Data model & storage changes
### 1) Types
Update [app/src/domain/types.ts](../app/src/domain/types.ts):
- `Habit`:
  - add `startDate?: LocalDateString` (optional for backward compatibility)
- `WeeklyTask`:
  - add `startWeekStart?: LocalDateString` (optional)

We keep them optional initially to avoid a schema-version bump and handle older saved states gracefully.

### 2) State repair/backfill (no schema version bump)
Update [app/src/persistence/storageService.ts](../app/src/persistence/storageService.ts) in `repairStateV1`:
- For every habit missing `startDate`, backfill it as:
  - `startDate = localDate(createdAt)`
- For every weekly task missing `startWeekStart`, backfill it as:
  - `startWeekStart = weekStartMonday(localDate(createdAt))`

Notes:
- This preserves existing user data with deterministic behavior.
- If later we introduce archives / disable instead of delete, we can migrate properly via `schemaVersion`.

---

## Behavior changes (Daily habits)
### 3) Creation
Update [app/src/domain/actions/habits.ts](../app/src/domain/actions/habits.ts):
- In `addHabit(...)`, set `startDate`.

Decision confirmed:
- `startDate = todayLocalDateString()` (always today)

### 4) Scoring guardrail
Update [app/src/domain/actions/dailyScores.ts](../app/src/domain/actions/dailyScores.ts):
- In `setScore(state, date, habitId, score)`:
  - If habit has `startDate` and `date < startDate`, reject (throw error).

This ensures the rule holds even if UI mistakenly allows it.

### 5) Daily UI: show-but-disabled
Update [app/src/pages/DailyPage/DailyPage.tsx](../app/src/pages/DailyPage/DailyPage.tsx) and/or the relevant daily habit tile component:
- When rendering a habit for selected date `D`:
  - `isNotStartedYet = habit.startDate && D < habit.startDate`
  - Render the habit row, but:
    - Disable the score buttons
    - Show a small hint (e.g. “Sākas: YYYY-MM-DD” or localized)
    - Optional: reduce opacity and set cursor to `not-allowed`

Acceptance:
- Past days show the habit, but you can’t rate it.
- Clear visual explanation why.

---

## Behavior changes (Weekly tasks)
### 6) Creation
Update [app/src/domain/actions/weeklyTasks.ts](../app/src/domain/actions/weeklyTasks.ts):
- In `addWeeklyTask(...)`, set `startWeekStart`.

Decision confirmed:
- start week = week containing “today” (Monday–Sunday)

### 7) Completion guardrail
Update [app/src/domain/actions/weeklyTasks.ts](../app/src/domain/actions/weeklyTasks.ts):
- In `adjustWeeklyCompletionForDate(...)`:
  - If task has `startWeekStart` and `weekStartDate < startWeekStart`, reject.

### 8) Weekly UI: show-but-disabled for previous weeks
Where weekly tasks are rendered (Daily page weekly section and/or weekly components):
- Determine current weekStart `W`
- `isNotStartedYet = task.startWeekStart && W < task.startWeekStart`
- Render tile, but:
  - Disable click/Shift-click
  - Optional hint: “Sākas nedēļā: YYYY-MM-DD”

Acceptance:
- Tasks appear in older weeks but are visibly inactive and not clickable.

---

## Overview chart: elastic maxPossible
### 9) Compute time-varying maxPossible
Update [app/src/pages/OverviewPage/OverviewPage.tsx](../app/src/pages/OverviewPage/OverviewPage.tsx):

Currently, `yMax` is computed from `habitIds.length * 2` and is constant for the whole window.

We will introduce per-date calculations:
- Determine which habits are included by the selected Overview filter **and** are active on that date:
  - `activeHabitIdsForDate(date) = habitIds.filter(id => date >= habitsById[id].startDate)`
- `maxPossible(date) = 2 * activeHabitIdsForDate(date).length`
- `earned(date) = sum(dailyScores[date][id]) for id in activeHabitIdsForDate(date)`
- `completion(date) = maxPossible(date) > 0 ? earned(date)/maxPossible(date) : 0`

Then plot `completion` instead of raw `earned`.

### 10) Keep the max line fixed at top
- The “max” series in the chart becomes a constant line at `completion=1`.
- Max dots are drawn at the same top y.

To preserve usefulness:
- Provide a way to see `maxPossible(date)`:
  - Option A: small label only when max changes (step points)
  - Option B: show on hover (recommended)

### 11) Axis labels
Because the plotted value is now normalized, the y-axis cannot stay as “raw score”.
Change y-axis labels to **percent**:
- ticks: 0%, 25%, 50%, 75%, 100%

Optional: show the *current day’s* raw `earned/maxPossible` in the legend area when hovering.

### 12) Secondary effects (summary numbers)
The Overview page currently computes `total` and `avg` from raw `series.value`.
With normalization, we should decide what these mean:
- Option A: show average completion % (recommended)
- Option B: keep raw avg score but it will be inconsistent across max changes

Decision confirmed: switch these metrics to normalized completion % for consistency.

Acceptance:
- Adding a habit mid-window does not “flatten” earlier days.
- Max line is always at top.
- The chart remains bounded and readable.

---

## Deletion behavior (explicitly accepted for now)
Since deletion currently removes habits/tasks and their stored records:
- Historical maxPossible for past dates will also change retroactively.

This is accepted for now.
Future enhancement (not in this plan): introduce `archivedAt` / `disabledAt` instead of hard delete.

---

## Implementation phases (suggested)
### Phase 1 — Data fields + repair
- Update `types.ts` with optional fields
- Update `storageService.ts` repair to backfill
- Ensure app loads old data without crashing

### Phase 2 — Creation semantics
- Update add-habit + add-weekly-task paths to capture start date/week
- Decision: always use “today” (and current week containing today)

### Phase 3 — Guardrails in actions
- Add start-date checks in `dailyScores.setScore`
- Add start-week checks in `weeklyTasks.adjustWeeklyCompletionForDate`

### Phase 4 — UI disabled states
- Daily page habit list: show-but-disabled for pre-start days
- Weekly task list: show-but-disabled for pre-start weeks

### Phase 5 — Overview elastic normalization
- Compute per-day maxPossible + completion
- Update chart to plot completion and keep max line at top
- Update y-axis labels to percent
- Add minimal affordance to reveal per-day maxPossible (hover or step labels)

### Phase 6 — Verification
- Manual checks:
  - Add habit on Wed; Mon/Tue show habit disabled
  - Overview: Mon/Tue point height reflects completion, not raw score; max stays top
  - Weekly: add task mid-week; previous week shows disabled
- Run `npm run build`

---

## Open questions (need your confirmation before coding)
1) When you add a habit while viewing a past day, should `startDate` be:
   - the day you’re viewing (selected date), OR
   - always “today”?

2) For the Overview metrics (avg/total), do you want them to become **percent-based** once we normalize the chart?
   - If yes: display like “Vidēji: 72%”
   - If no: we need a separate way to communicate changing max
