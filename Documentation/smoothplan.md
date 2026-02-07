# Smooth Transitions Plan

Quick, gentle fade/slide transitions across the entire app.  
All durations use the existing motion tokens: `--t-fast` (140ms), `--t-med` (220ms), `--t-slow` (320ms), `--ease-out`.  
Everything respects `prefers-reduced-motion: reduce` (already collapses durations to 1ms globally in `index.css`).

---

## Phase 1 — Overview Page

### 1.1 Page entrance fade
- Wrap the page root in a CSS class with `@keyframes fadeIn` (`opacity 0→1`, `--t-med`).
- Applied once on mount so the page doesn't pop in.
- **Files:** `OverviewPage.module.css`, `OverviewPage.tsx` (add class to root `<div>`).

### 1.2 Chart crossfade on data change
- When range (7/30 days), filter mode, or selected item changes, the chart area (`OverviewChart` + KPI stats) should crossfade.
- Technique: CSS transition on `opacity` (`--t-fast`) + a transient `data-transitioning` attribute toggled by a short `useEffect` in the parent.
- **Files:** `OverviewPage.module.css`, `OverviewPage.tsx`, `OverviewChart.module.css`.

### 1.3 Date window navigation crossfade
- When ← / → arrows shift the date window, crossfade the chart and stats (same mechanism as 1.2, triggered by date-window change).
- **Files:** same as 1.2.

### 1.4 Filter & selection list transitions
- **Active filter button:** already has color transition; add a subtle `box-shadow` or `border-bottom` glow transition for the active state (`--t-fast`).
- **Selection list items appearing/changing:** When the list re-renders (e.g., switching from categories to habits), fade the list container (`opacity 0→1`, `--t-fast`).
- **Active item highlight:** crossfade the `listItemActive` background (`--t-fast`); already partially in place, verify smoothness.
- **Files:** `OverviewFilters.module.css`, `OverviewSelectionList.module.css`, `OverviewPage.tsx`.

### 1.5 Weekly progress bar fill
- The `progressFill` div already sets a dynamic width. Add `transition: width var(--t-med) var(--ease-out)` so it animates when values update.
- **Files:** `OverviewPage.module.css`.

### 1.6 Range toggle (7/30) transition
- The active state on the range buttons already transitions color. Ensure `box-shadow` / `background-color` transitions are present — verify only, likely no code change needed.

---

## Phase 2 — Daily Page

### 2.1 Page entrance fade
- Same `fadeIn` keyframe on the page root as Phase 1.
- **Files:** `DailyPage.module.css`, `DailyPage.tsx`.

### 2.2 Day navigation crossfade
- When ← / → date arrows are clicked, crossfade the center content (habit cards + scores + Lab widget).
- Technique: key the content wrapper by `selectedDate`; apply a `fadeIn` animation (`opacity 0→1`, `--t-fast`) on the wrapper so each day's content fades in.
- **Files:** `DailyPage.module.css`, `DailyPage.tsx`.

### 2.3 Score button selection feedback
- Currently only color transitions. Add a quick scale pulse on selection: `transform: scale(1.08)` for `60ms` then back to `scale(1)` via a CSS keyframe `@keyframes scorePop`.
- Apply `.scoreBtnActive` with the keyframe so it fires on each selection.
- **Files:** `ScoreRow.module.css`.

### 2.4 DailyLabWidget project expand/collapse
- Currently instant show/hide. Animate with:
  - **Expand:** wrap the detail section in a container with `@keyframes slideDown` (`opacity 0→1, max-height 0→500px`, `--t-med`).
  - **Collapse:** reverse (`opacity 1→0, max-height→0`, `--t-fast`). This requires keeping the element mounted briefly during exit.
  - Technique: add a `collapsing` CSS class, remove from DOM after the `--t-fast` transition ends (`onTransitionEnd`).
- **Files:** `DailyLabWidget.module.css`, `DailyLabWidget.tsx`.

