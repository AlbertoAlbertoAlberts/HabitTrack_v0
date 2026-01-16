# 03_components.md — Component & module breakdown (Personal Habit Tracker)

This document describes a practical UI/component architecture that matches the functional spec and avoids “god components”.
It is intentionally stack-agnostic, but uses React-style naming and patterns (the same structure maps well to Vue/Svelte too).

---

## 0) High-level architecture

### Layers
1. **UI Layer (Pages + Components)**  
2. **State/Domain Layer (stores + actions + selectors)**  
3. **Persistence Layer (local storage adapter)**

Core rule:
- UI components do not directly manipulate localStorage.
- UI calls domain actions, domain updates state, persistence writes state.

---

## 1) Routes / Pages

### 1.1 `DailyPage` (Page 1)
Purpose:
- Date navigation
- Category/Priority view toggle
- Habit scoring grid/cards
- Left “Challenges” list
- Weekly tasks panel
- Right TO-DO panel

Contains:
- `TopBar`
- `ChallengesPanel` (left)
- `DailyScoringPanel` (middle)
- `WeeklyPanel` (weekly tasks)
- `TodoPanel` (right)

### 1.2 `OverviewPage` (Page 2)
Purpose:
- Rolling 7/30 day window navigation
- Exclusive filter selection (overall / priority / category / habit)
- Chart rendering
- Habit/category selection list

Contains:
- `TopBar` (but with overview-specific controls)
- `OverviewChartPanel`
- `OverviewFilterPanel`
- `OverviewSelectionPanel` (scrollable list of categories/habits)

### 1.3 `ArchivePage` (Optional / simple)
Purpose:
- Show completed to-dos with completion timestamps
- Restore back to active list
- Optionally delete archived items

Contains:
- `ArchiveList`

> Note: even if Archive is “not sketched”, building it as a page keeps the main UI cleaner.

---

## 2) Shared / Cross-page layout components

### 2.1 `AppShell`
- Defines 3-column layout grid when needed
- Provides consistent spacing, typography, responsive behavior

### 2.2 `TopBar`
Two variants:
- `DailyTopBar` (date nav + view toggle + nav to overview)
- `OverviewTopBar` (range toggle 7/30 + window nav + nav back)

Common responsibilities:
- Shows current context title (date or date-range)
- Shows navigation buttons

---

## 3) Page 1 components (Daily)

### 3.1 Left column: challenges and management

#### `ChallengesPanel`
Responsibilities:
- Render list of categories and habits (always expanded)
- Handle scroll container
- Provide menu for actions:
  - Add category
  - Add habit
  - Change priority (enter priority edit mode)
  - Reorder mode (drag & drop)
  - Delete mode (trash icons + confirm)
- Shows priority edit mode “X” exit control (if you want it located near menu)

Children:
- `CategoryList`
- `CategoryRow`
- `HabitRowCompact` (in left list)
- `PanelMenuButton` (hamburger)
- `PanelMenu` (dropdown)

State inputs:
- categories (ordered)
- habits grouped by category (ordered)
- `ui.daily.leftMode` (normal / reorder / delete / priorityEdit)

Actions emitted:
- `openAddCategoryModal()`
- `openAddHabitModal()`
- `enterPriorityEditMode() / exitPriorityEditMode()`
- `enterDeleteMode() / exitDeleteMode()`
- `enterReorderMode() / exitReorderMode()`
- `requestDeleteCategory(id)`
- `requestDeleteHabit(id)`
- `reorderCategories(newOrder)`
- `reorderHabits(categoryId, newOrder)`
- `moveHabit(habitId, targetCategoryId, targetIndex)`

#### `HabitRowCompact`
Left-panel habit display row:
- Shows habit name
- Optional small priority badge
- In delete mode: shows trash icon
- In reorder mode: drag handle

---

### 3.2 Middle column: daily scoring

#### `DailyScoringPanel`
Responsibilities:
- Render scoring UI for the selected date
- Switch between:
  - Category view
  - Priority view
- Determine lock state and disable controls if locked
- Ensure scrolling container

Children:
- `DailyViewToggle` (KATEGORIJA / PRIORITĀTE) (could also be in `DailyTopBar`)
- `CategoryScoreList` OR `PriorityScoreList`

