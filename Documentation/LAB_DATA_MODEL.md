# LAB Mode – Data Model & Contracts (LAB_DATA_MODEL.md)

This document defines **data contracts** for LAB mode.
It is intentionally strict: Copilot should treat these as source-of-truth types/invariants.

The actual code can use TypeScript interfaces/types, Zod schemas, or both.
Names below are suggestions; keep consistency across the codebase.

---

## High-level State Integration

LAB is stored inside the existing app state.

### Storage rule (local-first)
- Existing persisted state gains a new top-level key: `lab`
- A `schemaVersion` is used for migrations
- If loading persisted state without `lab`, initialize it to an empty LAB state

---

## Core Types

### Identifiers

- `LabProjectId`: string (UUID recommended)
- `LabTagId`: string (UUID recommended)
- `LabLogId`: string (UUID recommended)

Dates and times:
- `ISODate`: `"YYYY-MM-DD"` in user local timezone (Europe/Riga)
- `ISOTimestamp`: ISO-8601 timestamp (e.g. `"2026-01-22T08:15:00+02:00"`)

---

## LAB State

### `LabState`

```ts
type LabState = {
  version: 1; // LAB subsystem version (separate from app schemaVersion if desired)

  projects: Record<LabProjectId, LabProject>;
  projectOrder: LabProjectId[]; // UI ordering

  // Per-project tag libraries (recommended). Could also be global later.
  tagsByProject: Record<LabProjectId, Record<LabTagId, LabTagDef>>;
  tagOrderByProject: Record<LabProjectId, LabTagId[]>;

  // Logs
  dailyLogsByProject: Record<LabProjectId, Record<ISODate, LabDailyLog>>;
  eventLogsByProject: Record<LabProjectId, Record<LabLogId, LabEventLog>>;

  // Optional: cache of last computed findings (can be empty in early versions)
  findingsCacheByProject?: Record<LabProjectId, LabFindingsCache>;

  // UI preferences (optional)
  ui?: {
    activeProjectId?: LabProjectId;
  };
};

Notes:
	•	Daily logs are keyed by date for easy overwrite/edit.
	•	Event logs are keyed by log id for append-only behavior.

⸻

Project Model

LabProjectMode
type LabProjectMode = "daily" | "event";

LabProject
type LabProject = {
  id: LabProjectId;
  name: string; // e.g. "Morning wellbeing", "Bloating episodes"
  mode: LabProjectMode;

  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;

  // Defines how logs are interpreted and shown
  config: LabProjectConfig;

  // Soft delete support (optional)
  archived?: boolean;
};

Project Config

LabProjectConfig (discriminated union)
type LabProjectConfig =
  | LabDailyProjectConfig
  | LabEventProjectConfig;

Daily Project Config

Used for one-outcome-per-day experiments.
type LabDailyProjectConfig = {
  kind: "daily";

  outcome: {
    id: "outcome"; // fixed id for v1
    name: string; // e.g. "Morning wellbeing"
    scale: {
      min: number; // default 1
      max: number; // default 10
      step?: number; // default 1
    };
    required: boolean; // default true
  };

  // Defines how tags should be phrased in UI (optional)
  exposureLabel?: string; // e.g. "Yesterday evening tags"

  // Date alignment rule:
  // how exposures should be interpreted relative to outcome date
  alignment: {
    // simplest v1:
    // - outcomeDate is the date user selects/enters
    // - exposures are "previousEvening" relative to that outcomeDate
    // but stored in the same daily log row
    exposureWindow: "sameDay" | "previousEvening";
  };

  // Completion rules for daily log entries
  completion: {
    requireOutcome: boolean; // true
    requireAtLeastOneTag: boolean; // v1: false (user allowed no-tags)
  };

  // Optional “no tags / nothing notable” UI behavior
  allowExplicitNoTags?: boolean; // recommended true
};

Event Project Config

Used for episodic events.
type LabEventProjectConfig = {
  kind: "event";

  event: {
    name: string; // e.g. "Bloating episode"
    // optional: severity scale in future
    severity?: {
      enabled: boolean;
      scale?: { min: number; max: number; step?: number };
      required?: boolean;
    };
  };

  // Optional daily “no event today” marker support
  dailyAbsenceMarker?: {
    enabled: boolean; // recommended true for your bloating case
    labelTemplate?: string; // e.g. "No {eventName} today"
  };

  completion: {
    requireAtLeastOneTag: boolean; // recommended true (events should have context)
  };
};

Tag Model

Tags belong to a project.

LabTagDef
type LabTagDef = {
  id: LabTagId;
  name: string; // user-facing token, e.g. "alcohol", "late_screen"
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;

  // Intensity rules (v1 enforces consistency when enabled)
  intensity?: {
    enabled: boolean; // if true, intensity required when tag used
    min: number; // e.g. 0
    max: number; // e.g. 3
    step?: number; // optional
    unitLabel?: string; // optional ("drinks", "hours", etc.)
  };

  // Optional grouping for UI
  group?: string; // e.g. "food", "sleep", "social"
};

Invariants
	•	Tag name is unique within a project (case-insensitive recommended).
	•	If intensity.enabled === true then using the tag requires an intensity value.
	•	If intensity.enabled === false then intensity must not be provided in logs (or ignored).

⸻

Logs

Daily Logs

One daily log per date per project.
type LabDailyLog = {
  date: ISODate;
  updatedAt: ISOTimestamp;

  // Outcome value (required for completeness if project config says so)
  outcome?: number;

  // Tags used this day (can be empty)
  tags: LabTagUse[];

  // Optional user note (future)
  note?: string;

  // Internal: explicit "no tags" marker (optional)
  noTags?: boolean;
};

Event Logs

Append-only, timestamped.
type LabEventLog = {
  id: LabLogId;
  timestamp: ISOTimestamp;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;

  // Event severity optional (future)
  severity?: number;

  tags: LabTagUse[]; // should be non-empty if requireAtLeastOneTag=true
  note?: string;
};

Tag Uses
type LabTagUse = {
  tagId: LabTagId;

  // Optional intensity value. Must exist if the tag definition requires it.
  intensity?: number;
};

Invariants
	•	No duplicate tagId within the same log.
	•	If the tag requires intensity, intensity must be present and within range.
	•	If the tag does not use intensity, intensity should be omitted.

⸻

Daily “No Event Today” Markers (Event projects)

If enabled, absence markers are stored separately so they do not pollute event logs.
type LabDailyAbsenceMarker = {
  date: ISODate;
  updatedAt: ISOTimestamp;
  // marker indicates that user explicitly reported "no event" on this date
  noEvent: true;
};

Recommended storage shape:
type LabAbsenceByProject = Record<LabProjectId, Record<ISODate, LabDailyAbsenceMarker>>;

This can be added to LabState later as:
	•	absenceMarkersByProject?: LabAbsenceByProject

(v1 may omit this until needed, but the contract is defined here.)

⸻

Findings & Analysis Contracts (v1-friendly)

LAB analysis is plugin-based. Findings are stored/displayed using standardized output.

LabFindingDirection
type LabFindingDirection = "positive" | "negative" | "null";


LabFindingConfidence

Heuristic confidence labels (v1). Not statistical proof.
type LabFindingConfidence = "low" | "medium" | "high";

LabFinding
type LabFinding = {
  id: string; // stable hash recommended: methodId + tagId + window

  projectId: LabProjectId;

  // What was analyzed
  methodId: string; // e.g. "diff_means"
  target: {
    kind: "tag";
    tagId: LabTagId;
  };

  // How it was analyzed (window/features)
  window: {
    kind: "sameDay" | "lag" | "rolling" | "streak";
    lagDays?: number; // for lag
    rollingDays?: number; // for rolling sum
    streakMinDays?: number; // for streak effects
  };

  // Result
  direction: LabFindingDirection;

  // Comparable numeric magnitude (units depend on outcome scale)
  effectSize: number; // e.g. -1.2 points on outcome scale

  // Support & stability
  sample: {
    nTotal: number;
    nExposed: number; // tag present
    nUnexposed: number; // tag absent
    // optional dispersion stats for future p-values/CIs
    meanExposed?: number;
    meanUnexposed?: number;
    stdExposed?: number;
    stdUnexposed?: number;
  };

  confidence: LabFindingConfidence;

  // Human-readable summary generated by method
  summary: string;

  // Metadata and caveats
  notes?: string[]; // e.g. "insufficient data", "rare tag", "exploratory"
  createdAt: ISOTimestamp;
};

Findings Cache
type LabFindingsCache = {
  computedAt: ISOTimestamp;
  findings: LabFinding[];

  // used to detect if cache is stale
  inputFingerprint: string; // hash of relevant logs + tag defs + config
};

Method Plugin Interface (Concept Contract)

This is not a storage model, but a contract for engine modules.

type LabCorrelationMethod = {
  id: string; // stable
  name: string;

  // Determines if method applies to a project
  supportsProject(project: LabProject): boolean;

  // Declares what features are needed (optional in v1)
  requiredFeatures?: Array<{
    kind: "tagPresence" | "tagIntensity" | "lag" | "rolling" | "streak";
    params?: Record<string, any>;
  }>;

  // Compute findings (pure function)
  compute(input: LabMethodInput): LabFinding[];
};


Where LabMethodInput includes:
	•	project config
	•	normalized dataset
	•	tag definitions
	•	time bounds

⸻

Validation Rules Summary (Must Enforce)
	1.	Tag name uniqueness (within project)
	2.	No duplicate tags in a single log
	3.	Intensity rules:
	•	if tag requires intensity: must exist and be in range
	•	if tag does not require intensity: must not exist (or ignored)
	4.	Daily log completeness is evaluated by project rules:
	•	outcome required (daily project)
	•	at least one tag required only if configured (v1: false for daily)
	5.	Missing days are allowed and do not break analysis
	6.	Event logs are timestamped and immutable in identity (edit allowed, id stable)

⸻

Migration Notes (Local Storage)

When upgrading from app schema that had no LAB:
	•	If state.lab is missing:
	•	create an empty LabState with version: 1
	•	initialize empty objects for required maps

Example initialization:
	•	projects = {}
	•	projectOrder = []
	•	tagsByProject = {}
	•	tagOrderByProject = {}
	•	dailyLogsByProject = {}
	•	eventLogsByProject = {}
	•	findingsCacheByProject = {} (optional)

⸻

Future-proofing (Allowed Extensions without Breaking)
	•	Add new project modes to the LabProjectConfig union
	•	Add new input types (objective signals)
	•	Add severity to event logs
	•	Add richer statistical fields to LabFinding.sample
	•	Add feature definitions and computed feature caches

All extensions should be additive where possible.

