# LAB Mode – Implementation Phases & Version Plan (LAB_PHASES.md)

This document defines the **step-by-step implementation plan** for LAB mode,
from initial scaffolding to the first usable release (**LAB 1.0.0**).

Each phase is intentionally small, verifiable, and safe for Copilot-driven work.

---

## Versioning Philosophy

- LAB uses **semantic versioning**
- Versions < 1.0.0 are experimental but structured
- **LAB 1.0.0 = first usable, end-to-end, local LAB**
- Later versions add power, not rewrites

---

## Phase Overview

| Phase | Version | Goal |
|------|--------|-----|
| Phase 0 | 0.0.x | Preparation & scaffolding |
| Phase 1 | 0.1.0 | LAB state + migration |
| Phase 2 | 0.2.0 | Project & tag CRUD |
| Phase 3 | 0.3.0 | Logging (daily + event) |
| Phase 4 | 0.4.0 | Dataset normalization |
| Phase 5 | 0.5.0 | Analysis engine (v1 methods) |
| Phase 6 | 0.6.0 | Findings UI + maturity |
| Phase 7 | 0.7.0 | Stability & refactor |
| Release | 1.0.0 | LAB usable release |

---

## Phase 0 – Preparation (0.0.x)

**Goal**
- Prepare the codebase without changing behavior

**Tasks**
- Add `lab/` folder in domain or features layer
- Add empty `LAB_SPEC.md`, `LAB_DATA_MODEL.md`, `LAB_PHASES.md` (already done)
- Decide where LAB state will live inside existing app state

**Acceptance Criteria**
- No runtime behavior changes
- No persistence changes yet

---

## Phase 1 – LAB State & Migration (0.1.0)

**Goal**
- Add LAB to persisted app state safely

**Tasks**
1. Extend app state:
   - Add `lab?: LabState`
2. Add LAB initialization function:
   - `createEmptyLabState(): LabState`
3. Add migration logic:
   - If persisted state has no `lab`, inject empty LAB state
4. Ensure saving/loading includes LAB state
5. Add basic unit test or manual test:
   - Load existing localStorage → LAB appears empty but app still works

**Acceptance Criteria**
- Existing users’ data remains intact
- LAB state persists and reloads correctly
- App works exactly as before

---

## Phase 2 – Projects & Tags CRUD (0.2.0)

**Goal**
- Create and manage LAB projects and tags

**Tasks**
1. Implement project creation:
   - name
   - mode (`daily` or `event`)
   - config based on mode
2. Store project in:
   - `lab.projects`
   - `lab.projectOrder`
3. Implement tag library per project:
   - create tag
   - edit tag
   - delete tag (soft-delete or block if in use)
4. Enforce tag invariants:
   - unique name per project
   - intensity rules
5. Basic UI in `/lab`:
   - list of projects
   - project creation dialog
   - tag management view per project

**Acceptance Criteria**
- Multiple projects can exist
- Tags are project-scoped
- Intensity rules enforced
- No logs yet

---

## Phase 3 – Logging (Daily & Event) (0.3.0)

**Goal**
- Enter real data for projects

### Daily Projects

**Tasks**
1. Implement daily log entry:
   - date
   - outcome value
   - tags + optional intensity
   - explicit “no tags” option
2. Enforce completion rules:
   - outcome required
   - at least one tag NOT required (v1)
3. Allow editing same-day entry (overwrite by date)
4. Integrate DailyPage widget:
   - show all LAB projects (both daily and event)
   - quick entry without leaving Daily page
   - daily projects: log outcome and tags for selected date
   - event projects: log new event with current timestamp

### Event Projects

**Tasks**
1. Implement event log entry:
   - timestamp
   - tags (+ intensity)
   - optional note
2. Append-only behavior (edit allowed)
3. Optional daily “no event today” marker
4. Simple event log list UI

**Acceptance Criteria**
- Data entry works for both project modes
- Missing days/events do not break anything
- Logs persist and reload correctly

---

## Phase 4 – Dataset Normalization (0.4.0)

**Goal**
- Convert raw logs into analysis-ready datasets

**Tasks**
1. Implement dataset builders:
   - `buildDailyDataset(projectId)`
   - `buildEventDataset(projectId)`
2. Daily dataset:
   - one row per date
   - outcome
   - tag presence
   - tag intensity
3. Event dataset:
   - one row per event
   - timestamp
   - tag presence/intensity
4. Handle missing data gracefully:
   - skip incomplete rows
   - record coverage stats
5. Add simple debug view (dev-only):
   - print dataset as table/JSON

**Acceptance Criteria**
- Dataset builders are pure functions
- Output matches expectations
- Safe for future dummy data injection

---

## Phase 5 – Analysis Engine v1 (0.5.0)

**Goal**
- Produce meaningful findings

**Core Methods (v1)**
1. **Presence effect**
   - tag present vs absent → outcome difference
2. **Lag effects**
   - lag-1, lag-2, lag-3 (daily projects)
3. **Rolling accumulation**
   - rolling 3-day and 7-day intensity sums
4. **Simple dose response**
   - compare intensity bins
5. **Regime summary**
   - tags common on low vs high outcome days

**Tasks**
1. Define `LabCorrelationMethod` interface
2. Implement v1 methods as pure functions
3. Implement method runner:
   - selects applicable methods per project
4. Apply guardrails:
   - minimum occurrences
   - exclude rare tags
5. Generate `LabFinding` objects
6. Cache findings with fingerprint

**Acceptance Criteria**
- Findings generated for real data
- No findings shown when insufficient data
- Engine runs deterministically

---

## Phase 6 – Findings UI & Data Maturity (0.6.0)

**Goal**
- Make results understandable and honest

**Tasks**
1. Findings list view:
   - strongest negative
   - strongest positive
   - most uncertain
2. Tag drill-down view:
   - per-tag stats
   - raw numbers
3. Data maturity visualization:
   - project-level stage
   - per-tag progress bars
4. Human-readable summaries rendered from findings

**Acceptance Criteria**
- Users can interpret results without guessing
- Data insufficiency is clearly communicated

---

## Phase 7 – Stability & Cleanup (0.7.0)

**Goal**
- Prepare for first real usage

**Tasks**
1. Refactor naming & folder structure
2. Add basic tests for:
   - dataset builders
   - analysis methods
3. Add safeguards:
   - prevent recomputation storms
   - ensure cache invalidation correctness
4. UX polish:
   - loading states
   - empty states
   - error boundaries

**Acceptance Criteria**
- LAB feels solid and predictable
- No fragile or experimental UX left

---

## Release – LAB 1.0.0

**Definition of Done**
- Local-only LAB usable daily
- Supports:
  - daily projects
  - event projects
  - tags with optional intensity
  - real findings
- No breaking interactions with Habit Tracker
- Clear limitations communicated in UI

---

## Post–1.0.0 (Not Implemented Yet)

Examples:
- 1.1.0 Synthetic data generator
- 1.2.0 Supabase sync
- 1.3.0 Objective API integrations (Oura)
- 2.0.0 Advanced statistical methods & multi-event/day

---

## Guiding Principle

> “First make it correct, then make it powerful.”

LAB evolves by **adding modules**, not rewriting foundations.