Inputs:
- `selectedDate`
- `lockState` (editable/locked)
- scored values map for date: `scoresByHabitId`
- habits (with current category + priority)

Actions:
- `setScore(date, habitId, score)`
- (optional) `commitDayIfNeeded(date)` when leaving date/page (handled by route/nav layer)

#### `CategoryScoreList`
Responsibilities:
- Group habits by category
- Render one `CategoryScoreCard` per category

#### `PriorityScoreList`
Responsibilities:
- Group habits by priority 1/2/3
- Render one `PriorityScoreCard` per priority

#### `CategoryScoreCard` / `PriorityScoreCard`
A scroll-stable card containing multiple habit rows:
- Title row (category name or “Prioritāte 1”)
- Multiple `HabitScoreRow`

#### `HabitScoreRow`
Responsibilities:
- Show habit name
- Show 3 score buttons: 0/1/2
- Highlight selected
- Disable if locked

Children:
- `ScoreButtonGroup`

#### `ScoreButtonGroup`
Responsibilities:
- Pure UI for selecting 0/1/2
- Receives:
  - `value` (0/1/2/undefined)
  - `disabled`
  - `onChange(newScore)`

---

### 3.3 Priority edit UI (Page 1)

Priority edit mode is entered from left menu.
You described the `< 1 >` controls appearing next to each habit only in this mode.

Two implementation options:

**Option A (recommended): keep priority edit inside left panel list**
- In priority edit mode, each `HabitRowCompact` shows:
  - `PriorityStepper` control `< 1 >`
- This avoids duplicating the habit list.

**Option B: show stepper also in middle scoring list**
- More complex, because it can appear in two different view layouts.

#### `PriorityStepper`
Responsibilities:
- Show current priority (1–3)
- Increment/decrement within bounds
- Emits `setHabitPriority(habitId, newPriority)` but does not reorder immediately (reorder on exit)

---

### 3.4 Weekly tasks panel

#### `WeeklyPanel`
Responsibilities:
- Show the current week context: title `Nedēļa` and date range (Monday–Sunday)
- Render weekly task tiles in a 2-column grid
- Provide a compact menu (⋯) for weekly task management

UI behavior:
- Each weekly task tile shows a progress ring (completed days vs target) and the task name
- Click: mark the currently selected date as completed for that weekly task
- Shift+click: remove the completion mark for the selected date
- Completion is once per day (at most one completion per calendar day)
- Weekly target is clamped to a maximum of 7 (one per day)
- Default weekly target when creating a task: `2`

Menu actions (⋯):
- `Pārkārtot` — reorder mode (drag tiles)
- `Mainīt nosaukumus` — rename mode (✎ per tile)
- `Dzēst` — delete mode (🗑 per tile)
- `+ Ieradumu` — open add dialog

State inputs:
- `selectedDate`
- `weeklyTasks` (ordered)
- `weeklyProgress[weekStartDate][taskId]` (count for ring display)

Actions emitted:
- `addWeeklyTask(name, targetPerWeek)`
- `renameWeeklyTask(id, name)`
- `deleteWeeklyTask(id)`
- `reorderWeeklyTasks(newOrder)`
- `adjustWeeklyCompletionForDate(weekStartDate, date, taskId, delta)`

---

### 3.5 Right column: to-do panel

#### `TodoPanel`
Responsibilities:
- Display active to-do items
- Add new item (plus icon or menu)
- Delete mode for to-dos
- Handle completion (checkbox -> archive move)
- Link/button to open archive page

Children:
- `TodoHeader` (title + menu)
- `TodoList` (scroll)
- `TodoItemRow`

State inputs:
- active to-dos ordered
- `ui.todo.mode` (normal / delete)

Actions:
- `addTodo(text)`
- `toggleTodoDeleteMode()`
- `deleteTodo(todoId)`
- `completeTodo(todoId)` (moves to archive)

#### `TodoItemRow`
- Checkbox (complete)
- Text
- In delete mode: trash icon

---

## 4) Page 2 components (Overview)

### 4.1 `OverviewTopBar`
Responsibilities:
- Range toggle 7/30
- Date window navigation (from-to display + arrows)
- Back navigation to Daily page

