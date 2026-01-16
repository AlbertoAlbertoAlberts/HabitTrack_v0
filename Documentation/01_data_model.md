# 01_data_model.md — Data model definition (Personal Habit Tracker)

This document defines the persistent data model (entities, fields, relationships, and invariants) for the personal habit tracker.  
Storage target: local-only (browser storage). No backend, no login.

---

## 0) Core design choices

### Scores
- Each habit is evaluated per day with a **3-point scale**: `0 | 1 | 2`
- No custom scales per habit.

### Locking / immutability
- A **date becomes locked** once the user leaves that date/page context (details are defined in `02_locking_rules.md`).
- Locked entries are read-only.

### IDs
- All persistent entities use stable string IDs (UUID-like strings).
- Dates use canonical format: `YYYY-MM-DD` in local time.

---

## 1) Entity overview

### Persistent entities
1. `Category`
2. `Habit`
3. `DailyScore` (score per habit per date)
4. `TodoItem` (active to-do)
5. `TodoArchiveItem` (completed to-do items)
6. `WeeklyTask` (weekly repeating task)

### Derived (not stored as primary truth)
- Overview metrics and chart series are derived from `DailyScore` + current filters.
 - Weekly ring counts can be derived from the weekly completion-day lists (see Section 7).

---

## 2) Category

Represents a folder grouping habits.

### Type: `Category`
| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string | ✅ | Stable unique ID |
| `name` | string | ✅ | Display name (Latvian text) |
| `sortIndex` | number | ✅ | Manual category ordering (0..N-1) |
| `createdAt` | string (ISO) | ✅ | Timestamp |
| `updatedAt` | string (ISO) | ✅ | Timestamp |

### Invariants
- Category names do not need to be unique (optional UX constraint only).
- Categories are always shown “expanded” in UI (no persistent collapsed state).

### Deletion rule
- Deleting a category **deletes all its habits** and all related `DailyScore` records permanently.

---

## 3) Habit

Represents a single tracked habit belonging to a category.

### Type: `Habit`
| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string | ✅ | Stable unique ID |
| `name` | string | ✅ | Display name; should be short enough to fit UI (enforced by UI constraint) |
| `categoryId` | string | ✅ | FK → `Category.id` |
| `priority` | 1 \| 2 \| 3 | ✅ | **Current** priority (not historical) |
| `sortIndex` | number | ✅ | Manual ordering within its category |
| `createdAt` | string (ISO) | ✅ | Timestamp |
| `updatedAt` | string (ISO) | ✅ | Timestamp |

### Invariants
- A habit belongs to exactly one category at a time.
- `priority` is always `1`, `2`, or `3`.
- `sortIndex` is only meaningful among habits of the same category.
- **Priority is not historical**: overview uses the habit’s current priority even for past dates.

### Habit name length rule (UI-driven)
- The UI must constrain visible name length (truncate/ellipsis).
- The data model stores full text, but UX should prevent overly long names to avoid overlap in priority-edit mode.

### Deletion rule
- Deleting a habit permanently removes:
  - the habit record
  - all its `DailyScore` records

---

## 4) DailyScore (per-day scoring)

Represents one habit’s score for one date.

### Type: `DailyScore`
| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string | ✅ | Stable unique ID (or deterministic composite key, see below) |
| `date` | string (`YYYY-MM-DD`) | ✅ | The tracked day |
| `habitId` | string | ✅ | FK → `Habit.id` |
| `score` | 0 \| 1 \| 2 | ✅ | The chosen value |
| `lockedAt` | string (ISO) | ❌ | Present if entry is locked; may be omitted if lock is managed per-day (see below) |
| `createdAt` | string (ISO) | ✅ | Timestamp |
| `updatedAt` | string (ISO) | ✅ | Timestamp |

### Key strategy (choose one)
**Option A (recommended): deterministic key**
- Use composite key: `id = "${date}:${habitId}"`
- Guarantees no duplicates and makes lookups simple.

**Option B: random UUID**
- Requires a uniqueness constraint on (`date`, `habitId`) in app logic.

### Invariants
- At most one `DailyScore` exists for a given (`date`, `habitId`) pair.
- `score` is always `0`, `1`, or `2`.

### Locking note
Locking can be modeled in two ways:
1) **Per-entry lock** (store `lockedAt` on each `DailyScore`)
2) **Per-day lock** (store a day-level lock map; see Section 7)

The app behavior requires: once the day is committed, scores for that day become immutable.  
The detailed logic is defined in `02_locking_rules.md`.

---

## 5) TodoItem (active)

Global to-do item list (not date-specific).

### Type: `TodoItem`
| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string | ✅ | Stable unique ID |
| `text` | string | ✅ | Task text |
| `createdAt` | string (ISO) | ✅ | Timestamp |
| `updatedAt` | string (ISO) | ✅ | Timestamp |

### Invariants
- Active to-do items are global (same regardless of selected habit-tracker date).

### Completion rule
- When user checks a todo item, it is removed from active list and moved to archive as a `TodoArchiveItem` with completion timestamp.

