# LAB Results Page – Design & Implementation Plan (LAB_design_plan.md)

Date: 2026-01-24

## Goal

Rework the LAB project “results page” UI so analysis is **compartmentalized into tabbed sections**, reducing long-page overload while preserving existing content, visuals, and meaning.

You want a **top row of pressable buttons** (tabs). Each tab reveals one section.

### Tabs / Sections
1. **Top results**: top 10 findings across positive + negative, ordered by absolute effect size.
2. **Positive effects**: same content as now, strongest → weakest.
3. **Negative effects**: same content as now, strongest → weakest.
4. **Tag statistics**: split view (left tag list, right detail panel) as per sketch; tags ordered by maturity; least mature at bottom.
5. **Tag coverage**: same content as now.
6. **Most uncertain**: same content as now, strongest → weakest.

### Data Maturity card placement
Move the existing “Data Maturity” content into a card placed **in the main analysis area** exactly where it appears in the sketch. (Colors remain as-is.)

### Tab UX requirements
- Tabs are pressable buttons along the top of the analysis panel.
- Switching tabs **preserves internal state** (ex: selected tag in Tag Statistics stays selected when you move away and return).
- The selected tab is reflected in the URL (query param), so it’s **bookmarkable/shareable**.
- Normal page scrolling is fine; no need for internal scroll regions.

---

## Non-goals (for this redesign)
- No palette/theme changes (layout only).
- No change to underlying analysis algorithms unless necessary for maturity metrics.
- No new statistical methods (keep existing findings as source-of-truth).

---

## Definitions

### “Strength”
For ordering where “strongest” is referenced:
- Sort by `abs(effectSize)` descending.
- Tie-breaker (recommended): higher confidence > higher nTotal > stable deterministic fallback (id).

### “Maturity” (tag-level)
You want tags ordered by “maturity” (least mature at bottom), and maturity visible.

Phase 1 will implement a simple, transparent heuristic:
- Inputs available today: counts/coverage from existing datasets or tag coverage computation.
- Proposed v1 maturity score (example):
  - `maturityScore = min(1, nExposed / thresholdExposed)` where thresholdExposed might be 10–14.
  - Optionally incorporate `nTotal`.
- Display as label or small badge (e.g., “Early”, “Growing”, “Mature”) based on score.

We’ll implement it so the metric can be swapped later without UI rewrite.

---

## Phase Plan

### Phase 0 — Baseline & scope lock (short)
**Purpose**: ensure we can safely refactor UI without breaking data.

Steps:
1. Identify current components responsible for:
   - results header area
   - positive/negative/uncertain lists
   - tag coverage view
   - tag statistics (if already exists)
   - maturity display
2. Decide if we will implement tabs as:
   - local component state + URL query param syncing, or
   - router-based nested routes.

#### Tabs implementation decision (Phase 0 / Step 2)

Decision: **use local UI state synced to a URL query param** (not nested routes).

Why:
- Matches the requirement: bookmarkable/shareable tab selection.
- Minimal refactor surface: `LabPage` route stays the same; we only swap which section is rendered.
- Easier state preservation: keep per-tab state in the parent component while the URL controls which tab is visible.

URL contract:
- Route stays `/lab`.
- Tab is stored in query param: `?tab=<key>`.
- Supported keys:
   - `top` (Top results)
   - `positive`
   - `negative`
   - `stats` (Tag statistics)
   - `coverage` (Tag coverage)
   - `uncertain`
- Default when missing/invalid: `top`.

Acceptance criteria:
- No visual change yet; we only map ownership and data flow.

#### Component ownership map (Phase 0 / Step 1)

**Page entry**
- `LabPage` renders the two-column layout and mounts the analysis view via `FindingsView`.

**Analysis container + current sections**
- `FindingsView`
   - Runs analysis (`runAnalysisForProject`) and persists cache updates.
   - Renders the current “results page” as one vertical stack of sections.
   - Owns current *Strongest Negative*, *Strongest Positive*, and *Most Uncertain* lists (currently each sliced to 5).

**Data maturity (and current tag coverage bars)**
- `DataMaturityView`
   - Rendered inside `FindingsView` as the first section.
   - Computes maturity from `buildDailyDataset(...).coverage.validRows`.
   - Also renders per-tag “Tag Coverage” bars (presentCount / totalCount) inside the maturity panel.

**Tag statistics (current implementation)**
- `TagStatsView`
   - Rendered inside `FindingsView` as the last section.
   - Currently renders one card per tag (not a split-pane selector UI yet).
   - Computes per-tag present/absent counts and shows tag-specific findings.

**Tag coverage (dedicated tab content)**
- No separate “Tag Coverage page component” currently found under `pages/LabPage`.
   - Closest equivalents today are:
      - The per-tag coverage bars inside `DataMaturityView`.
      - `DatasetDebugView` which exposes dataset coverage metrics for debugging.

**Notes for later phases (no changes yet)**
- The new tabbed layout will likely wrap/recompose `FindingsView` content into separate views rather than inventing new analysis logic.