### 2.5 Dialog close animation
- Currently dialogs open with `dialogIn` but close instantly. Add a close animation:
  - Before calling `.close()`, add a `.closing` class to the dialog that plays `dialogOut` (`opacity 1→0, translateY(0)→translateY(8px) scale(0.98)→scale(0.96)`, `--t-fast`).
  - On `animationend`, call the actual `.close()`.
  - Also animate the backdrop out (`opacity 1→0`, `--t-fast`).
- **Files:** `Dialog.tsx`, `Dialog.module.css`.

### 2.6 Mode switching (reorder/delete/rename/priority)
- When entering or exiting a mode, the extra UI elements (drag handles, delete icons, edit buttons, priority steppers) should fade in/out.
- Technique: add `@keyframes fadeIn` (`opacity 0→1`, `--t-fast`) to the mode-specific elements. For exit, CSS `transition: opacity --t-fast` + a brief `exiting` state.
- **Files:** `LeftPanelCategoriesList.module.css`, `HabitRow.module.css`, `WeekPanel.module.css`, `RightTodosPanel.module.css`.

### 2.7 Burger menu (`<details>`) close animation
- Currently menus open with `menuIn` but close instantly. Use the same pattern as Dialog close:
  - On the `<details>` `onToggle` event, if closing, add a `closing` class, wait for transition, then allow DOM to collapse.
  - Alternatively, switch from `<details>` to a controlled open/close with CSS transitions.
- **Files:** `DailyShared.module.css`, `DailyPage.tsx` (menu host), `LabMenu.module.css` (Lab equivalent).

### 2.8 Category delete popover exit
- Currently has `popoverIn` but no exit. Add `@keyframes popoverOut` (`opacity 1→0, translateY(0)→translateY(-4px)`, `--t-fast`), triggered before unmounting.
- **Files:** `DailyShared.module.css`, `DailyPage.tsx` (popover host).

### 2.9 Weekly progress ring increment
- When the ring's filled segment count changes, animate the SVG `stroke-dashoffset` with a CSS transition (`--t-med`).
- **Files:** `WeeklyProgressRing.module.css` or inline style on the `<circle>`.

### 2.10 Todo completion fade-out
- When a todo is checked, fade + slide the row out (`opacity 1→0, translateX(10px)`, `--t-fast`) before removing it from the list.
- **Files:** `RightTodosPanel.module.css`, `RightTodosPanel.tsx` (delay removal by `--t-fast`).

### 2.11 "New tag" inline dialog (DailyLabWidget) entrance
- The inline new-tag form appears instantly. Add `fadeIn` (`opacity 0→1`, `--t-fast`).
- **Files:** `DailyLabWidget.module.css`.

---

## Phase 3 — Lab Page

### 3.1 Page entrance fade
- Same `fadeIn` keyframe as Phase 1/2.
- **Files:** `LabPage.module.css`, `LabPage.tsx`.

### 3.2 Project selection crossfade
- When switching active project, the Analysis panel and Tags panel should crossfade (`opacity 0→1`, `--t-fast`).
- Technique: key the center/right panels by `activeProjectId`; apply `fadeIn` animation.
- **Files:** `LabPage.module.css`, `LabPage.tsx`.

### 3.3 Project card active state transition
- `projectCardActive` already has basic transitions. Enhance with a smooth `box-shadow` or `border-color` glow transition so the selection feels more tangible.
- **Files:** `LabPage.module.css`.

### 3.4 Tab switching crossfade (FindingsView)
- When switching analysis tabs, crossfade the tab panel content (`opacity 0→1`, `--t-fast`).
- Technique: key the panel content by `activeTab`; apply `fadeIn`.
- **Files:** `FindingsView.module.css`, `FindingsView.tsx` or `LabResultsTabs.module.css`.

### 3.5 Tags/Groups view toggle crossfade
- Same crossfade technique when switching between tag-level and group-level views.
- **Files:** `FindingsView.module.css`, `FindingsView.tsx`.

