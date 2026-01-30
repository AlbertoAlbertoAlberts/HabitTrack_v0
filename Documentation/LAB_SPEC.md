# LAB Mode – Specification (LAB_SPEC.md)

## Purpose

LAB mode is a **personal research-grade self-tracking and correlation analysis system**.
It is designed for exploratory self-research, not medical or consumer-grade conclusions.

Primary goals:
- Detect **meaningful patterns** between user-defined behaviors, subjective states, and (later) objective signals
- Preserve **scientific caution** (correlation ≠ causation)
- Be **modular, extensible, and testable**
- Integrate with the existing Habit Tracker without breaking it

LAB is initially **local-first**, later syncable to a backend (e.g. Supabase).

---

## Core Concepts

### 1. LAB Project

A LAB Project represents **one research question**.

Examples:
- “Morning wellbeing vs previous evening behaviors”
- “What precedes bloating episodes?”
- “Smoking triggers”

Each project is independent and can run in parallel with others.

A project defines:
- What kind of data is logged
- How logs are interpreted
- Which analyses are applicable

---

## Project Modes (v1)

LAB supports **two project modes** in v1.
More modes may be added later without breaking existing projects.

### A. Daily Project

Used when:
- There is **one main outcome per day**
- The user wants to understand how daily behaviors affect that outcome

Example:
- Morning wellbeing (1–10) vs previous evening activities

**Characteristics**
- At most **one daily outcome value per day**
- Zero or more tags per day
- Tags may be binary or have intensity
- Missing days are allowed
- “No tags today” is valid data

The engine reduces all logs into **one analytical row per day**.

---

### B. Event Project

Used when:
- The thing being tracked happens **sporadically**
- Logs occur only when the event happens

Example:
- Bloating episodes
- Panic attacks
- Cravings

**Characteristics**
- Logs are **timestamped**
- Each log represents an event occurrence
- Tags describe context around the event
- Optional explicit “no event today” entry is supported
- No daily outcome score required

Analysis focuses on **patterns around events**, not daily averages.

---

## Inputs

### Input Type 1 – Outcome (Daily Projects only)

- Numeric scale (default: 1–10)
- Logged once per day
- Represents the primary variable of interest
- Required for a daily entry to be considered “complete”

Examples:
- Morning wellbeing
- Energy level
- Mood

---

### Input Type 2 – Tags (All Projects)

Tags represent **actions, exposures, contexts, or events**.

Examples:
- alcohol
- late_screen
- gym
- social
- spicy_food

**Rules**
- Tags are project-specific
- Tags are **binary by default** (present / absent)
- Tags can optionally have **intensity**

#### Tag Intensity Rules
- A tag may be created **with or without intensity**
- If intensity is enabled for a tag:
  - Intensity becomes **required** whenever the tag is used
- Intensity is numeric (e.g. 0–3 or custom range)
- Intensity can be added or removed in later versions, but v1 UI enforces consistency

---

### Input Type 3 – Objective Signals (Deferred)

Examples:
- Oura sleep score
- HRV
- Resting heart rate

These are **not required in v1**, but the system is designed so:
- Projects may later declare which signals they use
- Signals are treated as additional inputs, not outcomes

---

## Logging Rules

### Daily Projects
- A daily entry may contain:
  - Outcome value (required for completeness)
  - Zero or more tags
- “No tags today” is valid and meaningful
- Missing days are allowed
- Logs are associated with a **single analysis date**

#### Time Semantics
- For projects like “morning wellbeing”:
  - Outcome refers to **this morning**
  - Tags typically refer to **previous evening**
- This alignment is defined at the **project level**, not hardcoded

---

### Event Projects
- Logs occur when the event happens
- Each log has:
  - Timestamp
  - One or more tags
- Optional daily “no event today” entry may exist
- Absence of logs does NOT automatically mean “no event”

---

## Data Normalization (Internal)

LAB converts logs into normalized datasets for analysis.

### Daily Projects → Daily Table
Each row represents one calendar day:
- Outcome value
- Tag presence (0/1)
- Optional tag intensity
- Derived features (lags, rolling windows, streaks)

### Event Projects → Event Table
Each row represents one event:
- Timestamp
- Tag presence
- Optional tag intensity

Normalization is internal and invisible to the user.

---

## Feature Generation (Internal)

Before analysis, raw logs are transformed into **derived features**.

Examples:
- Tag presence (today, lag-1, lag-2)
- Rolling sums (3-day, 7-day)
- Streak length
- Intensity bins

Feature generation is deterministic and reusable across methods.

---

## Analysis Philosophy

LAB does **exploratory analysis**, not causal inference.

Principles:
- Prefer robustness over cleverness
- Avoid overfitting
- Avoid automatic “insights” with low data support
- Always expose uncertainty

---

## Analysis Outputs (Findings)

Each finding includes:
- Direction: positive / negative / null
- Effect size (numeric, comparable)
- Sample size (with and without tag)
- Stability indicator (heuristic)
- Applicable time window
- Human-readable summary

Example:
> “On days following alcohol consumption, morning wellbeing is on average ~1.2 points lower (n=14).”

---

## Confidence & Guardrails

LAB does NOT claim causation.

Safeguards:
- Minimum data thresholds per tag
- Rare tags are excluded from analysis
- Findings are ranked but labeled as exploratory
- Multiple findings do not imply multiple truths

Statistical p-values are **not required in v1**, but the architecture allows adding them later.

---

## Data Maturity Model

Each project has a **data maturity level**, based on coverage and density.

Suggested stages:
- Stage 0: Setup (0–6 days)
- Stage 1: Early signal (7–20 days)
- Stage 2: Tentative findings (21–60 days)
- Stage 3: More reliable patterns (61–120 days)

Each tag also has its own maturity threshold before analysis is shown.

---

## Storage & Persistence

- LAB state is stored inside the existing app state
- A `schemaVersion` is used
- If LAB does not exist in stored data, it is initialized empty
- Local-first storage in v1
- Backend sync (e.g. Supabase) is a later phase

---

## Non-Goals (Explicit)

LAB v1 does NOT:
- Provide medical advice
- Claim causality
- Automatically optimize behavior
- Guarantee “truth” in findings

LAB is a **thinking tool**, not a decision engine.

---

## Future Extensions (Non-breaking)

- Objective API integrations (Oura, etc.)
- More project modes
- Advanced statistical methods
- Cross-project comparisons
- Export for external analysis

---

## Summary

LAB mode is:
- Modular
- Transparent
- Cautious
- Built for long-term evolution

The system prioritizes **clarity, auditability, and scientific humility** over flashy insights.