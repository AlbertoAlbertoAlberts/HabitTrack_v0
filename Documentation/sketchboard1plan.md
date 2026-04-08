# Sketchboard 1 — Implementation Plan

## Summary of Changes

### Current project types:
1. **Daily** — Single outcome (scale) with optional tags
2. **Event** — Log sporadic occurrences with optional severity

### Target project types:
1. **Daily – Track outcome** (renamed) — **Multiple outcomes** (all sharing the same scale), with optional tags. Analysis: dropdown to pick outcome for tag correlations + cross-outcome correlations.
2. **Daily – Tag only** (NEW) — No scale. Tags only, logged once per day. Analysis: tag frequency, co-occurrence patterns, 30-day dot table (select up to 5 tags).
3. **Daily – Multiple-choice** (NEW) — User-defined choices (single-select or multi-select). Choices can be added/removed anytime. Analysis: 30-day grid (days on X-axis, choices on Y-axis, green dot marks selection). Startdate-adjustable.
4. **Event – Log sporadic occurrences** — Unchanged.

### Cross-cutting addition:
- **Tag categories** — Per-project custom groupings for tags. Defined at project creation, editable later. Purely a UI/organization feature for the tag sidebar and logging form.

---

## Clarifications Resolved

| Question | Answer |
|----------|--------|
| Multiple outcomes: independent scales? | All outcomes share the **same** scale |
| Analysis: cross-outcome correlations? | **Yes** — in addition to per-outcome tag→outcome |
| Tag categories: per-project or global? | **Per-project** |
| Multiple-choice: edit choices after logging? | **Yes** — can add/remove choices anytime |
| Tag-only analysis: co-occurrence? | **Yes** — show co-occurrence patterns |

---

## Architecture Principles

- All new project types are expressed as new `kind` values on `LabProjectConfig` (discriminated union).
- Existing `'daily'` config stays backward-compatible; multi-outcome is opt-in via an `outcomes` array (the existing `outcome` field remains as the primary/legacy field).
- New types get their own log shapes stored in existing `dailyLogsByProject` (for daily) keyed by date.
- Analysis methods are modular; new types get their own method files.
- Migration: existing projects keep working with no data changes; schema version stays at 1 but `LabProjectConfig` union widens.
- **Important**: There are **two** `LabFinding` interfaces in the codebase — the complex one in `domain/types.ts` (with `target`, `window`, `direction`, etc.) is **never imported anywhere**. The simpler one in `domain/lab/analysis/types.ts` (with `tagId`, `method`, `effect`, `sampleSize`) is what all analysis code actually uses. All new finding types must extend the **analysis/types.ts** version.
- **`LabProject.mode` and `LabProjectConfig.kind` must always match** — the discriminated union ensures this. New modes must have matching `kind` values.

---

## Phase 1 — Data Model & Type Definitions

**Goal**: Extend TypeScript types to represent all four project types, multi-outcome daily projects, and tag categories.

### 1.1 Extend `LabProjectMode`

**File**: `app/src/domain/types.ts`

```typescript
// BEFORE
export type LabProjectMode = 'daily' | 'event'

// AFTER
export type LabProjectMode = 'daily' | 'daily-tag-only' | 'daily-multi-choice' | 'event'
```

**Note**: `LabProject.mode` and `config.kind` must always carry the same string value. The `kind` field is the discriminant on `LabProjectConfig`; `mode` is the redundant field on `LabProject` used for quick checks without narrowing. Both must be updated in tandem when creating a project.

### 1.2 Add new config interfaces

**File**: `app/src/domain/types.ts`

```typescript
// --- NEW: Tag-only daily project ---
export interface LabDailyTagOnlyProjectConfig {
  kind: 'daily-tag-only'
  tagsEnabled: true               // always true; exists for consistency
  completion: {
    requireAtLeastOneTag: boolean  // whether day is "complete" only with ≥1 tag
  }
  allowExplicitNoTags?: boolean
}

// --- NEW: Multiple-choice daily project ---
export interface LabMultiChoiceOption {
  id: string               // stable ID (generateId)
  label: string            // display text, e.g. "VEF", "Coding"
  createdAt: ISOTimestamp
  archived?: boolean       // soft-delete when removed after data exists
}

export interface LabDailyMultiChoiceProjectConfig {
  kind: 'daily-multi-choice'
  selectionMode: 'single' | 'multiple'   // only-1 vs many
  options: LabMultiChoiceOption[]         // ordered list of choices
  completion: {
    requireAtLeastOneChoice: boolean
  }
}
```

### 1.3 Extend `LabDailyProjectConfig` for multiple outcomes

**File**: `app/src/domain/types.ts`

Add an `additionalOutcomes` array to the existing `LabDailyProjectConfig`. The primary `outcome` field stays; extra outcomes stored separately. This keeps backward compatibility.

```typescript
export interface LabOutcomeDef {
  id: string               // unique within project, e.g. 'outcome_2'
  name: string
  // scale inherited from project's primary outcome.scale
}

export interface LabDailyProjectConfig {
  kind: 'daily'
  outcome: { /* ...existing... */ }
  additionalOutcomes?: LabOutcomeDef[]  // NEW - extra outcomes sharing same scale
  // ... rest unchanged
}
```

### 1.4 Extend `LabProjectConfig` union

```typescript
export type LabProjectConfig =
  | LabDailyProjectConfig
  | LabEventProjectConfig
  | LabDailyTagOnlyProjectConfig          // NEW
  | LabDailyMultiChoiceProjectConfig      // NEW
```

### 1.5 New log shapes

**File**: `app/src/domain/types.ts`

```typescript
// --- Tag-only daily log (reuses existing LabDailyLog, outcome always undefined) ---
// We reuse LabDailyLog exactly. No changes needed.
// tag-only projects simply never set `outcome`.
// NOTE: `isLabDailyLogComplete` in labValidation.ts currently requires `project.config` 
// to have `completion.requireOutcome`, which only exists on LabDailyProjectConfig.
// Phase 1 must add a guard for config.kind before accessing this field.

// --- Multi-choice daily log ---
export interface LabMultiChoiceLog {
  date: ISODate
  updatedAt: ISOTimestamp
  selectedOptionIds: string[]   // IDs from project config options
  note?: string
}
```

### 1.6 Extend `LabDailyLog` for multiple outcomes

```typescript
export interface LabDailyLog {
  date: ISODate
  updatedAt: ISOTimestamp
  outcome?: number
  additionalOutcomes?: Record<string, number>  // NEW: outcomeId → value
  tags: LabTagUse[]
  note?: string
  noTags?: boolean
}
```

