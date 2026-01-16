# 04_storage_schema.md — Local storage schema & versioning (Personal Habit Tracker)

This document defines **exactly what is stored locally**, under which keys, and how schema versioning/migrations work.
Target: browser local storage (or IndexedDB if needed later). MVP assumes localStorage with JSON.

---

## 0) Goals

1. Persist all user data locally with no backend.
2. Keep schema explicit so future changes don’t wipe data.
3. Make lookups fast and deterministic.
4. Support safe upgrades via `schemaVersion` + migrations.

---

## 1) Storage keys

Use one top-level key for the entire app state.

- **Primary key:** `habitTracker.appState`

(Optionally, during development: `habitTracker.appState.dev`)

---

## 2) Root document shape

### Type: `AppStateV1`

```json
{
  "schemaVersion": 1,
  "savedAt": "2026-01-12T20:15:00.000Z",

  "meta": {
    "appVersion": "0.1.0",
    "createdAt": "2026-01-12T10:00:00.000Z"
  },

  "categories": {},
  "habits": {},
  "dailyScores": {},
  "dayLocks": {},

  "weeklyTasks": {},
  "weeklyProgress": {},
  "weeklyCompletionDays": {},

  "todos": {},
  "todoArchive": {},

  "uiState": {}
}
```

**Notes**
- `savedAt` is updated whenever the app writes state.
- All collections use ID-keyed objects (maps) for stability and speed.
- `meta.appVersion` is the app’s release/version (not the schema). `schemaVersion` is the storage shape.
- `weeklyTasks` / `weeklyProgress` / `weeklyCompletionDays` may be missing in older saved states; the app should repair/default them on load.

---

## 3) Collections

### 3.1 Categories

**Type:** `categories: Record<CategoryId, CategoryV1>`

```json
"categories": {
  "cat_1": {
    "id": "cat_1",
    "name": "Skola",
    "sortIndex": 0,
    "createdAt": "2026-01-12T10:00:00.000Z",
    "updatedAt": "2026-01-12T10:00:00.000Z"
  }
}
```

---

### 3.2 Habits

**Type:** `habits: Record<HabitId, HabitV1>`

```json
"habits": {
  "hab_1": {
    "id": "hab_1",
    "name": "Mācības",
    "categoryId": "cat_1",
    "priority": 1,
    "sortIndex": 0,
    "createdAt": "2026-01-12T10:01:00.000Z",
    "updatedAt": "2026-01-12T10:01:00.000Z"
  }
}
```

---

### 3.3 Daily scores

**Strategy**
- Use deterministic composite keys by date and habit:
  - `dailyScores[date][habitId] = score`
- This avoids duplicate entries and makes retrieval for a date range simple.

**Date key rule (important)**
- All dates used as keys (in `dailyScores`, `dayLocks`, and `uiState.selectedDate` / `uiState.overviewWindowEndDate`) must be stored in **local time** using format: `YYYY-MM-DD`.
- No UTC conversion is applied to date keys.

**Type**
- `dailyScores: Record<YYYY-MM-DD, Record<HabitId, 0|1|2>>`

```json
"dailyScores": {
  "2026-01-12": {
    "hab_1": 2,
    "hab_2": 1
  },
  "2026-01-11": {
    "hab_1": 0
  }
}
```

**Invariants**
- Scores are only `0`, `1`, or `2`.
- Missing `habitId` means “blank/unfilled” for that day.

---

### 3.4 Day locks (commit-on-leave)

Day locks are stored at day-level.

**Type**
- `dayLocks: Record<YYYY-MM-DD, ISO_TIMESTAMP>`

```json
"dayLocks": {
  "2026-01-12": "2026-01-12T20:10:00.000Z",
  "2026-01-11": "2026-01-11T23:05:00.000Z"
}
```

**Meaning**
- If a date is present in `dayLocks`, it is immutable forever.
- When leaving a day session, lock the date only if that date has at least one score.

---

### 3.5 Weekly tasks

Weekly tasks are stored per-week. Weeks are keyed by **week start date (Monday)** in local date format: `YYYY-MM-DD`.

#### 3.5.1 Weekly task definitions

**Type**
- `weeklyTasks: Record<WeeklyTaskId, WeeklyTask>`

```json
"weeklyTasks": {
  "wt_1": {
    "id": "wt_1",
    "name": "Treniņš",
    "targetPerWeek": 2,
    "sortIndex": 0,
    "createdAt": "2026-01-12T12:00:00.000Z",
    "updatedAt": "2026-01-12T12:00:00.000Z"
  }
}
```

#### 3.5.2 Completion day lists (source of truth)