### 3.6 Tag stats expansion
- `TagStatsView` item expansion is currently instant. Animate the detail section with `slideDown` (`max-height + opacity`, `--t-med`).
- **Files:** `TagStatsView.module.css`, `TagStatsView.tsx`.

### 3.7 Data maturity progress bars
- Already have `transition: width 0.3s ease`. Verify they animate on first render (may need to start at `width: 0` and transition to target). No change expected.

### 3.8 Event log form expand/collapse
- "AddEventForm" appears/disappears instantly. Add `fadeIn` on mount and a brief `fadeOut` before unmount (same pattern as Dialog close, using a `closing` state).
- **Files:** `EventLogList.module.css`, `EventLogList.tsx`.

### 3.9 Event log item expand/collapse
- Individual event log items expand to show details instantly. Animate with `slideDown`/`slideUp` as in 2.4.
- **Files:** `EventLogList.module.css`, `EventLogList.tsx`.

### 3.10 Delete confirmation overlay fade
- The custom `.deleteOverlay` / `.deleteDialog` appears instantly. Add `@keyframes fadeIn` (`opacity 0→1`, `--t-fast`) to the overlay and `dialogIn`-style animation to the dialog box.
- For dismiss: play `fadeOut` before removing from DOM.
- **Files:** `LabPage.module.css`, `LabPage.tsx`.

### 3.11 Notice/error banner slide-in
- `tagsNotice` banner (e.g., "Cannot delete tag in use") appears instantly. Add `@keyframes slideInRight` or `fadeIn` (`--t-fast`) on mount, and fade out when dismissed.
- **Files:** `LabPage.module.css`, `LabPage.tsx`.

### 3.12 Mode switching (edit/delete/reorder) for projects & tags
- Same pattern as Daily page (2.6): fade in/out the mode-specific overlays (edit buttons, delete buttons, drag handles) with `fadeIn` / `opacity` transition (`--t-fast`).
- **Files:** `LabPage.module.css`.

### 3.13 Lab menu close animation
- Same `<details>` menu close pattern as Daily page (2.7) — add exit transition.
- **Files:** `LabMenu.module.css`, `LabMenu.tsx` or `LabPage.tsx`.

---

## Shared Utilities (implement once, reuse across phases)

These are foundational pieces created during Phase 1 or early Phase 2, then reused later.

| Utility | Description | Where |
|---|---|---|
| `@keyframes fadeIn` | `opacity 0→1` at `--t-fast` | `index.css` (global) |
| `@keyframes fadeInMed` | `opacity 0→1` at `--t-med` | `index.css` (global) |
| `.fadeIn` helper class | applies `fadeIn` animation | `index.css` (global) |
| `@keyframes scorePop` | `scale(1)→scale(1.08)→scale(1)` at `60ms` | `ScoreRow.module.css` |
| `useAnimatedUnmount` hook | delays unmount by N ms while a `.exiting` CSS class plays a fade-out; returns `{ shouldRender, className }` | `app/src/hooks/useAnimatedUnmount.ts` |
| `useDialogClose` / Dialog `.closing` | enriches the Dialog component with exit animation support | `Dialog.tsx` + `Dialog.module.css` |

---

## Implementation Notes

- **Durations:** Keep everything ≤ `--t-med` (220ms). Fades should be `--t-fast` (140ms) by default; only use `--t-med` for larger content area transitions (chart crossfade, expand/collapse).
- **Easing:** Use `--ease-out` for enters, `ease-in` for exits.
- **No layout shift:** Avoid `height` animations on variable content. Prefer `max-height` with a generous cap or `opacity`-only fades.
- **Reduced motion:** Already handled globally — all durations collapse to 1ms when `prefers-reduced-motion: reduce` is set.
- **Performance:** Use `opacity` and `transform` only (GPU-composited); avoid animating `width`, `height`, `margin`, `padding` directly. Exception: progress bars (`width` is fine for thin bars).
- **Key-based fades:** For content that swaps (day nav, project selection, tab switching), wrapping a container with `key={value}` and a CSS `fadeIn` animation is the simplest pattern — React re-mounts the element, the animation plays automatically.