### 1.7 Extend `LabState`

```typescript
export interface LabState {
  // ... existing fields ...
  multiChoiceLogsByProject: Record<LabProjectId, Record<ISODate, LabMultiChoiceLog>>  // NEW
}
```

### 1.8 Tag categories

**File**: `app/src/domain/types.ts`

```typescript
export interface LabTagCategory {
  id: string              // generateId()
  name: string
  sortIndex: number
  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
}
```

Extend `LabTagDef`:

```typescript
export interface LabTagDef {
  // ... existing fields ...
  group?: string              // existing — free-text input with datalist suggestions, will remain for backward compat
  categoryId?: string         // NEW — reference to LabTagCategory.id
}
```

**Note on `group` → `categoryId` migration**: The existing `group` field is a free-text input with `<datalist>` autocomplete suggestions (not a dropdown). Since `group` is purely cosmetic text and `categoryId` is a proper foreign key, both fields will coexist. The `group` field is also used in analysis to create virtual `group:groupName` findings for event projects. The new `categoryId` is purely a UI grouping concern and does NOT replace `group` in analysis. Both should remain.

Extend `LabState`:

```typescript
export interface LabState {
  // ... existing fields ...
  tagCategoriesByProject?: Record<LabProjectId, Record<string, LabTagCategory>>
  tagCategoryOrderByProject?: Record<LabProjectId, string[]>
}
```

---

### Phase 1 — Review Checklist ✅

- [x] `npm run typecheck` (`tsc --noEmit`) passes — no compile errors
- [x] All existing tests pass: `npm run test`
- [x] Grep for every reference to `LabProjectMode` and `LabProjectConfig` — verify all switch/if-else blocks have exhaustive handling or safe fallbacks for new values
- [x] Grep for every reference to `config.kind` — check that comparisons like `config.kind === 'daily'` still narrow correctly and new kinds don't fall through unhandled
- [x] Check `storageService.ts` `repairLabState()` — not yet changed but must not crash on old data that lacks new fields
- [x] Verify the `LabFinding` type in `domain/types.ts` — it is **unused** (dead code). Consider removing it to avoid confusion with the real `LabFinding` in `analysis/types.ts`
- [x] Verify discriminated union narrowing works: create a quick scratch test that switches on `config.kind` for all four values
- [x] No existing functionality broken: load app, open LAB page, verify existing daily and event projects still render

**Review notes**:
- Fixed `createEmptyLabState()` and `repairLabState()` in `storageService.ts` — added missing required `multiChoiceLogsByProject: {}` field and full repair logic for multi-choice logs
- Fixed `testHelpers.ts` — added missing `multiChoiceLogsByProject: {}` to test state
- Fixed `ProjectDialog.tsx` — narrowed mode type was incompatible with widened `LabProjectMode`; now explicitly checks for 'daily'/'event' before passing to useState
- Dead `LabFinding` type in `domain/types.ts` confirmed unused (along with `LabFindingsCache`, `LabFindingDirection`, `LabFindingConfidence`) — left for separate cleanup
- All existing `config.kind === 'daily'` / `project.mode === 'event'` checks are safe: existing projects still match, and new modes can't be created yet (no UI). Runtime adjustments deferred to their respective phases (4, 6, 7, 8)

---

## Phase 2 — Actions & State Management

**Goal**: CRUD operations for new project types, multi-outcome logging, multi-choice logging, tag category management.

### 2.1 Update `addLabProject`

**File**: `app/src/domain/lab/actions/labProjects.ts`

- Accept new `mode` values: `'daily-tag-only'` and `'daily-multi-choice'`
- Initialize empty `multiChoiceLogsByProject[projectId]` for multi-choice projects
- For daily-tag-only projects, initialize `dailyLogsByProject[projectId]` (reuses existing daily log structure)
- Validate config matches mode

### 2.2 Update `updateLabProject`

**File**: `app/src/domain/lab/actions/labProjects.ts`

- Allow updating `additionalOutcomes` on daily projects
- Allow updating `options` and `selectionMode` on multi-choice projects
- When a multi-choice option is "removed": set `archived: true` instead of deleting (preserves historical data)
- Validate: option labels must be non-empty, unique (case-insensitive)

### 2.3 New action: `setLabMultiChoiceLog`

**File**: `app/src/domain/lab/actions/labMultiChoiceLogs.ts` (NEW file)

```typescript
export function setLabMultiChoiceLog(
  state: AppStateV1,
  projectId: LabProjectId,
  date: ISODate,
  data: { selectedOptionIds: string[]; note?: string }
): AppStateV1

export function deleteLabMultiChoiceLog(
  state: AppStateV1,
  projectId: LabProjectId,
  date: ISODate
): AppStateV1
```

**Validation**:
- Project must exist and be `daily-multi-choice`
- `selectedOptionIds` must reference non-archived options in project config
- If `selectionMode === 'single'`, max 1 selected

### 2.4 Update `setLabDailyLog` for multi-outcome

**File**: `app/src/domain/lab/actions/labDailyLogs.ts`

- Accept optional `additionalOutcomes: Record<string, number>` in the data parameter
- Validate each outcome ID exists in `project.config.additionalOutcomes`
- Validate values are within the project's shared scale (`project.config.outcome.scale`)
- **Guard**: Only allow `additionalOutcomes` when `project.config.kind === 'daily'` (not for `daily-tag-only`)
- **Guard**: `setLabDailyLog` must also accept calls from `daily-tag-only` projects (outcome=undefined, tags only). Add a mode check so it doesn't reject tag-only logs when `requireOutcome` is not in the config.

### 2.5 Tag category actions

**File**: `app/src/domain/lab/actions/labTagCategories.ts` (NEW file)

```typescript
export function addLabTagCategory(
  state: AppStateV1,
  projectId: LabProjectId,
  name: string
): AppStateV1

export function updateLabTagCategory(
  state: AppStateV1,
  projectId: LabProjectId,
  categoryId: string,
  updates: { name?: string; sortIndex?: number }
): AppStateV1

export function deleteLabTagCategory(
  state: AppStateV1,
  projectId: LabProjectId,
  categoryId: string
): AppStateV1

export function reorderLabTagCategories(
  state: AppStateV1,
  projectId: LabProjectId,
  orderedIds: string[]
): AppStateV1
```

- Deleting a category clears `categoryId` from all tags in that category (does NOT delete the tags)
- Category names must be unique within a project

### 2.6 Update action barrel export

**File**: `app/src/domain/lab/actions/index.ts`

- Re-export new files

### 2.7 Register actions in appStore

**File**: `app/src/domain/store/appStore.ts`

