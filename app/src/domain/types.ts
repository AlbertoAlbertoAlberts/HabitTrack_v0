import type { FindingsCache } from './lab/analysis/cache'

export type IsoTimestamp = string
export type LocalDateString = string // YYYY-MM-DD (local time)

export type SchemaVersion = 1

// ============================================================
// LAB Mode Types
// ============================================================

export type LabProjectId = string
export type LabTagId = string
export type LabLogId = string
export type ISODate = string // YYYY-MM-DD (local timezone)
export type ISOTimestamp = string // ISO-8601 timestamp

export type LabProjectMode = 'daily' | 'daily-tag-only' | 'daily-multi-choice' | 'event'

export interface LabProject {
  id: LabProjectId
  name: string
  mode: LabProjectMode
  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
  config: LabProjectConfig
  archived?: boolean
}

export type LabProjectConfig =
  | LabDailyProjectConfig
  | LabEventProjectConfig
  | LabDailyTagOnlyProjectConfig
  | LabDailyMultiChoiceProjectConfig

export interface LabOutcomeDef {
  id: string               // unique within project, e.g. 'outcome_2'
  name: string
  scale: {
    min: number
    max: number
    step?: number
  }
}

export interface LabDailyProjectConfig {
  kind: 'daily'
  outcome: {
    id: 'outcome'
    name: string
    scale: {
      min: number
      max: number
      step?: number
    }
    required: boolean
  }
  additionalOutcomes?: LabOutcomeDef[]  // extra outcomes, each with its own scale
  exposureLabel?: string
  alignment: {
    exposureWindow: 'sameDay' | 'previousEvening'
  }
  tagsEnabled?: boolean  // default true for backward compat; false = no tag UI
  completion: {
    requireOutcome: boolean
    requireAtLeastOneTag: boolean
  }
  allowExplicitNoTags?: boolean
}

// --- Tag-only daily project ---
export interface LabDailyTagOnlyProjectConfig {
  kind: 'daily-tag-only'
  tagsEnabled: true               // always true; exists for consistency
  completion: {
    requireAtLeastOneTag: boolean  // whether day is "complete" only with ≥1 tag
  }
  allowExplicitNoTags?: boolean
}

// --- Multiple-choice daily project ---
export interface LabMultiChoiceOption {
  id: string               // stable ID (generateId)
  label: string            // display text
  createdAt: ISOTimestamp
  archived?: boolean       // soft-delete when removed after data exists
}

export interface LabDailyMultiChoiceProjectConfig {
  kind: 'daily-multi-choice'
  selectionMode: 'single' | 'multiple'
  options: LabMultiChoiceOption[]
  completion: {
    requireAtLeastOneChoice: boolean
  }
}

export interface LabEventProjectConfig {
  kind: 'event'
  event: {
    name: string
    severity?: {
      enabled: boolean
      scale?: { min: number; max: number; step?: number }
      required?: boolean
    }
  }
  dailyAbsenceMarker?: {
    enabled: boolean
    labelTemplate?: string
  }
  completion: {
    requireAtLeastOneTag: boolean
  }
}

export interface LabTagCategory {
  id: string
  name: string
  sortIndex: number
  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
}

export interface LabTagDef {
  id: LabTagId
  name: string
  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
  intensity?: {
    enabled: boolean
    min: number
    max: number
    step?: number
    unitLabel?: string
  }
  group?: string
  categoryId?: string         // reference to LabTagCategory.id
}

export interface LabTagUse {
  tagId: LabTagId
  intensity?: number
}

export interface LabDailyLog {
  date: ISODate
  updatedAt: ISOTimestamp
  outcome?: number
  additionalOutcomes?: Record<string, number>  // outcomeId → value
  tags: LabTagUse[]
  note?: string
  noTags?: boolean
}

export interface LabMultiChoiceLog {
  date: ISODate
  updatedAt: ISOTimestamp
  selectedOptionIds: string[]
  note?: string
}

export interface LabDailyAbsenceMarker {
  date: ISODate
  updatedAt: ISOTimestamp
  noEvent: true
}

export interface LabEventLog {
  id: LabLogId
  timestamp: ISOTimestamp
  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
  severity?: number
  tags: LabTagUse[]
  note?: string
}

export type LabFindingDirection = 'positive' | 'negative' | 'null'
export type LabFindingConfidence = 'low' | 'medium' | 'high'

export interface LabFinding {
  id: string
  projectId: LabProjectId
  methodId: string
  target: {
    kind: 'tag'
    tagId: LabTagId
  }
  window: {
    kind: 'sameDay' | 'lag' | 'rolling' | 'streak'
    lagDays?: number
    rollingDays?: number
    streakMinDays?: number
  }
  direction: LabFindingDirection
  effectSize: number
  sample: {
    nTotal: number
    nExposed: number
    nUnexposed: number
    meanExposed?: number
    meanUnexposed?: number
    stdExposed?: number
    stdUnexposed?: number
  }
  confidence: LabFindingConfidence
  summary: string
  notes?: string[]
  createdAt: ISOTimestamp
}

export interface LabFindingsCache {
  computedAt: ISOTimestamp
  findings: LabFinding[]
  inputFingerprint: string
}

