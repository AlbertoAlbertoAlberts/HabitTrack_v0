# Overview Update Plan

This document describes three feature additions:

1. **Lab daily projects without tags** (project creation change)
2. **New data sources on the Overview chart** (lab daily scores, lab event occurrences, weekly score)
3. **Multi-select overlay mode** (up to 3 lines on the same chart)

---

## Feature 1: Lab Daily Projects Without Tags

### Goal
When creating a lab daily project, a checkbox (checked by default) determines whether the project uses tags. When unchecked, the project has no tag UI at all — just a score picker and an optional note.

### Data model
The `LabDailyProjectConfig` already has `completion.requireAtLeastOneTag` (boolean) and `allowExplicitNoTags` (boolean). We add a new field:

```ts
// in LabDailyProjectConfig
tagsEnabled?: boolean   // default true for backward compatibility
```

When `tagsEnabled` is `false`:
- `completion.requireAtLeastOneTag` is forced to `false`
- `allowExplicitNoTags` is forced to `true`
- The project stores no tags on daily logs (tags array is always `[]`, noTags is always `true`)

### Changes

| File | What changes |
|------|-------------|
| `domain/types.ts` | Add `tagsEnabled?: boolean` to `LabDailyProjectConfig` |
| `pages/LabPage/components/ProjectDialog.tsx` | Add a checkbox "With tags" (default checked). When unchecked, hide the Tag Window radio group. Wire the value into the config when submitting. |
| `pages/DailyPage/components/DailyLabWidget.tsx` | In `ProjectEntry`, when `project.config.kind === 'daily' && project.config.tagsEnabled === false`, hide the entire tags section (tag checkboxes, "No tags" checkbox, "Add tag" button). The expanded form only shows: outcome slider, note, and save. |
| `pages/LabPage/LabPage.tsx` | In the tag management area, if the active project has `tagsEnabled === false`, hide or disable the tag management panel with a note like "Tags are disabled for this project." |
| `domain/utils/labValidation.ts` | `isLabDailyLogComplete` — when `tagsEnabled === false`, skip the tag-related completeness checks. |

### Migration
No migration needed. `tagsEnabled` defaults to `undefined` → treated as `true`, so existing projects are unaffected.

---

## Feature 2: New Data Sources on the Overview Chart

### 2A. Lab Daily Scores on the Chart

#### Data flow
- Source: `state.lab.dailyLogsByProject[projectId][date].outcome`
- Conversion to percentage: `(outcome − config.outcome.scale.min) / (config.outcome.scale.max − config.outcome.scale.min)`
- If no log exists for a date → value is `NaN` (chart skips it, same as future dates)

#### UI
- In the filter section (`OverviewFilters`), add a new button: **"Lab"**
- When "Lab" mode is active, `OverviewSelectionList` shows all non-archived lab projects (both daily and event) in a combined list
- When a **daily** lab project is selected, the chart renders a line graph identical in style to the existing habits line — percentage on the Y-axis (0–100%)

### 2B. Lab Event Occurrences on the Chart

#### Data flow
- Source: `state.lab.eventLogsByProject[projectId]` — filter events whose date falls within the range
- Each event has a `timestamp` (ISO-8601) — extract the local date from it
- Group by date → count events per day

#### Rendering
- Rendered as **vertical columns/bars** on the chart (not a line)
- Fixed height (e.g., extend from 0% up to ~15% of chart height), serving as simple occurrence indicators
- If multiple events on the same day, show a small **count number** on top of the column
- Color: a muted red (e.g. `#ef4444` at 50% opacity) to distinguish from lines
- Bars sit behind line series (lower z-index) so they don't obstruct the lines

### 2C. Weekly Score on the Chart

#### Data flow
- Source: reuse the same computation as the sidebar weekly summary
- For a given week (Monday–Sunday):
  - `earned` = sum of completions capped at each task's target
  - `max` = sum of all task targets for that week
  - `percentage = earned / max`