- Add new action wrappers for `setLabMultiChoiceLog`, `deleteLabMultiChoiceLog`, tag category actions
- Add `isLabTagCategoryInUse` selector

---

### Phase 2 — Review Checklist ✅

- [x] `npm run typecheck` passes
- [x] All existing tests pass
- [x] Write unit tests for each new action:
  - `setLabMultiChoiceLog` — valid single-select, valid multi-select, invalid option ID, archived option rejection
  - `setLabDailyLog` with `additionalOutcomes` — valid & out-of-range rejection
  - `addLabTagCategory`, `deleteLabTagCategory` — name uniqueness, deletion clears tag refs
  - `updateLabProject` — adding/archiving multi-choice options
- [x] Verify existing `setLabDailyLog` still works unchanged for single-outcome projects
- [x] Verify `deleteLabProject` cascades: cleans up `multiChoiceLogsByProject` for multi-choice projects, and `tagCategoriesByProject`/`tagCategoryOrderByProject`
- [x] **Pre-existing bug**: `deleteLabProject` currently does NOT clean up `absenceMarkersByProject`. Fix this in the same phase — add cleanup for `absenceMarkersByProject[projectId]`
- [x] Manual test: create each new project type via direct action calls (not yet via UI)

**Review notes**:
- 82 tests pass (50 existing + 32 new in `phase2Actions.test.ts`)
- TypeScript compiles cleanly with `tsc --noEmit`
- `deleteLabProject` now cascades cleanup to: `multiChoiceLogsByProject`, `absenceMarkersByProject`, `tagCategoriesByProject`, `tagCategoryOrderByProject`
- `setLabDailyLog` accepts both `'daily'` and `'daily-tag-only'` projects; rejects `additionalOutcomes` on tag-only projects
- `setLabMultiChoiceLog` validates: project must be `daily-multi-choice`, option IDs must be active (non-archived), single-select enforces max 1
- `updateLabProject` validates: multi-choice option labels non-empty + unique (case-insensitive among active); additional outcome names non-empty + unique
- Tag category CRUD: name uniqueness enforced, deletion clears `categoryId` from affected tags, `isLabTagCategoryInUse` selector works
- `isLabDailyLogComplete` returns `false` for `daily-tag-only` — intentionally deferred to Phase 9.5
- No issues or inconsistencies found

---

## Phase 3 — Storage, Migration & Persistence

**Goal**: Ensure new data shapes persist correctly and old data loads cleanly.

### 3.1 Update `createEmptyLabState`

**File**: `app/src/persistence/storageService.ts`

- Add `multiChoiceLogsByProject: {}` to the default empty state
- Add `tagCategoriesByProject: {}`, `tagCategoryOrderByProject: {}` to default

### 3.2 Update `repairLabState`

**File**: `app/src/persistence/storageService.ts`

- Add fallback for `multiChoiceLogsByProject` (default `{}`)
- Add fallback for `tagCategoriesByProject`, `tagCategoryOrderByProject` (default `{}`)
- Repair each `LabMultiChoiceLog` entry: validate `selectedOptionIds` is an array of strings
- Handle `additionalOutcomes` on `LabDailyLog`: default `undefined` if missing (safe)

### 3.3 Update Supabase sync (if applicable)

**File**: `app/src/persistence/supabaseSync.ts`

- Ensure new state slices are included in sync payload
- No schema migration needed on Supabase side (full JSON blob sync)

### 3.4 CSV Export updates

**File**: `app/src/domain/utils/csvExport.ts`

- Add export support for `daily-tag-only` projects (date + tag columns)
- Add export support for `daily-multi-choice` projects (date + each option as a column with 0/1 values)
- Multi-outcome daily projects: each outcome as its own column in export

---

### Phase 3 — Review Checklist ✅

- [x] `npm run typecheck` passes
- [x] All existing tests (including persistence tests in `app/src/persistence/__tests__/`) pass
- [x] Test: load app with existing localStorage data → new fields default gracefully, no crash
- [x] Test: create new project types, reload page → data persists correctly
- [x] Test: export CSV for each new project type → correct columns and values
- [x] Test: `repairLabState` handles corrupted/missing fields for new slices
- [x] Verify Supabase sync round-trip (if Supabase is configured)

**Review notes**:
- TypeScript compiles cleanly, all 82 tests pass (4 files, 0 failures)
- `createEmptyLabState()` now includes `tagCategoriesByProject: {}` and `tagCategoryOrderByProject: {}`
- `repairLabState()` repairs: `additionalOutcomes` on daily logs (coerces to `Record<string, number>`), `tagCategoriesByProject` (validates name/sortIndex/timestamps), `tagCategoryOrderByProject` (validates string arrays)
- Supabase sync: `computeDataRichness` and `summarizeAppState` now count `multiChoiceLogsByProject`; `SyncStatus.localStateSummary` type extended with `labMultiChoiceLogsCount`
- CSV export: `buildDateIndexedCsv` handles all 3 daily types — additional outcome columns for multi-outcome daily projects, tag columns for tag-only, option 0/1 columns for multi-choice
- **Bug fixed**: `ExportCsvDialog.handleDownload` only filtered for `mode === 'daily'` — new `daily-tag-only` and `daily-multi-choice` projects were silently excluded. Fixed to include all date-indexed project modes.
- **Cleanup**: `LabTagCategory` import in `storageService.ts` changed from inline `import()` type to proper top-level import

---

## Phase 4 — Project Creation & Editing UI

**Goal**: Update `ProjectDialog` to support all four project types, multi-outcome config, and multi-choice option management.

### 4.1 Redesign ProjectDialog mode selector

**File**: `app/src/pages/LabPage/components/ProjectDialog.tsx`

Currently: radio toggle between `daily` and `event`.

**New**: 4-option selector (radio group or segmented control):
1. **Daily – Track outcome** (`daily`)
2. **Daily – Tag only** (`daily-tag-only`)
3. **Daily – Multiple-choice** (`daily-multi-choice`)
4. **Event** (`event`)

Mode is still immutable after creation (greyed out in edit mode).

### 4.2 Daily – Track outcome: multi-outcome form

When mode is `daily`:
- Existing fields remain: outcome name, scale min/max, tags toggle, exposure window
- **New section**: "Additional outcomes" — a list with + button
  - Each additional outcome: just a name (scale inherited from primary)
  - Can remove additional outcomes
  - MAX ~10 additional outcomes (practical limit)
  - Edit: can add/remove additional outcomes on existing projects

### 4.3 Daily – Tag only: simplified form

