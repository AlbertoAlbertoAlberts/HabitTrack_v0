# HabitTrack v0 - Project Overview (Pre-LAB)

**Date:** January 2026  
**Status:** Production-ready, optimized codebase

---

## 1. Project Summary

**HabitTrack v0** is a personal habit tracking application built for desktop-first, local-only use. It enables users to:

- Track daily habits with a 3-point scoring system (0, 1, 2)
- Organize habits by categories with priority levels (P1, P2, P3)
- Manage daily to-do lists and weekly recurring tasks
- View progress analytics and charts over 7/30 day periods
- Access completed items in an archive

**Key characteristics:**
- **No backend**: All data stored in browser localStorage
- **No authentication**: Single-user, local-only application
- **Desktop-first**: Optimized for desktop usage patterns
- **Privacy-focused**: Data never leaves the user's device
- **Performance-optimized**: Recently refactored for improved VS Code/Copilot experience

---

## 2. Technical Stack

### Core Technologies
- **React 19.2** - UI framework
- **TypeScript 5.9** - Type-safe development
- **Vite 7.2** - Build tool and dev server
- **React Router 7.12** - Client-side routing

### Styling
- **CSS Modules** - Component-scoped styling
- **CSS Custom Properties** - Theme variables (light/dark/system modes)

### State Management
- **Custom store** - Vanilla subscribe/notify pattern (no Redux/Zustand)
- **localStorage** - Persistence layer wrapped in `storageService`

### Development Tools
- **ESLint** - Code linting
- **TypeScript strict mode** - Type checking
- **Vite HMR** - Hot module replacement

---

## 3. Project Structure

```
HabitTrack_v0/
├── app/                          # Main application directory
│   ├── src/
│   │   ├── components/           # Shared components
│   │   │   ├── debug/           # DebugPanel for development
│   │   │   ├── ui/              # Shared UI primitives
│   │   │   │   ├── Dialog.tsx   # Modal dialog component
│   │   │   │   └── shared.module.css  # Shared button/panel/nav styles
│   │   │   ├── weekly/          # Weekly task components
│   │   │   │   ├── WeeklyTaskTile.tsx
│   │   │   │   └── WeeklyProgressRing.tsx
│   │   │   └── TopNav.tsx       # Top navigation bar
│   │   │
│   │   ├── domain/              # Business logic layer
│   │   │   ├── types.ts         # TypeScript type definitions
│   │   │   ├── actions/         # State mutation functions
│   │   │   │   ├── categories.ts
│   │   │   │   ├── habits.ts
│   │   │   │   ├── dailyScores.ts
│   │   │   │   ├── todos.ts
│   │   │   │   ├── weeklyTasks.ts
│   │   │   │   ├── dayLocks.ts
│   │   │   │   └── uiState.ts
│   │   │   ├── store/           # State management
│   │   │   │   ├── appStore.ts      # Central store with actions
│   │   │   │   └── useAppStore.ts   # React hook for store
│   │   │   └── utils/           # Domain utilities
│   │   │       ├── localDate.ts     # Date manipulation
│   │   │       └── weeklyTaskTarget.ts
│   │   │
│   │   ├── pages/               # Route pages
│   │   │   ├── DailyPage/       # Main habit tracking view
│   │   │   │   ├── DailyPage.tsx
│   │   │   │   ├── components/  # Page-specific components
│   │   │   │   │   ├── HabitGroupCard.tsx
│   │   │   │   │   ├── HabitRow.tsx
│   │   │   │   │   ├── ScoreRow.tsx
│   │   │   │   │   ├── LeftNavButtons.tsx
│   │   │   │   │   ├── LeftPanelMenu.tsx
│   │   │   │   │   ├── LeftPanelCategoriesList.tsx
│   │   │   │   │   ├── WeekPanel.tsx
│   │   │   │   │   └── RightTodosPanel.tsx
│   │   │   │   ├── hooks/       # Page-specific hooks
│   │   │   │   │   ├── useDailyData.ts
│   │   │   │   │   └── useScoreHandlers.ts
│   │   │   │   └── utils/
│   │   │   │       └── applyRename.ts
│   │   │   │
│   │   │   ├── OverviewPage/    # Analytics/charts view
│   │   │   │   ├── OverviewPage.tsx
│   │   │   │   ├── components/
│   │   │   │   │   ├── OverviewChart.tsx      # SVG line chart
│   │   │   │   │   ├── OverviewFilters.tsx    # Mode filter buttons
│   │   │   │   │   └── OverviewSelectionList.tsx
│   │   │   │   └── hooks/
│   │   │   │       └── useOverviewData.ts     # Data computations
│   │   │   │
│   │   │   ├── ArchivePage/     # Completed todos view
│   │   │   │   └── ArchivePage.tsx
│   │   │   │
│   │   │   └── LabPage/         # Sandbox/experimental area
│   │   │       └── LabPage.tsx
│   │   │
│   │   ├── persistence/         # Storage layer
│   │   │   └── storageService.ts    # localStorage wrapper
│   │   │
│   │   ├── App.tsx              # Root component with routing
│   │   ├── main.tsx             # Application entry point
│   │   └── index.css            # Global styles
│   │
│   ├── public/                  # Static assets
│   │   └── fonts/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── Documentation/               # Project documentation
│   ├── 00_project_conventions.md
│   ├── 01_data_model.md
│   ├── 02_locking_rules.md
│   ├── 03_components.md
│   ├── 04_storage_schema.md
│   ├── optimization_plan.md
│   └── visual_for_LAB.md
│
└── short_plans/                # Temporary planning notes
```

