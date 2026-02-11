# Todo Page — Implementation Plan

This document describes the phased rollout of the new **Todo page** with Eisenhower-style matrix, todo folders, and the updated DailyPage todo panel. Each phase is scoped to ~200–300 lines of changes so it can be completed in one agent pass without breaking existing functionality.

> **Migration safety:** every phase preserves existing `TodoItem` and `TodoArchiveItem` data. New fields (`folderId`, `quadrant`) are optional and default to `undefined`/`null`, so old todos remain visible and functional throughout.

---

## Phase 1 — Data Model & Migration Layer

**Goal:** Extend types, add action creators for folders, extend `TodoItem` with `folderId` and `quadrant`, and wire up migration/repair in `storageService.ts` so that existing todos survive the upgrade.

### Step 1.1 — New types (`domain/types.ts`)

Add:
```ts
export type TodoFolderId = string

export type TodoQuadrant = 'asap' | 'schedule' | 'later' | 'fun'

export interface TodoFolder {
  id: TodoFolderId
  name: string
  sortIndex: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}
```

Extend `TodoItem`:
```ts
export interface TodoItem {
  // ...existing fields...
  folderId?: TodoFolderId   // undefined → "Bez mapes"
  quadrant?: TodoQuadrant   // undefined → uncategorised in matrix
}
```

Extend `AppStateV1`:
```ts
export interface AppStateV1 {
  // ...existing fields...
  todoFolders: Record<TodoFolderId, TodoFolder>
}
```

### Step 1.2 — Migration/repair (`persistence/storageService.ts`)

In `repairStateV1`, backfill:
```ts
if (!state.todoFolders || typeof state.todoFolders !== 'object') {
  state.todoFolders = {}
}
```

In `createDefaultState`, add `todoFolders: {}`.

### Step 1.3 — Folder action creators (`domain/actions/todoFolders.ts`)

New file with pure functions (same pattern as `categories.ts`):

- `addTodoFolder(state, name) → AppStateV1`
- `renameTodoFolder(state, folderId, name) → AppStateV1`
- `deleteTodoFolder(state, folderId) → AppStateV1` — moves all items in that folder to `folderId: undefined` (i.e., "Bez mapes")
- `reorderTodoFolders(state, orderedIds) → AppStateV1`

### Step 1.4 — Extend todo actions (`domain/actions/todos.ts`)

- `addTodo(state, text, folderId?)` — accept optional `folderId`
- `setTodoFolder(state, todoId, folderId | undefined)` — move a todo into or out of a folder
- `setTodoQuadrant(state, todoId, quadrant | undefined)` — assign or unassign a quadrant
- `completeTodo` — no changes needed (quadrant data is simply discarded when archived)

### Step 1.5 — Register in appStore (`domain/store/appStore.ts`)

Wire up all new action creators and expose them via `appStore.actions`:
- `addTodoFolder`, `renameTodoFolder`, `deleteTodoFolder`, `reorderTodoFolders`
- `setTodoFolder`, `setTodoQuadrant`

**Estimated diff:** ~200 lines added/changed.  
**Risk:** zero — no UI changes, all new fields are optional, `repairStateV1` backfills `todoFolders: {}`.

---

## Phase 2 — Todo Page: Left Panel (Folder List)

**Goal:** Create the new `/todo` route with a left panel showing todos organized in folders, identical in visual style to `LeftPanelCategoriesList`.

### Step 2.1 — Page scaffolding

Create files:
- `pages/TodoPage/TodoPage.tsx` — top-level layout (left 1/3 + right 2/3 grid)
- `pages/TodoPage/TodoPage.module.css` — grid layout

### Step 2.2 — Left panel component

Create:
- `pages/TodoPage/components/TodoFolderList.tsx`
- `pages/TodoPage/components/TodoFolderList.module.css`

Structure mirrors `LeftPanelCategoriesList`:
- Each folder is a collapsible card with a folder icon and name
- Under each folder, todo items are listed (name only, no checkbox — this is the planning view)
- "Bez mapes" auto-folder at the bottom for todos without `folderId`
- Add-folder button, menu with reorder/rename/delete modes (same UX as habit categories)
- Items in a quadrant have a green left-border or green dot indicator
- Items not in a quadrant have neutral styling

### Step 2.3 — Add route & nav tab

- `App.tsx` — add `<Route path="/todo" element={<TodoPage />} />`
- `TopNav.tsx` — add `Todo` nav link between `Habit` and `Lab`

### Step 2.4 — Add-todo and add-folder dialogs

- Reuse existing `Dialog` component for creating new todos (with optional folder picker) and new folders

**Estimated diff:** ~250–300 lines.  
**Risk:** low — new route, no existing code touched except `App.tsx` (one `<Route>`) and `TopNav.tsx` (one `<NavLink>`).

---

## Phase 3 — Todo Page: Eisenhower Matrix (Right Panel)

**Goal:** Build the 2×2 matrix grid on the right side of the Todo page with drag-and-drop support.

### Step 3.1 — Matrix component

Create:
- `pages/TodoPage/components/EisenhowerMatrix.tsx`
- `pages/TodoPage/components/EisenhowerMatrix.module.css`

Layout:
```
              Steidzams          Nav steidzams
           ┌──────────────┬──────────────┐
  Svarīgs  │    ASAP      │  Ieplānot    │
           ├──────────────┼──────────────┤
Nav svarīgs│    Vēlāk     │    Fun       │
           └──────────────┴──────────────┘
```

Each quadrant:
- Shows its label (ASAP / Ieplānot / Vēlāk / Fun) as a header
- Lists all `TodoItem`s whose `quadrant` matches
- Is a drop target that accepts dragged items

### Step 3.2 — Drag-and-drop: left → matrix