When mode is `daily-tag-only`:
- Project name (required)
- No outcome fields
- No scale fields
- Tag-related options: `requireAtLeastOneTag` toggle, `allowExplicitNoTags` toggle
- Tags are managed separately in the tag section (same as current)

### 4.4 Daily – Multiple-choice: options builder

When mode is `daily-multi-choice`:
- Project name (required)
- **Selection mode**: radio — "Single choice" or "Multiple choices"
- **Options list**:
  - Inline editable list of options (text inputs)
  - "+" to add option
  - "×" to remove/archive option (if data logged, show warning "option will be archived, not deleted")
  - Drag-to-reorder (optional v1: skip, just ordered by creation)
  - Minimum 2 options required

### 4.5 ProjectDialog CSS updates

**File**: `app/src/pages/LabPage/components/ProjectDialog.module.css`

- Adjust mode selector layout for 4 options (may need 2×2 grid or vertical list instead of horizontal radio)
- Options list styling (input rows with add/remove buttons)
- Additional outcomes list styling

---

### Phase 4 — Review Checklist ✅

- [x] `npm run typecheck` passes
- [x] Open ProjectDialog → all 4 modes render correctly
- [x] Create a daily project with 3 additional outcomes → project created, outcomes stored in config
- [x] Create a tag-only project → project created with `daily-tag-only` mode
- [x] Create a multi-choice project with 4 options, single-select mode → project created
- [x] Create a multi-choice project with multi-select mode → project created
- [x] Edit an existing daily project → mode is locked, but can add additional outcomes
- [x] Edit multi-choice project → can add/remove options
- [x] Validation: empty project name rejected, multi-choice with <2 options rejected
- [x] Edit existing (pre-change) daily project → works correctly, no additional outcomes shown initially
- [x] Event project creation → unchanged, works as before

**Review notes**:
- TypeScript compiles cleanly, all 82 tests pass (4 files, 0 failures)
- Mode selector: 2×2 card grid in create mode with label + description per card; locked (greyed-out) display in edit mode
- Additional outcomes: add/remove list with max 10 cap, validated for non-empty + unique names (case-insensitive)
- Multi-choice options: inline editable list, min 2 active required, archive-on-remove for existing projects (preserves historical data), label uniqueness enforced
- Tag-only: simplified form with `requireAtLeastOneTag` and `allowExplicitNoTags` toggles only
- Event: completely unchanged from previous implementation
- `isFormValid()` disables submit when: empty name, multi-choice <2 active options, empty/duplicate labels, empty/duplicate additional outcome names
- CSS module classes fully aligned — all referenced classes defined, no orphaned styles
- `addLabProject` action correctly initializes per-mode stores (`multiChoiceLogsByProject` only for multi-choice; `dailyLogsByProject`, `tagsByProject` for all)
- Issues in LabPage metadata display, DailyLabWidget, and FindingsView are expected — explicitly deferred to Phases 5, 6, 8, 9 per the plan. No new modes can crash existing UI (they just show blank/default content).

---

## Phase 5 — Tag Category Management UI

**Goal**: Allow users to define and manage tag categories per project, and use them to organize tags in the sidebar and logging form.

**Note**: Tag categories are a **UI-only grouping** mechanism. They do NOT replace the existing `group` field used by event project analysis (virtual `group:` findings). The `categoryId` field organizes tags visually in the sidebar and logging form, while `group` continues to drive group-based analysis.

### 5.1 Tag category section in LabPage sidebar

**File**: `app/src/pages/LabPage/LabPage.tsx`

- In the tags area sidebar, group tags by `categoryId`
- Tags without a category shown under "Uncategorized" section
- Each category section is collapsible
- "Manage categories" button in tags menu (LabMenu)
- **For `daily-multi-choice` projects**: the tags area should be **completely hidden** (not just disabled), since these projects don't use tags at all

### 5.2 TagCategoryDialog (NEW component)

**File**: `app/src/pages/LabPage/components/TagCategoryDialog.tsx` (NEW)

- CRUD for categories: name, order
- Simple list with add/edit/delete functionality
- Drag-to-reorder (or up/down buttons)

### 5.3 Update TagDialog

**File**: `app/src/pages/LabPage/components/TagDialog.tsx`

- **Add** a `categoryId` dropdown below the existing `group` field
- The existing `group` free-text input stays unchanged (it is used by analysis for group-based findings in event projects)
- Category dropdown options: existing project categories + "(none)"
- Both fields are independent: `group` for analysis grouping, `categoryId` for UI organization

### 5.4 Tag categories in logging form

- When logging tags for any daily project type, tags are grouped by category in the tag selector
- Categories shown as collapsible sections or visual group headers

---

### Phase 5 — Review Checklist ✅

- [x] `npm run typecheck` passes
- [x] Create 3 tag categories for a project → categories appear in sidebar
- [x] Assign tags to categories → tags grouped correctly
- [x] Delete a category → tags moved to "Uncategorized"
- [x] Open TagDialog → category dropdown shows project's categories
- [x] Tags with legacy `group` field still display correctly
- [x] Reorder categories → order persists after reload

**Review notes**:
- TypeScript compiles cleanly, all 82 tests pass (4 files, 0 failures)
- `TagCategoryDialog`: full CRUD with add/edit (inline)/delete, up/down reorder buttons, duplicate name validation (case-insensitive), keyboard support (Enter to save, Escape to cancel edit)
- `TagDialog`: `categoryId` dropdown shown only when project has categories; both `group` (free-text for analysis) and `categoryId` (dropdown for UI organization) coexist independently; properly resets on close
- `LabMenu`: added optional `onManageCategories` prop; "Kategorijas" menu item shown only for `tags` context when callback provided
- `LabPage` tag grouping: tags grouped by `categoryId` with collapsible section headers (arrow + name + count); tags without a category shown under "Uncategorized"; empty categories (no tags assigned) excluded from display
- **`daily-multi-choice` projects**: tags area completely hidden (not just disabled)
- **Bug fixed**: drag-and-drop tag reordering used per-group `index` instead of global `activeTags` index, causing incorrect reorder when categories were active. Fixed to use `activeTags.indexOf(tag)` for global position.
- **Bug fixed**: "Uncategorized" section header rendered collapse arrow but clicking did nothing (guard prevented it). Fixed to use `__uncategorized__` key for collapse state so all sections are collapsible.
- CSS: `.categorySection`, `.categoryHeader`, `.categoryArrow`, `.categoryLabel`, `.categoryCount` styles added; uppercase label, subtle border-bottom, hover color transition

---

## Phase 6 — Daily Logging UI for New Types

**Goal**: Logging interfaces for tag-only and multi-choice projects, and multi-outcome daily logging.

### 6.1 Multi-outcome logging in LabPage