export interface LabState {
  version: 1
  projects: Record<LabProjectId, LabProject>
  projectOrder: LabProjectId[]
  tagsByProject: Record<LabProjectId, Record<LabTagId, LabTagDef>>
  tagOrderByProject: Record<LabProjectId, LabTagId[]>
  dailyLogsByProject: Record<LabProjectId, Record<ISODate, LabDailyLog>>
  eventLogsByProject: Record<LabProjectId, Record<LabLogId, LabEventLog>>
  multiChoiceLogsByProject: Record<LabProjectId, Record<ISODate, LabMultiChoiceLog>>
  absenceMarkersByProject?: Record<LabProjectId, Record<ISODate, LabDailyAbsenceMarker>>
  tagCategoriesByProject?: Record<LabProjectId, Record<string, LabTagCategory>>
  tagCategoryOrderByProject?: Record<LabProjectId, string[]>
  findingsCache?: Record<LabProjectId, FindingsCache> // Cache for analysis findings
  ui?: {
    activeProjectId?: LabProjectId
  }
}

// ============================================================
// End LAB Mode Types
// ============================================================

export type CategoryId = string
export type HabitId = string
export type TodoId = string
export type TodoArchiveId = string
export type TodoFolderId = string
export type WeeklyTaskId = string

export type TodoQuadrant = 'asap' | 'schedule' | 'later' | 'fun'

export type Score = 0 | 1 | 2
export type Priority = 1 | 2 | 3

export interface Category {
  id: CategoryId
  name: string
  sortIndex: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface Habit {
  id: HabitId
  name: string
  categoryId: CategoryId
  priority: Priority
  sortIndex: number
  /** When 'previous', scores entered on a given day are recorded for the previous day. */
  scoreDay?: 'same' | 'previous'
  // Effective start date (YYYY-MM-DD, local). If absent, it is derived from createdAt.
  startDate?: LocalDateString
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface TodoFolder {
  id: TodoFolderId
  name: string
  sortIndex: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface TodoItem {
  id: TodoId
  text: string
  sortIndex?: number
  folderId?: TodoFolderId   // undefined → "Bez mapes"
  quadrant?: TodoQuadrant   // undefined → uncategorised in matrix
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface TodoArchiveItem {
  id: TodoArchiveId
  text: string
  folderId?: TodoFolderId
  completedAt: IsoTimestamp
  restoredAt: IsoTimestamp | null
}

export interface WeeklyTask {
  id: WeeklyTaskId
  name: string
  targetPerWeek: number
  // Target history as of week starts (Monday, YYYY-MM-DD, local).
  // Used to preserve historical weekly requirements in Overview.
  targetHistory?: WeeklyTaskTargetChange[]
  sortIndex: number
  // Effective start week (Monday, YYYY-MM-DD, local). If absent, it is derived from createdAt.
  startWeekStart?: LocalDateString
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface WeeklyTaskTargetChange {
  weekStart: LocalDateString
  targetPerWeek: number
}

export type DailyViewMode = 'category' | 'priority'

export type OverviewRangeDays = 7 | 30

export type OverviewMode =
  | 'overall'
  | 'priority1'
  | 'priority2'
  | 'priority3'
  | 'category'
  | 'habit'
  | 'lab'
  | 'weekly'

export type OverviewSelectionKind = 'habit' | 'labDaily' | 'labEvent' | 'weekly' | 'category' | 'priority' | 'overall'

export interface OverviewSelection {
  kind: OverviewSelectionKind
  id?: string   // habitId or labProjectId — omitted for weekly/overall/priority
}

export type DailyLeftMode = 'normal' | 'reorder' | 'delete' | 'priorityEdit' | 'rename'
export type TodoMode = 'normal' | 'delete' | 'rename' | 'reorder'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface UiStateV1 {
  dailyViewMode: DailyViewMode
  selectedDate: LocalDateString

  themeMode: ThemeMode

  overviewRangeDays: OverviewRangeDays
  overviewMode: OverviewMode
  overviewSelectedCategoryId: CategoryId | null
  overviewSelectedHabitId: HabitId | null
  overviewSelectedLabProjectId: LabProjectId | null
  overviewWindowEndDate: LocalDateString

  overviewMultiSelectCount: 1 | 2 | 3
  overviewMultiSelections: OverviewSelection[]

  dailyLeftMode: DailyLeftMode
  todoMode: TodoMode
}

export interface AppStateMetaV1 {
  appVersion: string
  createdAt: IsoTimestamp
}

export type DailyScoresByDateV1 = Record<LocalDateString, Record<HabitId, Score>>
export type DayLocksV1 = Record<LocalDateString, IsoTimestamp>
// Keyed by computed week-start date (Monday), formatted as YYYY-MM-DD (local time)
export type WeeklyProgressByWeekStartV1 = Record<LocalDateString, Record<WeeklyTaskId, number>>
// Per-week, per-task set of completion days (at most one per day)
export type WeeklyCompletionDaysByWeekStartV1 = Record<
  LocalDateString,
  Record<WeeklyTaskId, LocalDateString[]>
>

export interface AppStateV1 {
  schemaVersion: SchemaVersion
  savedAt: IsoTimestamp

  meta: AppStateMetaV1

  categories: Record<CategoryId, Category>
  habits: Record<HabitId, Habit>
  dailyScores: DailyScoresByDateV1
  dayLocks: DayLocksV1

  weeklyTasks: Record<WeeklyTaskId, WeeklyTask>
  weeklyProgress: WeeklyProgressByWeekStartV1
  weeklyCompletionDays: WeeklyCompletionDaysByWeekStartV1

  todoFolders: Record<TodoFolderId, TodoFolder>
  todos: Record<TodoId, TodoItem>
  todoArchive: Record<TodoArchiveId, TodoArchiveItem>

  uiState: UiStateV1

  // LAB mode state (optional for migration)
  lab?: LabState
}