---

## 4. Architecture Overview

### 4.1 State Management Pattern

**Central Store** (`appStore.ts`):
- Single source of truth for application state
- Subscribe/notify pattern for React integration
- Actions namespace for all mutations
- Automatic persistence on every state change

**State Structure**:
```typescript
AppStateV1 {
  schemaVersion: 1
  savedAt: IsoTimestamp
  categories: Record<CategoryId, Category>
  habits: Record<HabitId, Habit>
  dailyScores: Record<LocalDateString, Record<HabitId, Score>>
  todos: Record<TodoId, TodoItem>
  todoArchive: Record<TodoArchiveId, TodoArchiveItem>
  weeklyTasks: Record<WeeklyTaskId, WeeklyTask>
  dayLocks: Record<LocalDateString, boolean>
  uiState: UIState
}
```

### 4.2 Data Flow

1. **User Interaction** → Component event handler
2. **Action Dispatch** → `appStore.actions.methodName()`
3. **State Mutation** → Pure function in `domain/actions/`
4. **Persistence** → Automatic save to localStorage
5. **UI Update** → React re-render via `useAppState()` hook

### 4.3 Page Architecture

Each major page follows a consistent pattern:

**DailyPage** (878 lines → optimized structure):
- Main orchestration component
- Custom hooks for data (`useDailyData`) and handlers (`useScoreHandlers`)
- Extracted components for UI sections
- Modular CSS with shared styles

**OverviewPage** (878 → 196 lines after optimization):
- Chart rendering with SVG gradients
- Data aggregation hook (`useOverviewData`)
- Filter modes: overall, priority1-3, category, habit
- Window navigation (7/30 day views)

### 4.4 Component Patterns

**Shared UI Components** (`components/ui/`):
- `Dialog` - Modal dialogs for confirmations
- `shared.module.css` - Consolidated button/panel/nav styles
  - `.page`, `.panel` - Layout primitives
  - `.smallBtn` - Compact buttons
  - `.navBtn`, `.navBtnActive` - Navigation buttons
  - `.iconBtn`, `.iconBtnSmall`, `.iconBtnMedium` - Icon buttons

**Specialized Components**:
- `WeeklyTaskTile` - Progress ring + counter
- `HabitGroupCard` - Category grouping with habits
- `ScoreRow` - Individual habit scoring interface

### 4.5 Routing

```typescript
/ (root)          → DailyPage    // Main habit tracking
/overview         → OverviewPage // Analytics charts
/archive          → ArchivePage  // Completed todos
/lab              → LabPage      // Experimental features
* (fallback)      → Redirect to /
```

---

## 5. Core Features

### 5.1 Daily Habit Tracking (DailyPage)