**File**: `app/src/pages/LabPage/LabPage.tsx` (or new component)

**Important**: There is currently **no daily logging form** in LabPage. Only `EventLogList` exists for event projects. Daily logs are created programmatically via `setLabDailyLog` but have no UI. This phase must create the daily logging UI from scratch.

For multi-outcome daily projects:
- Show all outcome sliders/inputs (primary + additional) vertically stacked
- Each outcome labeled with its name
- All share the same scale (min/max from primary outcome)
- Data saved via `setLabDailyLog` including `additionalOutcomes`

### 6.2 DailyLogForm component (NEW or extracted)

**File**: `app/src/pages/LabPage/components/DailyLogForm.tsx` (NEW)

A unified daily logging form that adapts to project type:

- **`daily` (Track outcome)**: Outcome slider(s) + tag checkboxes + note
- **`daily-tag-only`**: Tag checkboxes only + note + "no tags" toggle
- **`daily-multi-choice`**: Option selector (radio group for single-select, checkbox group for multi-select) + note

This component handles:
- Date selector (default: today)
- Loading existing log for selected date
- Save/update functionality
- "Complete" indicator (green checkmark when completion rules are met)

### 6.3 Multi-choice logging

Within `DailyLogForm`:
- If `selectionMode === 'single'`: radio buttons (only one selectable)
- If `selectionMode === 'multiple'`: checkboxes
- Only non-archived options shown
- On save: dispatches `setLabMultiChoiceLog`

### 6.4 Tag-only logging

Within `DailyLogForm`:
- Tag checkboxes grouped by category (if categories exist)
- Intensity pickers for tags with intensity enabled
- "No tags today" toggle if `allowExplicitNoTags` is enabled
- On save: dispatches `setLabDailyLog` with `outcome: undefined`

### 6.5 CSS for DailyLogForm

**File**: `app/src/pages/LabPage/components/DailyLogForm.module.css` (NEW)

---

### Phase 6 — Review Checklist ✅

- [x] `npm run typecheck` passes
- [x] Open a daily project with 3 outcomes → all outcome sliders visible, can set values, save
- [x] Open tag-only project → tag checkboxes shown, no outcome slider, can save
- [x] Open multi-choice (single) project → radio buttons, only one selectable, save works
- [x] Open multi-choice (multi) project → checkboxes, multiple selectable, save works
- [x] Change date → loads existing log for that date correctly
- [x] Save, reload page → logged data persists
- [x] Existing daily projects (single outcome) → logging form works identically to before
- [x] Archived multi-choice options → not shown in selector but historical data preserved

**Review notes**:
- TypeScript compiles cleanly, all 82 tests pass (4 files, 0 failures)
- `DailyLogForm` — unified component with 3 sub-forms: `DailyOutcomeForm`, `DailyTagOnlyForm`, `DailyMultiChoiceForm`
- Date navigation: prev/next/today with future-date guard (`selectedDate >= today` disables next)
- Loads existing log on date change, pre-populates all fields; clears on empty date
- `DailyOutcomeForm`: primary + additional outcome number inputs, tag checkboxes with category grouping, intensity pickers, note
- `DailyTagOnlyForm`: tag checkboxes only + "no tags" toggle + note; empty state when no tags defined
- `DailyMultiChoiceForm`: radio (single-select) or checkbox (multi-select) for active options, note; empty state when all archived
- **Bug fixed**: radio buttons used `onChange` which doesn't fire when clicking an already-selected radio to deselect it. Changed single-select to use `onClick` for toggle behavior.
- **Cleanup**: removed unused `tags` prop from `TagSelector` sub-component — was passed but never destructured or used
- Tag category grouping reuses same logic as LabPage sidebar (via `useTagGroups` hook)
- LabPage integration: `DailyLogForm` rendered in tags area for `daily`/`daily-tag-only` projects (below tag sidebar), and as sole content in tags area for `daily-multi-choice` projects. Also rendered for `daily` projects with tags disabled.
- CSS module: 40 classes, all referenced ↔ defined (no orphans, no missing)
- No lint errors, no console warnings

---

## Phase 7 — Analysis Engine for New Types

**Goal**: Analysis methods and dataset builders for tag-only, multi-choice, and multi-outcome projects.

### 7.1 Tag-only analysis methods

**File**: `app/src/domain/lab/analysis/tagOnlyMethods.ts` (NEW)

Methods:

**T1: Tag Frequency**
- Per-tag: count of days present / total logged days
- Returns: rate [0..1] per tag

**T2: Tag Co-occurrence**
- For every pair of tags (present in ≥5 logs): percentage of days both appear together
- Report top N co-occurring pairs
- Effect size: Jaccard similarity coefficient or simple co-occurrence rate

**T3: Tag 30-Day Dot Table Data**
- Not a "finding" per se — returns raw presence data for up to 5 user-selected tags over a date range
- Output: `Record<tagId, Record<ISODate, boolean>>` for the selected tags within the 30-day window
- This is more of a UI-level data builder than an analysis method; may live in a utility

### 7.2 Multi-choice analysis methods

**File**: `app/src/domain/lab/analysis/multiChoiceMethods.ts` (NEW)

Methods:

**MC1: Choice Frequency**
- Per-option: count of days selected / total logged days
- Returns: rate [0..1] per option

**MC2: 30-Day Grid Data**
- Returns raw data: `Record<optionId, Record<ISODate, boolean>>` for the date window
- UI uses this to render the dot table

### 7.3 Multi-outcome analysis methods

**File**: `app/src/domain/lab/analysis/multiOutcomeMethods.ts` (NEW)

**Note**: New methods must conform to the `LabFinding` interface in `analysis/types.ts` (the one with `tagId`, `method`, `effect`, `sampleSize`, `summary`). For cross-outcome findings, the `tagId` field can be repurposed as `outcomeId` (or a composite key like `outcome:energy_vs_mood`), since there's no tag involved. Alternatively, extend the finding interface with an optional `targetOutcomeId` — but keep backward compatibility.

Methods:

**MO1: Cross-outcome correlation**
- Pearson correlation between each pair of outcomes
- Requires ≥10 days with both outcomes logged
- Effect: correlation coefficient [-1..1]
- Confidence: high if n≥30, medium if n≥15, low otherwise
- Finding `tagId`: use a composite key like `outcome:<id1>_vs_<id2>` to identify the pair