---

### Phase 1 — Tabs shell + URL sync + state preservation (medium)
**Purpose**: create the new page structure without changing section internals.

Steps:
1. Add a `LabResultsTabs` UI with 6 tab buttons.
2. Implement URL sync:
   - Query param (e.g., `?tab=top|positive|negative|stats|coverage|uncertain`).
   - Default tab if missing (e.g., `top`).
3. Preserve state:
   - Keep tab selection in URL.
   - Keep per-tab internal state in React state in the parent container.

Acceptance criteria:
- Clicking tabs swaps content area.
- Browser back/forward navigates between tabs.
- Reloading the page keeps the selected tab.

Risks:
- Avoid re-running heavy analysis computations on every tab switch; memoize where needed.

---

### Phase 2 — Data Maturity card relocation (short)
**Purpose**: move existing maturity content to match the sketch.

Steps:
1. Extract “Data Maturity” current UI into a reusable card component.
2. Render it in the new main analysis header layout per sketch.

Acceptance criteria:
- Same content as before, same colors, just positioned per sketch.

---

### Phase 3 — Top results tab (medium)
**Purpose**: add the new combined “Top results” view.

Steps:
1. Build selector that merges findings from positive + negative + uncertain sources (depending on how the app currently stores them):
   - Flatten to one list.
   - Sort by `abs(effectSize)` descending.
   - Take top 10.
2. Render list in a compact summary card layout:
   - show tag name
   - show sign (+/-) and effect value
   - show confidence + n
   - show short summary line

Acceptance criteria:
- Exactly 10 items shown.
- Mixed positive/negative sorted by absolute effect.

---

### Phase 4 — Positive/Negative/Uncertain tabs parity (short)
**Purpose**: ensure existing tabs match current content but are contained.

Steps:
1. Move current Positive Effects view into `Positive` tab.
2. Move current Negative Effects view into `Negative` tab.
3. Move current Uncertain view into `Uncertain` tab.
4. Confirm ordering is still strongest → weakest.

Acceptance criteria:
- Each tab matches today’s content and ordering.

---

### Phase 5 — Tag Statistics redesign (larger; split into steps)
**Purpose**: implement the split-pane Tag Statistics view.

Steps:
1. **Data model / selectors**:
   - Ensure we can compute, per tag:
     - findings list (if any)
     - exposure counts / coverage
     - a maturity indicator (v1 heuristic)
2. **Left tag menu**:
   - Show all tags.
   - Display maturity indicator per tag (badge/mini bar).
   - Sort tags by maturity descending.
   - Persist selected tag across tab switches.
3. **Right panel**:
   - Show selected tag name.
   - Show summary stats: present/absent counts, coverage %.
   - Show tag-specific findings (all windows/methods currently supported), grouped as in your screenshot.
4. **Empty states**:
   - If tag has no findings yet: show “Not enough data yet” style message, but still show coverage/maturity.

Acceptance criteria:
- Left tag menu remains visible.
- Selecting a tag updates the right panel.
- Tags are ordered by maturity with least mature at bottom.
- Maturity is visible without hunting.

Risks:
- If maturity relies on calculations not currently exposed, we may need to add a small selector/helper in the analysis layer.

---

### Phase 6 — Tag Coverage tab integration (short)
**Purpose**: preserve existing Tag Coverage content in its own tab.

Steps:
1. Move current Tag Coverage view into `Coverage` tab.
2. Confirm nothing changes besides layout containment.

Acceptance criteria:
- Same Tag Coverage content as before.

---

### Phase 7 — Polish & performance (medium)
**Purpose**: make the new layout feel solid.

Steps:
1. Ensure tab buttons have clear selected state.
2. Confirm keyboard accessibility (tab navigation + enter/space).
3. Memoize computed lists used by multiple tabs.
4. Ensure stable rendering (no jumping) when switching tabs.

Acceptance criteria:
- No noticeable lag on tab switch.
- Good accessibility baseline.

---

### Phase 8 — Tests / verification (as available)
**Purpose**: keep refactor safe.

Steps:
1. Add unit tests for:
   - Top 10 selection + ordering by abs effect
   - URL tab parsing + defaulting
   - tag maturity ordering
2. Manual verification checklist with the `Morning_dummy` dataset:
   - Top results shows 10 combined.
   - Positive/Negative/Uncertain match current.
   - Tag Statistics shows all tags, maturity visible, ordering correct.
   - URL reflects selected tab.

Acceptance criteria:
- Tests pass (where test infra exists).

---

## Rollout strategy
- Implement phases in order.
- After each phase, validate with the dummy dataset.
- Keep changes behind minimal risk boundaries (mostly UI composition refactors).

---

## Open items / future upgrades
- Replace tag maturity heuristic with a more meaningful model (could align to LAB_SPEC “stages”).
- Improve Data Maturity card visuals.
- Make Tag Statistics right panel richer (trend charts, dose-response charts).