- Left panel items are `draggable` (folders are NOT draggable into the matrix)
- `dataTransfer` carries `{ kind: 'todo', todoId: string }`
- Dropping on a quadrant calls `appStore.actions.setTodoQuadrant(todoId, quadrant)`
- The item turns green in the left panel

### Step 3.3 — Drag-and-drop: matrix → matrix / matrix → left

- Items inside a quadrant are also draggable
- Dropping onto a different quadrant re-assigns
- Dropping back onto the left panel (anywhere in the left column) unassigns (`quadrant → undefined`), item reverts to neutral color

### Step 3.4 — Items inside the matrix display

Each item in a quadrant shows:
- The todo text
- The folder name in parentheses (if it belongs to a folder), e.g. `"Piezvanīt slimnīcai (Darīt)"`

**Estimated diff:** ~250–300 lines.  
**Risk:** low — isolated new components, state changes via existing `setTodoQuadrant` action from Phase 1.

---

## Phase 4 — DailyPage Todo Panel Upgrade

**Goal:** Restructure the DailyPage right-side `RightTodosPanel` to group todos by quadrant (ASAP → Vēlāk → Ieplānot → Fun → Nekategorizēts) and show folder names.

### Step 4.1 — Grouping logic

In `hooks/useDailyData.ts` (or a new helper), compute grouped + ordered todo lists:

```ts
type GroupedTodos = {
  label: string
  quadrant: TodoQuadrant | 'uncategorized'
  items: TodoItem[]
}[]
```

Order: `asap` → `later` → `schedule` → `fun` → `uncategorized`  
Labels: `ASAP` / `Vēlāk` / `Ieplānot` / `Fun` / `Nekategorizēts`

### Step 4.2 — Update `RightTodosPanel.tsx`

- Instead of a flat list, render section headers for each group
- Each item shows: `text (folderName)` — fold name retrieved from `state.todoFolders`
- If folderName is absent (no folder), just show `text`
- Section headers are small, dimmed labels (consistent with existing panel style)
- Empty groups are hidden

### Step 4.3 — Preserve existing functionality

- Checkbox → complete/archive (unchanged)
- Reorder mode — reordering now within each group (or globally, TBD)
- Rename / delete modes — unchanged
- Add todo dialog — unchanged (adds to "Bez mapes", no quadrant)
- Archive link — unchanged

**Estimated diff:** ~200 lines changed.  
**Risk:** medium — this modifies an existing component. The key risk mitigation is that all changes are rendering-only; the underlying data model and actions are untouched.

---

## Phase 5 — Todo Folder Management UX (CRUD polish)

**Goal:** Add full folder management UX on the Todo page: add-folder dialog, rename, delete (with confirmation), reorder (drag-and-drop), and the ability to move items between folders.

### Step 5.1 — Folder menu

Add a menu (☰) on the Todo page left panel header, similar to the habit category menu:
- Pārkārtot (reorder folders via drag)
- Pārdēvēt (rename mode — click a folder to rename inline)
- Dzēst (delete mode — click trash icon → confirm dialog; items move to "Bez mapes")
- Divider
- `+ Mapi` (add folder)

### Step 5.2 — Move-to-folder action

- In the left panel, each todo item gets a small folder-move icon (visible in normal mode or a dedicated "move" mode)
- Clicking opens a dropdown/dialog listing all folders + "Bez mapes"
- Selecting a folder calls `appStore.actions.setTodoFolder(todoId, folderId)`

### Step 5.3 — Adding a todo with folder pre-selection

When adding a todo from the Todo page:
- The dialog includes a folder dropdown (pre-selected to the currently expanded folder, or "Bez mapes")
- This calls `appStore.actions.addTodo(text, folderId)`

**Estimated diff:** ~200–250 lines.  
**Risk:** low — additive UI, no changes to core data flow.

---

## Phase 6 — Archive Adjustments & Edge Cases

**Goal:** Adjust the archive page and handle remaining edge cases.

### Step 6.1 — Archive page: show folder name

In `ArchivePage.tsx`, extend each archived item's display:
- If the todo had a `folderId` at the time of completion, show it
- This requires storing `folderId` in `TodoArchiveItem` (extend type, update `completeTodo` action)
- Old archive items without `folderId` render without it (backward compatible)

### Step 6.2 — Restore from archive

When restoring a todo:
- If the original `folderId` still exists in `todoFolders`, restore to that folder
- If the folder was deleted, restore to "Bez mapes" (`folderId: undefined`)
- Quadrant is NOT restored (user must re-plan)

### Step 6.3 — Edge-case handling

- Deleting a folder: confirm dialog, all items move to "Bez mapes", any quadrant assignments are preserved
- Deleting a todo that's in a quadrant: it simply disappears from both the list and the matrix
- Empty matrix quadrants: show a subtle "Velc uzdevumu šeit" (drag a task here) hint

### Step 6.4 — Mobile responsive

- On small screens (<768px), the Todo page should stack: folder list on top, matrix below
- Matrix quadrants should be 2×2 grid even on mobile, just smaller

**Estimated diff:** ~200 lines.  
**Risk:** low — mostly display-layer changes.

---

## Phase Summary

| Phase | Scope | Est. lines | Breaks existing? |
|-------|-------|-----------|------------------|
| 1 | Data model, actions, migration | ~200 | No |
| 2 | Todo page left panel + route | ~280 | No |
| 3 | Eisenhower matrix + drag-drop | ~280 | No |
| 4 | DailyPage todo panel upgrade | ~200 | No (render changes only) |
| 5 | Folder CRUD polish | ~220 | No |
| 6 | Archive adjustments + edge cases | ~200 | No |

**Total estimated:** ~1,400 lines across 6 phases.

Each phase is independently deployable — the app works correctly after each phase, just with fewer features.