**Left Panel**:
- Navigation buttons (Overview, Daily views)
- Category management (add, rename, reorder, delete via drag-and-drop)
- Debug panel (development only)

**Center Panel**:
- Date navigation (previous/next day)
- Day lock indicator
- Categories displayed as collapsible cards
- Habits grouped by category
- 3-point scoring buttons (0, 1, 2) per habit
- Habit management (add, rename, priority, reorder, delete)
- Weekly tasks progress panel

**Right Panel**:
- Active todos list
- Add new todo
- Complete/restore/delete todos
- Drag-and-drop reordering

**View Modes**:
- `scored` - Show only scored habits
- `unscored` - Show only unscored habits
- `all` - Show all habits

### 5.2 Overview Analytics (OverviewPage)

**Main Features**:
- SVG line chart with smooth Bezier curves
- Color-coded gradient (red → amber → green)
- Max possible score reference line
- Statistics: Total %, Average %, Max possible, Active habits
- Weekly tasks summary with progress bars

**Filter Modes**:
- Overall - All habits combined
- Priority 1-3 - Filtered by priority level
- Category - Select specific category
- Habit - Select individual habit

**Time Windows**:
- 7 days or 30 days
- Window navigation (shift backward/forward)
- Automatic week calculation for weekly tasks

### 5.3 Archive (ArchivePage)

- View completed todo items
- Restore items back to active list
- Chronological display with completion timestamps

### 5.4 Lab (LabPage)

- Sandbox area for future features
- Empty state with matching app styling
- Ready for experimentation

---

## 6. Data Model Summary

### Core Entities

**Category** - Habit folder
- `id`, `name`, `sortIndex`
- Manual ordering via drag-and-drop
- Timestamps: `createdAt`, `updatedAt`

**Habit** - Trackable behavior
- `id`, `name`, `categoryId`, `priority` (1-3), `sortIndex`
- Optional `startDate` (effective tracking start)
- Timestamps: `createdAt`, `updatedAt`

**DailyScore** - Habit evaluation
- Nested structure: `date → habitId → score`
- Score range: `0 | 1 | 2`
- Immutable once date is locked

**TodoItem** - Active task
- `id`, `text`, `sortIndex`
- Timestamps: `createdAt`, `updatedAt`

**TodoArchiveItem** - Completed task
- `id`, `originalText`, `completedAt`

**WeeklyTask** - Recurring weekly target
- `id`, `name`, `targetPerWeek` (1-7)
- `history`: Record<LocalDateString, number>
- Weekly completion tracking

**DayLock** - Date immutability
- `date → boolean` mapping
- Prevents editing past scores
- Currently disabled (locking mechanism exists but not enforced)

**UIState** - Application preferences
- `selectedDate` - Current viewing date
- `themeMode` - 'light' | 'dark' | 'system'
- `dailyViewMode`, `dailyLeftMode`, `todoMode`
- `overviewMode`, `overviewRangeDays`, `overviewWindowEndDate`
- `selectedOverviewCategoryId`, `selectedOverviewHabitId`

---

## 7. Key Technical Decisions

### 7.1 No Backend
- **Rationale**: Personal use, privacy, zero infrastructure cost
- **Trade-offs**: No sync across devices, storage limits (~5-10MB)
- **Mitigation**: Export/import backup functionality

### 7.2 Custom State Management
- **Rationale**: Simple requirements, avoid library overhead
- **Pattern**: Subscribe/notify with automatic persistence
- **Benefits**: Full control, easy debugging, no magic

### 7.3 CSS Modules
- **Rationale**: Scoped styles, TypeScript integration
- **Pattern**: Component-level `.module.css` files + shared utilities
- **Benefits**: No class name conflicts, tree-shaking

### 7.4 Date Locking (Currently Disabled)
- **Rationale**: Prevent accidental changes to past data
- **Implementation**: Present but not enforced
- **Future**: Can be enabled via configuration

### 7.5 Component Extraction Strategy
- **Recent optimization**: Reduced large files (OverviewPage 878→196 lines)
- **Pattern**: Extract when >300 lines or clear responsibility boundary
- **Benefits**: Improved editor performance, easier maintenance