Inputs:
- `overviewRangeDays` (7|30)
- `overviewWindowEndDate`
- computed date range text

Actions:
- `setOverviewRangeDays(7|30)`
- `shiftOverviewWindow(direction)` (e.g., -7, +7 or -30, +30)
- `goToDaily()`

### 4.2 `OverviewFilterPanel` (right-side controls)
Responsibilities:
- Provide the “6 exclusive modes”
- Enforce exclusivity (selecting one deselects others)
- If mode requires selection (habit/category), show current selection label

Modes:
1. overall
2. priority1
3. priority2
4. priority3
5. category (requires categoryId)
6. habit (requires habitId)

Actions:
- `setOverviewMode(mode)`
- `setOverviewSelectedCategory(categoryId)`
- `setOverviewSelectedHabit(habitId)`

### 4.3 `OverviewSelectionPanel` (bottom-left list)
Responsibilities:
- Scrollable list of categories and habits for selecting:
  - a single habit (Atsevišķa sadaļa)
  - a category (Kategorija)
- Inhabit the UI shown in your mockup (category headers + habit items)

Children:
- `OverviewCategoryGroup`
- `OverviewSelectableRow`

Behavior rules:
- If mode is “habit”: clicking a habit selects that habit
- If mode is “category”: clicking a category selects that category
- If another mode is active (overall/priority), selection panel is still visible but selection doesn’t change chart unless user changes mode (your choice; simplest: keep it clickable only when relevant mode is active)

### 4.4 `OverviewChartPanel`
Responsibilities:
- Render the chart based on:
  - selected mode
  - rolling date window
  - current habits/categories (including priority)
  - daily scores
- Compute:
  - series values per day
  - y-axis max
- Render X/Y axis labels

Child:
- `ScoreLineChart` (pure chart component)

#### `ScoreLineChart`
Inputs:
- `dataPoints: Array<{date: YYYY-MM-DD, value: number}>`
- `yMax: number`
- `rangeLabel: string`

---

## 5) Modals & dialogs (shared)

### 5.1 `AddCategoryModal`
- Input: category name
- Confirm/cancel
- Validations: non-empty, trim spaces

### 5.2 `AddHabitModal`
- Inputs:
  - habit name
  - category dropdown
- Confirm/cancel
- Validations: non-empty, trim, enforce UI-safe length

### 5.3 `ConfirmDeleteDialog`
Generic confirm dialog:
- “Are you sure?” text
- Confirm/cancel
Used for:
- delete category
- delete habit
- delete to-do item

---

## 6) Domain/state modules (non-UI)

This section is not implementation code, but a suggested module breakdown.

### 6.1 `store/uiState`
- daily view mode (category/priority)
- daily page selected date
- left panel mode (normal/reorder/delete/priorityEdit)
- todo delete mode
- overview mode, range, selection, window end date

### 6.2 `store/categories`
- CRUD
- reorder categories

### 6.3 `store/habits`
- CRUD
- move habit between categories
- reorder habits within a category
- update priority
- apply priority-change reposition rule (performed on exiting priority edit mode)

### 6.4 `store/dailyScores`
- set score for (date, habitId)
- read scores for date
- read scores in date range
- lock day / check lock state

### 6.5 `store/todos`
- add, delete
- complete -> archive
- restore from archive

### 6.6 `selectors/*`
Derived computations:
- habitsByCategory (ordered)
- habitsByPriority (ordered)
- dailyScoreMapForDate
- overviewSeriesForModeAndRange
- yMax calculation

---

## 7) Persistence module (referenced, defined in detail in `04_storage_schema.md`)

### 7.1 `storageService`
Responsibilities:
- Load initial app state
- Save state on changes (debounced)
- Provide schema versioning & migrations

---

## 8) Recommended file structure (example)
src/
pages/
DailyPage/
OverviewPage/
ArchivePage/
components/
layout/
daily/
overview/
todo/
modals/
shared/
domain/
categories/
habits/
dailyScores/
todos/
uiState/
selectors/
persistence/
storageService/
migrations/

This structure keeps UI, domain logic, and persistence cleanly separated.

---