**Type**
- `weeklyCompletionDays: Record<WeekStartDate, Record<WeeklyTaskId, LocalDateString[]>>`

```json
"weeklyCompletionDays": {
  "2026-01-12": {
    "wt_1": ["2026-01-12", "2026-01-14"]
  }
}
```

**Invariants**
- Each date in the array must be within the week `[weekStart..weekStart+6]`.
- Each date must be unique (once-per-day rule).

#### 3.5.3 Weekly progress counts (derived/cache)

For quick ring rendering, the app also stores a numeric count per week/task.

**Type**
- `weeklyProgress: Record<WeekStartDate, Record<WeeklyTaskId, number>>`

```json
"weeklyProgress": {
  "2026-01-12": {
    "wt_1": 2
  }
}
```

**Note**
- `weeklyProgress` can be repaired/derived from `weeklyCompletionDays` on load.

---

### 3.6 To-do (active)

**Type**
- `todos: Record<TodoId, TodoV1>`

```json
"todos": {
  "todo_1": {
    "id": "todo_1",
    "text": "Nosūtīt e-pastu",
    "sortIndex": 0,
    "createdAt": "2026-01-12T12:00:00.000Z",
    "updatedAt": "2026-01-12T12:00:00.000Z"
  }
}
```

**Notes**
- `sortIndex` is optional but recommended if you want stable ordering.
- If you do not want manual ordering, you can omit `sortIndex` and sort by `createdAt`.

---

### 3.7 To-do archive (completed)

**Type**
- `todoArchive: Record<TodoArchiveId, TodoArchiveV1>`

```json
"todoArchive": {
  "arch_1": {
    "id": "arch_1",
    "text": "Nosūtīt e-pastu",
    "completedAt": "2026-01-12T18:25:00.000Z",
    "restoredAt": null
  }
}
```

**Ordering**
- UI sorts by `completedAt` descending.

**Restore behavior**
- Restoring either:
  - Creates a new `TodoV1` item and sets `restoredAt`, OR
  - Reuses original id (implementation choice)
- MVP recommendation: create a new active todo id and mark `restoredAt`.

---

### 3.8 UI state (persistent preferences)

**Type:** `UiStateV1`

```json
"uiState": {
  "dailyViewMode": "category",
  "selectedDate": "2026-01-12",

  "overviewRangeDays": 30,
  "overviewWindowEndDate": "2026-01-12",
  "overviewMode": "overall",
  "overviewSelectedCategoryId": null,
  "overviewSelectedHabitId": null,

  "dailyLeftMode": "normal",
  "todoMode": "normal"
}
```

**Defaults (first run)**
- Daily page:
  - `dailyViewMode`: `"category"` (or last used if exists)
  - `selectedDate`: today
- Overview page:
  - `overviewRangeDays`: `30`
  - `overviewMode`: `"overall"`
  - `overviewWindowEndDate`: today

---

## 4) Schema versioning

### 4.1 `schemaVersion`
- Stored at root (`schemaVersion: number`).
- Increment when any stored shape changes.

### 4.2 Loading algorithm
1. Read `habitTracker.appState`.
2. If missing → initialize defaults as `schemaVersion = 1`.
3. If present:
   - Validate minimal structure.
   - If `schemaVersion < currentVersion` → run migrations sequentially.
   - If `schemaVersion > currentVersion` → show error / refuse to load (safety).

### 4.3 Migration pattern
- Migrations are pure transforms: `AppStateVn -> AppStateVn+1`.
- Always preserve user data unless explicitly deprecated.

---

## 5) Migration examples (templates)

### Example: V1 → V2 adds a field

If adding `habit.isArchived`:
- For each habit: set `isArchived = false`.

### Example: V1 → V2 changes `dailyScores` format

If you switch from nested map to array entries:
- Convert each date map into list records.

---

## 6) Data integrity routines (on save/load)

On **load**, run a “repair” pass:
- Remove habits whose `categoryId` no longer exists.
- Remove `dailyScores` for deleted habits.
- Ensure `sortIndex` ranges are continuous (0..N-1).
- Ensure priorities are in {1,2,3}.
- Remove `dayLocks` for dates that have zero scores (optional cleanup).

On **save**, write:
- Single JSON string to `habitTracker.appState`.

Recommended:
- Debounce writes (e.g., 200–500ms) to avoid thrashing localStorage.

---

## 7) Size considerations (future-proofing)

localStorage is usually ~5MB. Habit trackers can grow slowly but indefinitely.

If it ever grows too large:
- Move storage backend to IndexedDB with the same schemaVersion concept.
- Keep `habitTracker.appState` as a small pointer/metadata document.

MVP: localStorage is sufficient.
