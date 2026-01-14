import type { AppStateV1, SchemaVersion } from '../domain/types'

const STORAGE_KEY = 'habitTracker.appState'
const CURRENT_SCHEMA_VERSION: SchemaVersion = 1

function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeSortIndices<T extends { id: string; sortIndex: number }>(
  items: Record<string, T>,
): Record<string, T> {
  const sorted = Object.values(items).sort((a, b) => a.sortIndex - b.sortIndex)
  const normalized: Record<string, T> = {}
  sorted.forEach((item, index) => {
    normalized[item.id] = { ...item, sortIndex: index }
  })
  return normalized
}

function repairStateV1(state: AppStateV1): AppStateV1 {
  const repairNow = new Date().toISOString()
  const today = toLocalDateString(new Date())

  function isValidLocalDateString(value: unknown): value is string {
    if (typeof value !== 'string') return false
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [y, m, d] = value.split('-').map((v) => Number(v))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false
    const dt = new Date(y, m - 1, d)
    return toLocalDateString(dt) === value
  }

  const categoryIds = new Set(Object.keys(state.categories))

  // Remove habits whose categoryId no longer exists
  const habits: AppStateV1['habits'] = {}
  for (const [habitId, habit] of Object.entries(state.habits)) {
    if (categoryIds.has(habit.categoryId)) {
      habits[habitId] = habit
    }
  }

  // Ensure priorities are in {1,2,3} (fallback to 3)
  for (const habit of Object.values(habits)) {
    if (habit.priority !== 1 && habit.priority !== 2 && habit.priority !== 3) {
      habit.priority = 3
    }
  }

  // Normalize category sortIndex and per-category habit sortIndex
  const categories = normalizeSortIndices(state.categories)

  const habitsByCategory: Record<string, AppStateV1['habits']> = {}
  for (const habit of Object.values(habits)) {
    ;(habitsByCategory[habit.categoryId] ??= {})[habit.id] = habit
  }
  const normalizedHabits: AppStateV1['habits'] = {}
  for (const [, categoryHabits] of Object.entries(habitsByCategory)) {
    const normalized = normalizeSortIndices(categoryHabits)
    for (const [habitId, habit] of Object.entries(normalized)) {
      normalizedHabits[habitId] = habit
    }
  }

  // Remove dailyScores for deleted habits
  const validHabitIds = new Set(Object.keys(normalizedHabits))
  const dailyScores: AppStateV1['dailyScores'] = {}
  for (const [date, scoresByHabitId] of Object.entries(state.dailyScores)) {
    const nextScoresForDay: Record<string, 0 | 1 | 2> = {}
    for (const [habitId, score] of Object.entries(scoresByHabitId)) {
      if (validHabitIds.has(habitId) && (score === 0 || score === 1 || score === 2)) {
        nextScoresForDay[habitId] = score
      }
    }
    if (Object.keys(nextScoresForDay).length > 0) {
      dailyScores[date] = nextScoresForDay
    }
  }

  // Optional cleanup: remove dayLocks for dates that have zero scores
  const dayLocks: AppStateV1['dayLocks'] = {}
  for (const [date, lockedAt] of Object.entries(state.dayLocks)) {
    if (dailyScores[date] && Object.keys(dailyScores[date]).length > 0) {
      dayLocks[date] = lockedAt
    }
  }

  // Recovery rule: after reload, we do not resume sessions.
  // Any date that has at least one score must be considered locked.
  for (const [date, scoresForDay] of Object.entries(dailyScores)) {
    if (Object.keys(scoresForDay).length === 0) continue
    if (!dayLocks[date]) dayLocks[date] = repairNow
  }

  // UI state repair (Overview): clamp values and clear invalid selections.
  const overviewRangeDays = state.uiState.overviewRangeDays === 7 ? 7 : 30

  const validOverviewModes: AppStateV1['uiState']['overviewMode'][] = [
    'overall',
    'priority1',
    'priority2',
    'priority3',
    'category',
    'habit',
  ]
  const overviewMode = validOverviewModes.includes(state.uiState.overviewMode)
    ? state.uiState.overviewMode
    : 'overall'

  let overviewWindowEndDate = isValidLocalDateString(state.uiState.overviewWindowEndDate)
    ? state.uiState.overviewWindowEndDate
    : today
  if (overviewWindowEndDate > today) overviewWindowEndDate = today

  let overviewSelectedCategoryId = state.uiState.overviewSelectedCategoryId
  let overviewSelectedHabitId = state.uiState.overviewSelectedHabitId

  if (overviewMode !== 'category') overviewSelectedCategoryId = null
  if (overviewMode !== 'habit') overviewSelectedHabitId = null

  if (overviewMode === 'category') {
    if (overviewSelectedCategoryId && !categoryIds.has(overviewSelectedCategoryId)) {
      overviewSelectedCategoryId = null
    }
  }

  if (overviewMode === 'habit') {
    if (overviewSelectedHabitId && !validHabitIds.has(overviewSelectedHabitId)) {
      overviewSelectedHabitId = null
    }
  }

  return {
    ...state,
    categories,
    habits: normalizedHabits,
    dailyScores,
    dayLocks,
    uiState: {
      ...state.uiState,
      // Never resume priority edit mode after reload.
      dailyLeftMode: state.uiState.dailyLeftMode === 'priorityEdit' ? 'normal' : state.uiState.dailyLeftMode,
      overviewRangeDays,
      overviewMode,
      overviewWindowEndDate,
      overviewSelectedCategoryId,
      overviewSelectedHabitId,
    },
  }
}

export function createDefaultState(now: Date = new Date()): AppStateV1 {
  const isoNow = now.toISOString()
  const today = toLocalDateString(now)

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: isoNow,

    meta: {
      appVersion: '0.0.0',
      createdAt: isoNow,
    },

    categories: {},
    habits: {},
    dailyScores: {},
    dayLocks: {},

    todos: {},
    todoArchive: {},

    uiState: {
      dailyViewMode: 'category',
      selectedDate: today,

      overviewRangeDays: 30,
      overviewWindowEndDate: today,
      overviewMode: 'overall',
      overviewSelectedCategoryId: null,
      overviewSelectedHabitId: null,

      dailyLeftMode: 'normal',
      todoMode: 'normal',
    },
  }
}

export function loadState(): AppStateV1 {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const initial = createDefaultState()
    saveState(initial)
    return initial
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const initial = createDefaultState()
    saveState(initial)
    return initial
  }

  if (!parsed || typeof parsed !== 'object') {
    const initial = createDefaultState()
    saveState(initial)
    return initial
  }

  const state = parsed as Partial<AppStateV1>
  if (state.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schemaVersion ${String(state.schemaVersion)} (expected ${CURRENT_SCHEMA_VERSION}).`,
    )
  }

  if (!state.uiState || !state.meta) {
    const initial = createDefaultState()
    saveState(initial)
    return initial
  }

  const repaired = repairStateV1(parsed as AppStateV1)
  // Persist repairs immediately so state doesn't drift.
  saveState(repaired)
  return repaired
}

export function saveState(state: AppStateV1): void {
  const next: AppStateV1 = {
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