**MO2: Per-outcome tag correlation**
- Reuses existing daily methods (presence-effect, lag, rolling, dose-response, regime)
- But parameterized by outcome ID instead of hardcoded to `project.config.outcome`
- **Implementation detail**: The existing `buildDailyDataset` puts `log.outcome` into `row.outcome`. For multi-outcome, either:
  - (a) Build separate datasets per outcome (where `row.outcome` = the selected outcome's value), OR
  - (b) Extend `DailyDatasetRow` with `additionalOutcomes: Record<string, number>` and parameterize methods
- Option (a) is simpler and avoids changing the method interfaces
- The runner runs all methods once per outcome, tagging each finding with which outcome it belongs to

### 7.4 Dataset builders for new types

**File**: `app/src/domain/lab/analysis/datasetBuilders.ts` (extend)

- `buildTagOnlyDataset(state, projectId)` → `{ rows: { date, tags }[], coverage }`
- `buildMultiChoiceDataset(state, projectId)` → `{ rows: { date, selectedOptionIds }[], coverage }` — reads from `state.lab.multiChoiceLogsByProject` (NOT `dailyLogsByProject`)
- `buildDailyDataset` for multi-outcome: does **NOT** already work — currently reads `log.outcome` as a single number. Must be updated to also read `log.additionalOutcomes`. For MO2 (per-outcome tag analysis), the recommended approach is `buildDailyDatasetForOutcome(state, projectId, outcomeId)` which builds a standard `DailyDataset` but uses the specified outcome's value as `row.outcome`.

### 7.5 Update analysis runner

**File**: `app/src/domain/lab/analysis/runner.ts`

- Dispatch to new methods based on `project.mode`:
  - `'daily-tag-only'` → tag-only methods (T1, T2)
  - `'daily-multi-choice'` → multi-choice methods (MC1)
  - `'daily'` → existing methods + MO1/MO2 if `additionalOutcomes` present
  - `'event'` → unchanged

### 7.6 Update cache fingerprint

**File**: `app/src/domain/lab/analysis/cache.ts`

- Include `additionalOutcomes`, `multiChoiceLogsByProject`, and new config fields in fingerprint computation

---

### Phase 7 — Review Checklist ✅

- [x] `npm run typecheck` passes
- [x] All existing analysis tests pass (existing daily + event methods unchanged)
- [x] Write tests for new methods:
  - Tag frequency: 10 days, 3 tags, verify rates
  - Tag co-occurrence: verify pairs with co-occurrence rates
  - Multi-choice frequency: verify option rates
  - Cross-outcome correlation: known correlated/uncorrelated data → correct coefficients
  - Per-outcome tag correlation: verify it runs for each outcome independently
- [x] Test: existing daily project with no additional outcomes → analysis unchanged
- [x] Test: cache invalidation when multi-choice log changes
- [x] Test: minimum data thresholds respected for new methods

**Review notes**:
- TypeScript compiles cleanly, all 111 tests pass (5 files: 82 existing + 29 new in `phase7Analysis.test.ts`)
- Fixed unused `DailyDatasetRow` import in `multiOutcomeMethods.ts`
- `tagFrequency`: correctly computes per-tag rates, handles empty datasets
- `tagCoOccurrence`: Jaccard similarity correct (1.0 for perfectly co-occurring tags), filters tags with <5 occurrences, returns top 20 pairs
- `choiceFrequency`: correctly computes per-option selection rates
- `crossOutcomeCorrelation`: Pearson r≈1 for perfectly correlated data, r≈-1 for inverse, correctly enforces ≥10 day minimum
- `perOutcomeTagCorrelation`: reuses existing daily methods with `outcomeId::method` prefixed names, correctly passes `outcomeId` in rawData
- `buildTagOnlyDataset`: only accepts `daily-tag-only` projects, outputs boolean tags map
- `buildMultiChoiceDataset`: reads from `multiChoiceLogsByProject`, only accepts `daily-multi-choice` projects
- `buildDailyDatasetForOutcome`: correctly uses `additionalOutcomes[outcomeId]` as `row.outcome`, skips days where outcome is missing
- Cache fingerprint bumped to v5: includes `additionalOutcomes` in daily log hashes, handles `daily-tag-only` (via `dailyLogsByProject`) and `daily-multi-choice` (via `multiChoiceLogsByProject`) separately
- Runner: dispatches tag-only → `tagFrequency` + `tagCoOccurrence`; multi-choice → `choiceFrequency`; daily with `additionalOutcomes` → MO1 + MO2 in addition to standard methods
- Guardrails updated to pass through frequency/co-occurrence/cross-outcome findings without the 0.1 minimum-effect filter
- No issues or inconsistencies found

---

## Phase 8 — Analysis Display UI for New Types

**Goal**: UI components for displaying results of new analysis types.

### 8.1 DotTable component (NEW, shared)

**File**: `app/src/pages/LabPage/components/DotTable.tsx` (NEW)

A reusable 30-day dot table component used by both tag-only and multi-choice analysis:

**Props**:
- `data: Record<string, Record<ISODate, boolean>>` — row labels mapped to date→present
- `labels: Record<string, string>` — rowKey → display label
- `startDate?: ISODate` — start of 30-day window (default: 30 days back from today)
- `onStartDateChange?: (date: ISODate) => void`

**Rendering**:
- X-axis: 30 dates (scrollable if needed on mobile)
- Y-axis: row labels (tags or choices)
- Cell: green glowing dot if `true`, empty if `false` or missing
- Date navigation: user can adjust start date; resets when page is closed (ephemeral state)
- If less than 30 days logged: current date is last, preceding empty days shown

### 8.2 TagOnlyFindingsView (NEW component)

**File**: `app/src/pages/LabPage/components/TagOnlyFindingsView.tsx` (NEW)

Tabs:
- **Frequency** — ranked list of tags by frequency (bar chart or sorted list)
- **Co-occurrence** — top co-occurring tag pairs with rates
- **30-Day Table** — DotTable with tag selector (user picks up to 5 tags from dropdown/checkboxes)

### 8.3 MultiChoiceFindingsView (NEW component)

**File**: `app/src/pages/LabPage/components/MultiChoiceFindingsView.tsx` (NEW)

Tabs:
- **Overview** — choice frequencies (bar chart or summary)
- **30-Day Table** — DotTable showing all choices. Date start selector. Green glowing dots.

### 8.4 Update FindingsView for multi-outcome

**File**: `app/src/pages/LabPage/components/FindingsView.tsx`

- If project has `additionalOutcomes`:
  - Add **outcome selector dropdown** at the top of the analysis area
  - Default: primary outcome
  - Selecting an outcome filters findings to that outcome's correlations
  - Add a **"Cross-outcome"** tab showing MO1 correlation matrix
- If project has no additional outcomes: unchanged behavior

### 8.5 Update LabPage to route to correct FindingsView

**File**: `app/src/pages/LabPage/LabPage.tsx`

- Render `TagOnlyFindingsView` when active project is `daily-tag-only`
- Render `MultiChoiceFindingsView` when active project is `daily-multi-choice`
- Render `FindingsView` for `daily` and `event` (existing)

### 8.6 CSS for new components

**Files**:
- `DotTable.module.css` — grid layout, green glow dot styling, date header rotation, responsive scroll
- `TagOnlyFindingsView.module.css`
- `MultiChoiceFindingsView.module.css`

---

### Phase 8 — Review Checklist ✅

- [x] `npm run typecheck` passes
- [x] Tag-only project: Frequency tab shows correct rates
- [x] Tag-only project: Co-occurrence tab shows pairs
- [x] Tag-only project: 30-Day Table tab → select 3 tags → dots render correctly
- [x] Multi-choice project: 30-Day Table shows all options as rows, correct dots
- [x] Multi-choice project: change start date → table shifts, resets on page leave
- [x] Multi-outcome daily project: outcome dropdown visible, switching shows different findings
- [x] Multi-outcome daily project: Cross-outcome tab shows correlation matrix
- [x] Single-outcome daily project: no dropdown, no Cross-outcome tab — behavior unchanged
- [x] Event project: completely unchanged
- [x] Responsive: dot table scrolls horizontally on narrow screens
- [x] Green glow dot styling matches design expectations

**Review notes**:
- TypeScript compiles cleanly, all 111 tests pass (5 files, 0 failures)
- **Bug fixed**: `DotTable.tsx` — React Fragment inside `rowKeys.map()` was missing a `key` prop, causing a React warning. Changed bare `<>` to `<Fragment key={key}>` with proper import.
- **Bug fixed**: `TagOnlyFindingsView.tsx` — `notEnoughData` condition blocked ALL tabs including the 30-Day Table, which uses raw dataset data (not findings). This was inconsistent with `MultiChoiceFindingsView` which correctly renders the dot table independently. Fixed to check `notEnoughData` per-tab (frequency and co-occurrence only), allowing the dot table to render even with < 5 days of data.
- `DotTable`: reusable 30-day grid with date navigation, weekend dimming, responsive scroll, green glow dots. Header shows month abbreviation on 1st of month, day number otherwise.
- `TagOnlyFindingsView`: 3 tabs (Frequency, Co-occurrence, 30-Day Table) with DataMaturityView. Tag selector for dot table limited to 5 tags. Frequency shows ranked bar chart, co-occurrence shows Jaccard pairs.
- `MultiChoiceFindingsView`: 2 tabs (Overview, 30-Day Table). Overview shows choice frequency bars. Dot table shows all active options with date navigation. Archived options excluded from display.
- `FindingsView`: outcome selector dropdown shown when `hasAdditionalOutcomes`; hidden on Cross-outcome tab. Cross-outcome tab shows `CrossOutcomeTable` with Pearson r values, color-coded. Per-outcome findings filtered by `selectedOutcomeId` using method prefix (`outcomeId::method`).
- `LabPage` routing: `FindingsView` for `daily`/`event`, `TagOnlyFindingsView` for `daily-tag-only`, `MultiChoiceFindingsView` for `daily-multi-choice`. All wrapped in `LabErrorBoundary`.
- CSS: all referenced classes defined in their respective modules, no orphans. Responsive styles for narrow screens in all 3 new CSS files.
- No lint errors, no console warnings

---

## Phase 9 — Integration, Polish & Edge Cases ✅

**Goal**: End-to-end testing, edge case handling, and UI polish.

### 9.1 LabPage sidebar: project type badges

Update the project card badges:
- `daily` → "Daily – Outcome"
- `daily-tag-only` → "Daily – Tags"
- `daily-multi-choice` → "Daily – Multi-choice"
- `event` → "Event"

### 9.2 Data maturity for new types

**File**: `app/src/pages/LabPage/components/DataMaturityView.tsx`

- Support all project types: count logged days for daily types, events for event type
- Tag-only: days with at least 1 tag (or explicit noTags)
- Multi-choice: days with at least 1 selection

### 9.3 Empty states for new types

Ensure proper "No data yet" messages for each new project type:
- Tag-only: "Start logging tags to see frequency analysis"
- Multi-choice: "Start logging choices to see the 30-day table"

### 9.4 Seed data for new types (optional, for development)

**File**: `app/src/domain/lab/seed/` (new seed files)

- Tag-only seed: "Morning symptoms" project with 5 tags, 30 days of dummy data
- Multi-choice seed: "Day type" project with options [VEF, Coding, Haltūra, Day-off, Family, Mix], 30 days

### 9.5 Update `labValidation.ts`

**File**: `app/src/domain/utils/labValidation.ts`

- `isLabDailyLogComplete`: handle `daily-tag-only` mode (no outcome check)
- New: `isLabMultiChoiceLogComplete`: check if at least one choice selected (if required)

### 9.6 Edge cases

- Multi-choice with all options archived → show notice "All options archived, add new ones"
- Tag-only project with no tags defined → show notice "Add tags to start logging"
- Multi-outcome project: navigating additional outcomes in CSV export
- Deleting a project cleans up all related data (multi-choice logs, tag categories)

---

### Phase 9 — Review Checklist

- [x] `npm run typecheck` passes
- [x] All existing + new tests pass (111/111)
- [ ] Full manual test for each project type:
  1. Create project → configure → add tags/options → log 3 days of data → view analysis → export CSV → archive project
  2. Edit project settings → verify changes reflected
  3. Reload page → all data persists
- [ ] Edge case: create multi-choice project, log data, archive an option, verify table still shows historical data
- [ ] Edge case: create tag-only project with no tags → proper empty state
- [ ] Edge case: existing users upgrade → old projects unaffected, new fields default safely
- [ ] Console: no warnings or errors during normal operation
- [ ] Mobile/responsive: all new UI elements work at narrow widths

**Review notes (automated):**
- **Bug fixed**: `DatasetDebugView.tsx` — `daily-tag-only` and `daily-multi-choice` fell through to `buildEventDataset`; fixed with proper switch routing to `buildTagOnlyDataset`/`buildMultiChoiceDataset`.
- **Bug fixed**: `DailyLabWidget.tsx` — new project types returned `null` when expanded; added render branch with "available in LAB page" message, fixed log detection (`existingMultiChoiceLog`), added mode badges in collapsed view.
- **Bug fixed**: `OverviewSelectionList.tsx` — new daily types got badge `'E'` and `multiKind='labEvent'`; fixed to use proper badges (`T`/`M`) and map to `'labDaily'`.
- **Verified safe**: `OverviewPage/useOverviewData.ts` — guards with `mode !== 'daily'`/`!== 'event'`, returns `[]` for new types.
- **Verified safe**: `TagCoverageView` — returns `null` for `daily-multi-choice` (correct, no tags).
- **Verified safe**: `TagStatsView` — only used by `FindingsView` which only renders for `daily`/`event`.

---

## File Change Summary

### New files:
| File | Purpose |
|------|---------|
| `app/src/domain/lab/actions/labMultiChoiceLogs.ts` | Multi-choice log CRUD |
| `app/src/domain/lab/actions/labTagCategories.ts` | Tag category CRUD |
| `app/src/domain/lab/analysis/tagOnlyMethods.ts` | Tag-only analysis methods |
| `app/src/domain/lab/analysis/multiChoiceMethods.ts` | Multi-choice analysis methods |
| `app/src/domain/lab/analysis/multiOutcomeMethods.ts` | Cross-outcome correlation |
| `app/src/pages/LabPage/components/DailyLogForm.tsx` | Unified daily logging form |
| `app/src/pages/LabPage/components/DailyLogForm.module.css` | Logging form styles |
| `app/src/pages/LabPage/components/DotTable.tsx` | 30-day dot table |
| `app/src/pages/LabPage/components/DotTable.module.css` | Dot table styles |
| `app/src/pages/LabPage/components/TagOnlyFindingsView.tsx` | Tag-only analysis display |
| `app/src/pages/LabPage/components/TagOnlyFindingsView.module.css` | Tag-only styles |
| `app/src/pages/LabPage/components/MultiChoiceFindingsView.tsx` | Multi-choice analysis display |
| `app/src/pages/LabPage/components/MultiChoiceFindingsView.module.css` | Multi-choice styles |
| `app/src/pages/LabPage/components/TagCategoryDialog.tsx` | Category management dialog |
| `app/src/pages/LabPage/components/TagCategoryDialog.module.css` | Category dialog styles |

### Modified files:
| File | Changes |
|------|---------|
| `app/src/domain/types.ts` | New types, interfaces, extended unions |
| `app/src/domain/lab/actions/labProjects.ts` | Support new modes, multi-outcome updates, fix `deleteLabProject` to cascade new slices + `absenceMarkersByProject` |
| `app/src/domain/lab/actions/labDailyLogs.ts` | Multi-outcome support in setLabDailyLog |
| `app/src/domain/lab/actions/index.ts` | Re-export new action files |
| `app/src/domain/lab/analysis/datasetBuilders.ts` | New dataset builders |
| `app/src/domain/lab/analysis/runner.ts` | Route to new methods by mode |
| `app/src/domain/lab/analysis/cache.ts` | Extended fingerprint |
| `app/src/domain/lab/analysis/index.ts` | Re-export new method files |
| `app/src/domain/store/appStore.ts` | Register new actions/selectors |
| `app/src/domain/utils/labValidation.ts` | Handle new modes |
| `app/src/domain/utils/csvExport.ts` | Export new project types |
| `app/src/persistence/storageService.ts` | Repair + empty state for new fields |
| `app/src/persistence/supabaseSync.ts` | Include new state slices |
| `app/src/pages/LabPage/LabPage.tsx` | Route analysis view by project type, tag categories in sidebar |
| `app/src/pages/LabPage/LabPage.module.css` | Badge, category, and layout tweaks |
| `app/src/pages/LabPage/components/ProjectDialog.tsx` | 4-mode selector, multi-outcome, multi-choice options |
| `app/src/pages/LabPage/components/ProjectDialog.module.css` | New form section styles |
| `app/src/pages/LabPage/components/TagDialog.tsx` | Add category dropdown (keep existing group field unchanged) |
| `app/src/pages/LabPage/components/FindingsView.tsx` | Outcome dropdown, cross-outcome tab |
| `app/src/pages/LabPage/components/DataMaturityView.tsx` | Support new project types |

---

## Dependency Order

```
Phase 1  (types)
   ↓
Phase 2  (actions)
   ↓
Phase 3  (storage/persistence)
   ↓
Phase 4  (project creation UI)  ←  can start after Phase 2
   ↓
Phase 5  (tag categories UI)    ←  can start after Phase 2
   ↓
Phase 6  (logging UI)           ←  needs Phase 4 done
   ↓
Phase 7  (analysis engine)      ←  needs Phase 2 done
   ↓
Phase 8  (analysis display UI)  ←  needs Phase 7 done
   ↓
Phase 9  (integration/polish)   ←  needs all above
```

Phases 4, 5, and 7 can partially overlap after Phase 2 is complete.

---

## Risk Notes

1. **Backward compatibility**: Existing daily projects have `config.kind === 'daily'` and `outcome` field. They must keep working without migration. The `additionalOutcomes` field defaults to `undefined`/`[]` for existing projects.
2. **Tag-only uses existing `LabDailyLog`**: This avoids creating yet another log store. The `outcome` field is simply `undefined` for tag-only projects. The analysis runner checks project mode, not log shape.
3. **Multi-choice log store**: A separate `multiChoiceLogsByProject` is cleaner than overloading `LabDailyLog` since the data shape is fundamentally different (option IDs vs. outcome numbers + tags).
4. **Cache invalidation**: All new data changes must update the fingerprint. Forgetting to include new fields in the fingerprint will cause stale analysis results.
5. **Performance**: The 30-day dot table is a simple render of pre-computed data. No performance concerns expected.
6. **Existing tag `group` field**: The `group` field is **actively used** by event project analysis to generate virtual `group:groupName` findings (methods E2, E4, E7, E8, E10). It cannot be deprecated. The new `categoryId` serves a different purpose (UI organization) and coexists alongside `group`. Both fields are shown in TagDialog.
7. **`LabFinding` type duplication**: `domain/types.ts` defines a complex `LabFinding` with `target`, `window`, `direction`, `effectSize` fields, but it is **never imported anywhere** — all code uses the simpler `LabFinding` from `analysis/types.ts`. The dead type in `domain/types.ts` should be removed or reconciled in Phase 1 to avoid confusion.
8. **`deleteLabProject` missing cleanup**: The existing `deleteLabProject` does not clean up `absenceMarkersByProject`. This pre-existing bug should be fixed in Phase 2 alongside adding cleanup for the new `multiChoiceLogsByProject` and `tagCategoriesByProject` slices.
9. **No existing daily logging UI**: There is currently **no daily log form** in `LabPage`. Only `EventLogList` handles event logging. The `DailyLogForm` in Phase 6 is built from scratch, not extracted from existing code.