---

## 8. Recent Optimizations (January 2026)

### Step-by-Step Refactoring

**Step 1**: ArchivePage component extraction  
**Step 2**: DailyPage hooks extraction
- `useDailyData` - Data selection and memoization
- `useScoreHandlers` - Score mutation handlers

**Step 3**: OverviewPage component extraction
- `OverviewChart` - SVG rendering + helper functions
- `OverviewFilters` - Mode selection buttons
- `OverviewSelectionList` - Category/habit selection

**Step 4**: Storage normalization (verified already complete)

**Step 5**: Dead code removal
- Removed 136 lines of duplicate CSS from OverviewPage
- Eliminated old chart/list styles now in extracted components

**Step 6**: UI primitive consolidation
- Navigation buttons (`.navBtn`) → `shared.module.css`
- Icon buttons (`.iconBtn`) → `shared.module.css` with size variants
- Removed cross-imports between pages

### Results
- OverviewPage: 878 → 196 lines (77% reduction)
- ~200 lines of duplicate CSS eliminated
- Zero build errors or warnings
- All functionality preserved
- Improved VS Code/Copilot performance

---

## 9. Code Statistics

- **TypeScript files**: ~40 (`.ts`, `.tsx`)
- **CSS files**: 23 (`.css`, `.module.css`)
- **Components**: 20+ React components
- **Total lines**: ~8,000-10,000 (estimated)
- **Pages**: 4 main routes
- **Store actions**: 7 action modules

---

## 10. Development Workflow

### Build Commands
```bash
npm run dev      # Start Vite dev server (HMR enabled)
npm run build    # TypeScript compile + Vite production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### File Naming Conventions
- Components: PascalCase (e.g., `HabitGroupCard.tsx`)
- Styles: Matching component name (e.g., `HabitGroupCard.module.css`)
- Utilities: camelCase (e.g., `localDate.ts`)
- Types: Exported from `domain/types.ts`

### Styling Patterns
- Component styles in `.module.css` files
- Shared utilities in `components/ui/shared.module.css`
- CSS custom properties for theming
- Layout with CSS Grid and Flexbox

---

## 11. Future Considerations (LAB Phase)

The **LabPage** is reserved for experimental features and prototyping. Potential areas for exploration:

- Advanced visualizations
- Custom reports
- Data export formats
- Performance optimizations
- Mobile-responsive layouts
- Accessibility improvements
- Keyboard shortcuts
- Batch operations

The codebase is now optimized and ready for LAB experimentation without technical debt concerns.

---

## 12. Known Limitations

1. **Browser storage limits**: ~5-10MB depending on browser
2. **No device sync**: Data exists only in one browser
3. **No undo/redo**: Operations are immediate and irreversible (except via backup/restore)
4. **Desktop-first**: Mobile experience not optimized
5. **Single user**: No multi-user or sharing features
6. **Day locking disabled**: Intentional design choice for flexibility

---

## 13. Documentation Index

- `00_project_conventions.md` - Coding standards and philosophy
- `01_data_model.md` - Entity definitions and relationships (289 lines)
- `02_locking_rules.md` - Day locking behavior specification
- `03_components.md` - Component architecture
- `04_storage_schema.md` - localStorage structure
- `optimization_plan.md` - Recent refactoring documentation
- `visual_for_LAB.md` - Visual design notes for LAB features

---

## 14. Quick Reference

### Important Files
- Entry point: `app/src/main.tsx`
- Root component: `app/src/App.tsx`
- State store: `app/src/domain/store/appStore.ts`
- Storage: `app/src/persistence/storageService.ts`
- Types: `app/src/domain/types.ts`

### Key Directories
- `/domain` - Business logic (actions, store, types, utils)
- `/pages` - Route components with page-specific logic
- `/components` - Shared reusable components
- `/persistence` - localStorage abstraction

### Routing
- Root path redirects to DailyPage
- All routes are client-side (React Router)
- No server-side rendering

---

**Document version**: Pre-LAB (January 2026)  
**Last updated**: After optimization refactoring completion  
**Status**: Production-ready, fully optimized, zero technical debt
