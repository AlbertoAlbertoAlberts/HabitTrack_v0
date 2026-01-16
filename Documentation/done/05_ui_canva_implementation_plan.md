# 05_ui_canva_implementation_plan.md — Canva-style UI plan

Date: 2026-01-14

Goal: implement a UI that generally matches the provided Canva sketches (3-column Daily page + chart-focused Overview page), while keeping **all behaviors and data rules** exactly as defined in:
- 00_project_conventions.md
- HABIT_TRACKER_SPEC.md
- 01_data_model.md
- 02_locking_rules.md
- 03_components.md
- 04_storage_schema.md

Non-goals:
- No new business behaviors beyond the spec.
- No new persistent data structures beyond the existing model.
- No backend/auth/cloud sync.

---

## 1) Daily page (Page 1) — target layout

### 1.1 Overall frame
Three columns:
- Left: “Izaicinājumi” (categories + habits, always expanded)
- Middle: scoring area for selected date
- Right: TO-DO panel

Acceptance criteria:
- 3-column layout on desktop; gracefully collapses on small widths.
- Each column is independently scrollable where appropriate.

### 1.2 Middle top bar (match sketch hierarchy)
Controls (left to right):
- View tabs: `KATEGORIJA` / `PRIORITĀTE`
- Date navigation: left arrow, date label (DD.MM.YYYY), right arrow (disabled when viewing today)
- Button to go to Overview (`PĀRSKATS`)

Acceptance criteria:
- Tabs control ONLY the middle scoring grouping (category vs priority), no behavior change.
- Date arrows obey the spec (unlimited past, cannot go “future” beyond today).
- Leaving the day (date change or route change) still triggers commit-on-leave lock logic.

### 1.3 Left column header + hamburger menu
Replace the current “many buttons” toolbar with a hamburger menu.
Menu items (UI-only re-homing of existing actions):
- Add category
- Change priority (enter/exit priority edit mode)
- Reorder mode (drag & drop)
- Delete mode (trash icons + confirm)

Acceptance criteria:
- Existing modes still behave exactly as implemented.
- Priority edit exit still flushes pending priority repositioning.

### 1.4 Scoring cards
- Category view: category cards with habit rows and 0/1/2 buttons.
- Priority view: priority cards (1/2/3) with habit rows.

Acceptance criteria:
- Locked day disables score changes (read-only) exactly per 02_locking_rules.md.
- Name truncation (ellipsis) remains.

### 1.5 TO-DO panel
- Header “TO-DO”
- Add item
- Archive button ("Arhīvs")

Acceptance criteria:
- Completing an item moves it to archive.
- Delete behavior remains permanent.

---

## 2) Overview page (Page 2) — target layout

### 2.1 Overall frame
- Chart occupies the top area.
- Bottom-left: selection panel (categories/habits list depending on mode).
- Bottom-right: filter panel (exclusive modes).
- Right side actions: “SĀKUMA LAPA” + 7/30 range buttons.

Acceptance criteria:
- Filter modes remain exclusive (overall, P1, P2, P3, category, habit).
- Chart Y-max rules remain per spec.

---

## 3) Implementation sequencing (safe increments)

Phase A — foundation
1. Remove Vite template centering/max-width styles to allow full-width app frame.
2. Introduce shared layout primitives (App frame + top bars) or implement equivalent structure directly inside pages.

Phase B — Daily layout match
3. Move view tabs + date nav into the middle header.
4. Add Overview button in Daily middle header.
5. Replace left toolbar with hamburger menu.

Phase C — Overview layout match
6. Re-layout Overview page to match chart + selection + filters hierarchy.

Phase D — polish
7. Harmonize typography, spacing, and button styles (modern look, not pixel-perfect match).
8. Ensure scroll containers behave like the sketch.

---

## 4) Known constraints / notes
- Dates are stored/handled as `YYYY-MM-DD` local (domain). Display formatting can be DD.MM.YYYY in UI.
- Drag & drop remains the current implementation approach.
- Persistence behavior remains unchanged (storageService already exists in repo).