- In 7-day view: a single flat horizontal line spanning the entire chart width at the % value
- In 30-day view: multiple stepped flat segments, one per week
  - Each segment spans Monday–Sunday of its week (clipped to the chart's date range)

#### Rendering
- Drawn as a dashed/solid horizontal line segment per week
- Color: a distinctive muted color (e.g., `var(--accent)` / indigo at 60% opacity), with a small label "Ned." at the right edge
- Sits behind the main series line

### Expanded `OverviewMode` type

```ts
export type OverviewMode =
  | 'overall'
  | 'priority1'
  | 'priority2'
  | 'priority3'
  | 'category'
  | 'habit'
  | 'lab'       // NEW — shows lab projects in selection list
  | 'weekly'    // NEW — shows weekly aggregate score
```

### Changes

| File | What changes |
|------|-------------|
| `domain/types.ts` | Extend `OverviewMode` union with `'lab'` and `'weekly'` |
| `domain/types.ts` → `UiStateV1` | Add `overviewSelectedLabProjectId: LabProjectId \| null` |
| `domain/actions/uiState.ts` | Add `selectOverviewLabProject(state, id)` action. Extend `setOverviewMode` to clear lab selection when mode changes away. |
| `domain/store/appStore.ts` | Wire new actions through the store |
| `pages/OverviewPage/components/OverviewFilters.tsx` | Add "Lab" and "Nedēļa" filter buttons |
| `pages/OverviewPage/components/OverviewSelectionList.tsx` | Handle `mode === 'lab'`: list all non-archived lab projects with mode badge (daily/event). On click, set `overviewSelectedLabProjectId`. |
| `pages/OverviewPage/hooks/useOverviewData.ts` | Add lab-aware series builder: when `mode === 'lab'` and a daily project is selected, build a `ChartPoint[]` from daily logs. When an event project is selected, build a separate `eventBars` array. When `mode === 'weekly'`, build flat-line segments from weekly completion data. Return new fields: `labEventBars`, `weeklySegments`, `selectedLabProject`. |
| `pages/OverviewPage/components/OverviewChart.tsx` | Accept new optional props: `eventBars?: EventBar[]`, `weeklySegments?: WeeklySegment[]`. Render event bars as `<rect>` elements. Render weekly segments as dashed `<line>` elements. These render beneath the main series. |
| `pages/OverviewPage/OverviewPage.tsx` | Pass new data from `useOverviewData` into `OverviewChart` and extend `OverviewSelectionList` props for lab project data. |
| `persistence/storageService.ts` | Ensure the new `UiStateV1` fields default correctly during load (null for lab project ID). |

### New types for chart data

```ts
type EventBar = {
  date: LocalDateString
  x: number       // SVG x position
  count: number   // number of events that day
}

type WeeklySegment = {
  xStart: number   // SVG x of week's first day (or chart start)
  xEnd: number     // SVG x of week's last day (or chart end)
  y: number        // SVG y for the percentage value
  pct: number      // 0..1 value for tooltip
  weekStart: LocalDateString
}
```

---

## Feature 3: Multi-Select Overlay Mode

### Goal
Allow selecting up to 3 items simultaneously, each rendered as a separate line on the same chart with distinct colors. Works for habits, lab daily projects, and weekly score.

### Color palette
| Slot | Color | Hex |
|------|-------|-----|
| 1st | White | `#ffffff` |
| 2nd | Cyan | `#06b6d4` |
| 3rd | Magenta | `#d946ef` |

When multi-select is active:
- The red→amber→green gradient line is replaced by solid-color lines
- The average line is hidden
- The trendline is hidden
- Each line uses its assigned slot color

### UI elements

#### Toggle button
Located in the **filter section** (left sidebar), between the section title "Filtrs" and the filter buttons. Rendered as a toggle-style button group:

```
[ 1 ]  [ 2 ]  [ 3 ]
```

Default: `1` (single-select, current behavior). Pressing `2` or `3` activates multi-select mode with that many slots.

When switching from a higher count to a lower one, excess selections are trimmed from the end.

When switching from multi to single (`1`), only the first selection is kept (if any).

#### Selected items display
Located **below the chart stats bar** (below Kopā / Vidēji / Maks. / Ieradumi), within the main content column. Shows the currently selected items as small chips/pills:

```
[■ Digitālā higiēna ✕]  [■ Yoga ✕]  [empty slot]
```

Each chip shows:
- A color swatch square matching its line color
- The item name
- An ✕ button to deselect

Empty slots show a muted placeholder like "—".

The stats bar (Kopā, Vidēji, etc.) is only shown in single-select mode. In multi-select mode it is hidden to avoid confusion about which series the stats belong to.

#### Selection behavior
- In single-select mode (`1`): clicking an item in the Atlase list behaves as today — toggles the single selection
- In multi-select mode (`2` or `3`):
  - Clicking an item in the Atlase list fills the next empty slot
  - If all slots are full, clicking replaces the last slot
  - Clicking an already-selected item deselects it (frees the slot)
  - The ✕ button on the chip deselects that slot

### Data model changes

```ts
// UiStateV1 additions
overviewMultiSelectCount: 1 | 2 | 3               // default 1
overviewMultiSelections: OverviewSelection[]        // max length = overviewMultiSelectCount

type OverviewSelection = {
  kind: 'habit' | 'labDaily' | 'labEvent' | 'weekly' | 'category' | 'priority' | 'overall'
  id?: string   // habitId or labProjectId — omitted for weekly/overall/priority
}
```

Multi-select is **only available** when `overviewMode` is `'habit'`, `'lab'`, or `'weekly'`. For `'overall'`, `'priority*'`, and `'category'`, single-select is forced. The toggle should be disabled/hidden for those modes, and switching to those modes resets `overviewMultiSelectCount` to 1.

When multi-select is active with count > 1:
- All items from the applicable modes (habits, lab projects, weekly) are shown in the Atlase list regardless of the current filter mode
- This allows mixing a habit with a lab daily project and the weekly score on the same chart

### Changes

| File | What changes |
|------|-------------|
| `domain/types.ts` | Add `OverviewSelection` type. Add `overviewMultiSelectCount` and `overviewMultiSelections` to `UiStateV1`. |
| `domain/actions/uiState.ts` | Add `setOverviewMultiSelectCount`, `addOverviewSelection`, `removeOverviewSelection`, `clearOverviewSelections` actions. Ensure `setOverviewMode` resets multi-select to 1 when switching to overall/priority/category. |
| `domain/store/appStore.ts` | Wire new actions |
| `pages/OverviewPage/components/OverviewFilters.tsx` | Add the `[1] [2] [3]` toggle component. Show it only for habit/lab/weekly modes. |
| `pages/OverviewPage/components/OverviewSelectionList.tsx` | In multi-select mode, show items from all selectable sources (habits + lab projects + weekly entry). Highlight already-selected items with their slot color. Handle click to add/remove from selections. |
| `pages/OverviewPage/hooks/useOverviewData.ts` | When multi-select count > 1, build multiple series arrays — one per selection. Return `multiSeries: Array<{ label: string, color: string, series: ChartPoint[], kind: string }>`. For event-type selections, include them in a separate event bars array. |
| `pages/OverviewPage/components/OverviewChart.tsx` | Accept a `multiSeries` prop. When present and length > 1, render multiple solid-color lines instead of the gradient line. Hide the average line and trendline. Each line gets its slot color. |
| `pages/OverviewPage/OverviewPage.tsx` | Add the **selected items chips** section below the stats bar. Show chips with color swatches and ✕ buttons. Hide the stats bar when multi-select is active. Pass multi-select data down to chart and selection list. |
| `pages/OverviewPage/OverviewPage.module.css` | Add styles for the selected chips row, color swatches, and ✕ buttons. |
| `pages/OverviewPage/components/OverviewFilters.module.css` | Add styles for the toggle button group. |
| `pages/OverviewPage/components/OverviewChart.module.css` | Add styles for event bar elements if needed. |
| `persistence/storageService.ts` | Default `overviewMultiSelectCount` to `1`, `overviewMultiSelections` to `[]` when loading state. |

---

## Implementation Order

The features have dependencies — implement in this order:

### Phase 1: Data & Types Foundation
1. Add `tagsEnabled` to `LabDailyProjectConfig` in `types.ts`
2. Add `'lab'` and `'weekly'` to `OverviewMode`
3. Add `overviewSelectedLabProjectId` to `UiStateV1`
4. Add `OverviewSelection`, `overviewMultiSelectCount`, `overviewMultiSelections` to `UiStateV1`
5. Update `persistence/storageService.ts` to handle new defaults

### Phase 2: Lab Tagless Daily Projects (Feature 1)
6. Update `ProjectDialog.tsx` — add "With tags" checkbox
7. Update `DailyLabWidget.tsx` — conditionally hide tag UI
8. Update `LabPage.tsx` — hide tag management when tags disabled
9. Update `labValidation.ts` — skip tag checks when tags disabled

### Phase 3: Store Actions
10. Add new uiState actions (lab project selection, multi-select)
11. Wire actions in `appStore.ts`

### Phase 4: Overview — New Data Sources (Feature 2)
12. Update `OverviewFilters.tsx` — add "Lab" and "Nedēļa" buttons
13. Update `OverviewSelectionList.tsx` — handle lab project listing
14. Update `useOverviewData.ts` — build lab daily series, event bars, weekly segments
15. Update `OverviewChart.tsx` — render event bars and weekly segments
16. Update `OverviewPage.tsx` — pass new data through

### Phase 5: Multi-Select Overlay (Feature 3)
17. Add toggle UI in `OverviewFilters.tsx`
18. Update `OverviewSelectionList.tsx` for multi-select behavior
19. Update `useOverviewData.ts` — build multiple series
20. Update `OverviewChart.tsx` — render multi-colored solid lines
21. Add selected chips section in `OverviewPage.tsx`
22. Style all new components

### Phase 6: Testing & Polish
23. Verify existing habit/category/priority overview modes still work
24. Verify lab project creation with and without tags
25. Verify chart renders correctly with 1, 2, 3 overlaid lines
26. Verify event bars display with counts
27. Verify weekly segments appear correctly in 7-day and 30-day views
28. Verify multi-select resets properly when switching filter modes
29. Check mobile/responsive layout

---

## Risks & Considerations

- **Chart performance**: Multi-series rendering triples the gradient segments. Since multi-select uses solid colors (no gradient), this is avoided — solid lines are cheaper to render.
- **Y-axis consistency**: All data sources use 0–100% so they share the same Y-axis. Weekly and lab scores are converted to percentages.
- **Tooltip in multi-select**: When hovering, the tooltip should show all series values for that date (one line per series, color-coded). This needs adjustment in the hover handler.
- **Event bars + lines**: Event bars render at the bottom of the chart. In multi-select with an event project selected alongside a line project, both coexist naturally.
- **State persistence**: New `UiStateV1` fields must have safe defaults so existing saved states load without errors. All new fields are optional or have fallback values.
- **Supabase sync**: The state shape change (new UiState fields) must be compatible with the sync logic. Since UiState is merged on load, new fields with defaults should work.
