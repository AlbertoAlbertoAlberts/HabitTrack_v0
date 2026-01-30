# LAB Event Projects — Plan to Reach Daily-Parity UI + “Working” Analysis

## Goal
Make **event-mode LAB projects** feel as complete as **daily-mode projects**:
- Same **Results layout** (tabs, cards, coverage, stats) in the Lab UI.
- Provide **useful, explainable signals** from event logs and tags (and optional intensity), including:
  - Tag-level insights
  - Group-level insights (user-defined)
  - Frequency/occurrence visuals (how often symptoms happen)

## Key Constraint (Reality Check)
Event-only logging (“I only log when I have symptoms; I don’t log baseline diet”) limits what “correlation” can mean.
- Daily analysis works because outcome varies across days and exposures vary across days.
- Event-only data has **no explicit non-event exposure observations**.

So we will deliver event analysis in layers:
- **Layer 1 (always possible):** “What commonly co-occurs with events?” (frequencies, co-occurrence, streaks, tag coverage).
- **Layer 2 (stronger correlation):** “What associates with *severity* or *episode intensity*?” (requires an outcome value per event such as severity or inferred severity proxy).
- **Layer 3 (true occurrence correlation, optional later):** requires some form of baseline/non-event exposure capture.

This plan gets you to **daily-parity UI** and **meaningful event insights** without forcing you to log your full diet.

---

## Working Definitions (based on your answers)

### Data semantics
- You log an **event** whenever symptoms occur.
- Each event has a timestamp and tags representing exposures in the last ~3–6 hours.
- Optional: event **severity** (0–10 or 1–5) and optional tag intensities.
- Consecutive events (“multiple logs in a row”) indicates a more severe episode.

### Analysis targets
- Primary: identify tags/groups that **appear frequently** with events and help you narrow down likely causes.
- Secondary: show **how often** symptoms happened (trend/heatmap/calendar).
- If severity is present or can be inferred: identify tags/groups associated with **higher severity**.

### UI parity target
Reuse the existing Results UI structure:
- Tabs: Top / Positive / Negative / Uncertain / Stats / Coverage
- Cards: effect size, confidence, sample size
- Tag Coverage + Data Maturity

---

## Open Questions (we can proceed with assumptions)
1) Severity scale: do we want 1–10 by default, like daily, or a simpler 1–5?
2) If severity is missing, should we infer a proxy (e.g., episode intensity from streak length)?
3) Group membership: currently a tag has one `group` string; do we need multi-group per tag soon?

Assumption for v1:
- Severity uses a **1–10** scale by default (optional field).
- Severity is optional; we’ll support it in schema/UI.
- One group per tag (current model) but analysis supports toggling between “tag view” and “group view”.

---

## Phase 0 — Audit + Spec Lock (short)
**Outcome:** a mini-spec that defines event outcomes + method semantics so the UI can mirror daily.

Steps:
1) Confirm event severity scale defaults (propose 0–10 or 1–10).
2) Confirm “Positive/Negative effect” meaning for event projects:
   - Interpreted as “increases/decreases severity (or proxy)” rather than occurrence.
3) Confirm how to treat multiple events per day:
   - Keep each event as a row for analysis; offer optional day-level aggregation for “frequency” visuals.

Implementation note (done):
- Per-event rows remain the core dataset (`buildEventDataset`).
- A simple day-bucket helper exists for frequency stats/visuals (`buildEventDailyFrequency`).

UI note (done):
- Results messaging clarifies: per-event rows for analysis, optional day-bucket aggregation for frequency.

Acceptance criteria:
- A single documented definition of `effect`, `confidence`, and `sampleSize` for event findings.

---

## Phase 1 — Data Model + Logging UX for Severity (core enabler)
**Outcome:** event logs can carry severity; tags can optionally carry intensity.

Steps:
1) Extend event project config to define severity scale and enable it in UI.
   - Likely in: `app/src/domain/types.ts` and any event-project config types.
2) Update event log creation/editing UI to include:
   - Optional severity field
   - Optional note (already)
   - Tag intensity input (optional; only for tags that enable intensity)
3) Ensure persistence/migrations/repair are safe.

Acceptance criteria:
- You can log an event with optional severity.
- Stored state round-trips with no errors.

---

## Phase 2 — Event Dataset Builder v2 (analysis-ready)
**Outcome:** create derived datasets that support both tag-level and group-level analysis and frequency visuals.