### Deletion rule
- Deleting an active to-do permanently removes it (no archive entry created).

---

## 6) TodoArchiveItem (completed)

Stores completed to-dos with completion date/time and supports restore.

### Type: `TodoArchiveItem`
| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string | ✅ | Stable unique ID |
| `text` | string | ✅ | Task text (copied at completion time) |
| `completedAt` | string (ISO) | ✅ | When it was checked/completed |
| `restoredAt` | string (ISO) | ❌ | If restored back to active, store timestamp (optional) |

### Ordering
- Archive is displayed newest first: sort by `completedAt` descending.

### Restore rule
- Restoring creates a new `TodoItem` (or reuses ID; implementation choice) and sets `restoredAt`.

---

## 7) Weekly tasks

Weekly tasks are global (not tied to a specific category/habit) and tracked per week.
They enforce an explicit **once-per-day** rule: a task can be completed at most one time per calendar day.

### Type: `WeeklyTask`
| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string | ✅ | Stable unique ID |
| `name` | string | ✅ | Display name |
| `targetPerWeek` | number | ✅ | Target completions per week; clamped to `1..7` |
| `sortIndex` | number | ✅ | Manual ordering (0..N-1) |
| `createdAt` | string (ISO) | ✅ | Timestamp |
| `updatedAt` | string (ISO) | ✅ | Timestamp |

### Weekly completion tracking
Weeks are keyed by **week start date (Monday)** using local date format: `YYYY-MM-DD`.

#### Stored: completion day lists
- `weeklyCompletionDays: Record<WeekStartDate, Record<WeeklyTaskId, LocalDateString[]>>`

Meaning:
- For a week start `W` and task `T`, `weeklyCompletionDays[W][T]` contains the local dates within that week
  where the task was marked complete.

Invariants:
- Each date in `weeklyCompletionDays[W][T]` must be within `[W..W+6]` (Monday..Sunday)
- Dates are unique within the array (no duplicates)
- Array length is at most `7`

#### Stored (derived/cache): weekly progress counts
- `weeklyProgress: Record<WeekStartDate, Record<WeeklyTaskId, number>>`

`weeklyProgress[W][T]` is derived as the number of unique completion days for that task in that week.

---

## 8) Optional supporting state (persistent UI state)

These values are not “business data”, but should persist between sessions.

### Type: `UiState`
| Field | Type | Required | Notes |
|---|---|---:|---|
| `dailyViewMode` | `"category"` \| `"priority"` | ✅ | Last used Page 1 mode |
| `selectedDate` | string (`YYYY-MM-DD`) | ✅ | Last viewed date on Page 1 |
| `overviewRangeDays` | 7 \| 30 | ✅ | Default to 30 on first run |
| `overviewMode` | `"overall"` \| `"priority1"` \| `"priority2"` \| `"priority3"` \| `"category"` \| `"habit"` | ✅ | Default to `"overall"` on first run |
| `overviewSelectedCategoryId` | string \| null | ✅ | Used when `overviewMode="category"` |
| `overviewSelectedHabitId` | string \| null | ✅ | Used when `overviewMode="habit"` |
| `overviewWindowEndDate` | string (`YYYY-MM-DD`) | ✅ | End date for rolling 7/30 window; default = today |

### Optional: Day-level lock map (alternative to per-entry `lockedAt`)
If you prefer locking the whole day at once:

#### Type: `DayLock`
| Field | Type | Required | Notes |
|---|---|---:|---|
| `date` | string (`YYYY-MM-DD`) | ✅ | Day |
| `lockedAt` | string (ISO) | ✅ | When the day became immutable |

This can be stored as:
- `dayLocks: Record<YYYY-MM-DD, ISO_TIMESTAMP>`

---

## 9) Referential integrity rules

The app must maintain integrity on changes:

### Category deletion
- Remove all `Habit` where `habit.categoryId == category.id`
- Remove all `DailyScore` for deleted habits

### Habit deletion
- Remove all `DailyScore` where `dailyScore.habitId == habit.id`

### Category reorder
- Update each category’s `sortIndex`

### Habit reorder within category
- Update each habit’s `sortIndex` within that category

### Habit move to another category (drag & drop)
- Update `habit.categoryId`
- Update `sortIndex` in both source and target categories to keep 0..N-1 without gaps

### Priority change
- Update `habit.priority`
- Reposition that habit according to the priority reordering rules (behavioral logic; see main spec)

---

## 10) Derived computations (for overview)

These are computed at runtime, not stored:

### Daily total score for a selection
For each date D:
- Gather habits in selection S (overall / category / priority / single habit)
- Sum scores:
  - If a habit has no `DailyScore` on D (blank), treat as **0** in totals

### Max possible score (Y-axis max)
- `maxScore = 2 * numberOfHabitsInSelection`

---

## 11) Suggested file references

- `01_data_model.md` (this file)
- `02_locking_rules.md` (state machine and commit rules)
- `03_components.md` (component/module plan)
- `04_storage_schema.md` (local storage JSON shape + schema version)

---