Steps:
1) Keep the existing per-event dataset (each event is one row).
2) Add derived fields:
   - `severity?: number`
   - `episodeId` or inferred episode grouping (optional in v1)
   - `episodeIndexWithinStreak` / `streakLength` (computed)
3) Add a “group projection” dataset:
   - For each row, compute group presence from tag presence.
   - Groups become “virtual tags” for analysis.
4) Add a daily-bucketed summary dataset for frequency visual:
   - `date -> countEvents, maxSeverity, avgSeverity` etc.

Acceptance criteria:
- A pure function can build:
  - event rows dataset
  - group-projected dataset
  - daily-frequency dataset

---

## Phase 3 — Event Analysis Methods (Daily-parity semantics)
**Outcome:** event projects produce findings so the existing Results UI can render them.

### 3.1 Minimal “always possible” methods (no severity required)
These won’t produce positive/negative effects meaningfully, but can feed “Top” and “Stats”.
- Tag frequency ranking (presence count, presence rate).
- Co-occurrence: tags that commonly appear together.
- Group frequency ranking.

UI mapping:
- Top: most frequent tags/groups
- Stats: counts/coverage
- Coverage: already supported
- Positive/Negative/Uncertain: can be hidden or repurposed if severity absent.

### 3.2 Severity association methods (unlocks full tab parity)
If severity is present (or a proxy exists), we can mirror daily-style correlations:
- **Mean difference:** compare mean severity when tag present vs absent.
  - `effect = mean(severity|present) - mean(severity|absent)`
- Confidence from sample sizes + variance (simple heuristic like daily v1).
- Same for groups.

UI mapping:
- Positive: increases severity
- Negative: decreases severity
- Uncertain: low confidence / small N

Acceptance criteria:
- Running analysis on an event project returns a non-empty `findings` array when data is sufficient.
- Findings have stable `tagId`/virtual-groupId, `effect`, `confidence`, `sampleSize`.

---

## Phase 4 — UI Parity (Remove “not available”, reuse layout)
**Outcome:** event projects use the same Results page/tabs as daily.

Steps:
1) Update the analysis runner to compute event findings (instead of returning empty).
2) Update the Findings UI:
   - Remove the hard “Event analysis not available yet” gate.
   - If severity is missing and no proxy is enabled:
     - show a “Severity recommended” info panel, but still show Stats/Coverage/Frequency.
3) Add a toggle in the Results UI:
   - View: **Tags** vs **Groups**
   - (Optional later) Tags + Groups overlay
4) Add the frequency visual panel:
   - Calendar heatmap or simple time-series chart of event counts.

Acceptance criteria:
- Selecting an event project shows the Results tabs with meaningful content.
- You can switch Tags ↔ Groups views.

---

## Phase 5 — Episode/Streak Intelligence (adds “why it persisted” insights)
**Outcome:** detect clustered events and report patterns.

Steps:
1) Define episode segmentation rule:
   - Default: same episode if consecutive events are within **12 hours**.
2) Add derived metrics:
   - episode length, max severity, time between episodes
3) Add insights:
   - tags/groups that correlate with longer episodes / higher max severity

Acceptance criteria:
- Results can highlight tags/groups associated with longer or more intense episodes.

---

## Phase 6 — Optional Baseline Capture (true occurrence correlation)
**Outcome:** correlations for “why it happens at all” (not just severity among events).

Options (choose later):
1) “Quick exposures check-in” once/day (not full diet; only key toggles).
2) Auto-absence markers for days without events (only adds outcome=0, not exposures).

Acceptance criteria:
- A dataset exists with both event days and non-event days + exposure observations.
- Methods can compute occurrence correlations similar to daily.

---

## Testing Plan (continuous)
- Unit tests for dataset builders (event rows, group projection, streak computation).
- Unit tests for new event analysis methods.
- UI smoke tests are optional; at minimum ensure TypeScript compiles and Vitest passes.

---

## Risks + Mitigations
- **Statistical validity without baseline:** be explicit in UI copy about what’s being measured (co-occurrence vs causal).
- **Severity missing:** provide graceful fallback (frequency + coverage + “add severity” prompt).
- **Group semantics:** if multi-group becomes necessary, we’ll expand tag schema to `groups: string[]` and migrate.

---

## Suggested Implementation Order (practical)
1) Phase 1 (severity support) + Phase 2 (dataset v2)
2) Phase 3.2 (severity association) so Positive/Negative tabs work
3) Phase 4 (UI parity + tag/group toggle + frequency view)
4) Phase 5 (streaks/episodes)
5) Phase 6 (baseline capture) if you want true occurrence correlations
