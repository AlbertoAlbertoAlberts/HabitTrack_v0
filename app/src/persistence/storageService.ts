import type { AppStateV1, SchemaVersion, ThemeMode } from '../domain/types'

const STORAGE_KEY = 'habitTracker.appState'
const CURRENT_SCHEMA_VERSION: SchemaVersion = 1

type ImportResult = { ok: true } | { ok: false; error: string }

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

  function parseLocalDateString(value: string): Date {
    const [y, m, d] = value.split('-').map((v) => Number(v))
    return new Date(y, m - 1, d)
  }

  function addDaysLocal(date: string, deltaDays: number): string {
    const dt = parseLocalDateString(date)
    dt.setDate(dt.getDate() + deltaDays)
    return toLocalDateString(dt)
  }

  function weekStartMondayLocal(date: string): string {
    const dt = parseLocalDateString(date)
    const day = dt.getDay() // 0..6 (Sun..Sat)
    const deltaToMonday = (day + 6) % 7
    dt.setDate(dt.getDate() - deltaToMonday)
    return toLocalDateString(dt)
  }

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
      // Backfill effective start date for old states.
      if (!habit.startDate) {
        habit.startDate = toLocalDateString(new Date(habit.createdAt))
      }
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

  // UI state repair (Overview): clamp values.
  const overviewRangeDays = state.uiState.overviewRangeDays === 7 ? 7 : 30

  const themeMode: ThemeMode =
    state.uiState.themeMode === 'light' ||
    state.uiState.themeMode === 'dark' ||
    state.uiState.themeMode === 'system'
      ? state.uiState.themeMode
      : 'system'

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

  // Weekly tasks: normalize and remove invalid progress
  const weeklyTasksInput = (state as Partial<AppStateV1>).weeklyTasks ?? {}

  const currentWeekStart = weekStartMondayLocal(today)

  function clampWeeklyTarget(value: unknown): number {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 1
    return Math.max(1, Math.min(7, n))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function normalizeTargetHistory(task: any): Array<{ weekStart: string; targetPerWeek: number }> {
    const baseWeekStart = typeof task.startWeekStart === 'string' ? task.startWeekStart : currentWeekStart
    const raw = Array.isArray(task.targetHistory) ? task.targetHistory : []

    const byWeek = new Map<string, { weekStart: string; targetPerWeek: number }>()
    byWeek.set(baseWeekStart, { weekStart: baseWeekStart, targetPerWeek: clampWeeklyTarget(task.targetPerWeek) })

    for (const h of raw) {
      if (!h || typeof h.weekStart !== 'string') continue
      byWeek.set(h.weekStart, { weekStart: h.weekStart, targetPerWeek: clampWeeklyTarget(h.targetPerWeek) })
    }

    return Array.from(byWeek.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function effectiveWeeklyTarget(task: any, weekStartDate: string): number {
    if (weekStartDate >= currentWeekStart) return clampWeeklyTarget(task.targetPerWeek)
    const history = Array.isArray(task.targetHistory) ? task.targetHistory : []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let best: any = null
    for (const h of history) {
      if (!h || typeof h.weekStart !== 'string') continue
      if (h.weekStart <= weekStartDate) best = h
      else break
    }

    return clampWeeklyTarget(best?.targetPerWeek ?? task.targetPerWeek)
  }

  for (const task of Object.values(weeklyTasksInput)) {
    // Backfill effective start week for old states.
    if (!task.startWeekStart) {
      const createdLocalDate = toLocalDateString(new Date(task.createdAt))
      task.startWeekStart = weekStartMondayLocal(createdLocalDate)
    }
  }

  for (const task of Object.values(weeklyTasksInput)) {
    task.targetPerWeek = clampWeeklyTarget(task.targetPerWeek)
    task.targetHistory = normalizeTargetHistory(task)
  }

  const weeklyTasks = normalizeSortIndices(weeklyTasksInput)
  const validWeeklyTaskIds = new Set(Object.keys(weeklyTasks))

  const weeklyProgressInput = (state as Partial<AppStateV1>).weeklyProgress ?? {}
  const weeklyCompletionDaysInput = (state as Partial<AppStateV1>).weeklyCompletionDays ?? {}

  // Normalize weeklyCompletionDays, and if missing, synthesize it from weeklyProgressInput.
  const weeklyCompletionDays: AppStateV1['weeklyCompletionDays'] = {}

  for (const [weekStartDate, byTask] of Object.entries(weeklyCompletionDaysInput)) {
    if (!isValidLocalDateString(weekStartDate)) continue
    const weekEndDate = addDaysLocal(weekStartDate, 6)

    const nextForWeek: Record<string, string[]> = {}
    for (const [taskId, days] of Object.entries(byTask ?? {})) {
      if (!validWeeklyTaskIds.has(taskId)) continue
      if (!Array.isArray(days)) continue

      const uniq = new Set<string>()
      for (const raw of days) {
        if (!isValidLocalDateString(raw)) continue
        if (raw < weekStartDate || raw > weekEndDate) continue
        uniq.add(raw)
      }

      const sorted = Array.from(uniq).sort()
      const limited = sorted.slice(0, effectiveWeeklyTarget(weeklyTasks[taskId], weekStartDate))
      if (limited.length > 0) nextForWeek[taskId] = limited
    }

    if (Object.keys(nextForWeek).length > 0) weeklyCompletionDays[weekStartDate] = nextForWeek
  }

  // Synthesize from weeklyProgressInput for any missing task/week combos.
  for (const [weekStartDate, progressByTaskId] of Object.entries(weeklyProgressInput)) {
    if (!isValidLocalDateString(weekStartDate)) continue
    const weekEndDate = addDaysLocal(weekStartDate, 6)

    const weekObj = (weeklyCompletionDays[weekStartDate] ??= {})

    for (const [taskId, rawCount] of Object.entries(progressByTaskId ?? {})) {
      if (!validWeeklyTaskIds.has(taskId)) continue
      if (Array.isArray(weekObj[taskId]) && weekObj[taskId]!.length > 0) continue

      const count = typeof rawCount === 'number' && Number.isFinite(rawCount) ? Math.floor(rawCount) : 0
      const clamped = Math.max(0, Math.min(count, effectiveWeeklyTarget(weeklyTasks[taskId], weekStartDate)))
      if (clamped <= 0) continue

      const synthesized: string[] = []
      for (let i = 0; i < 7 && synthesized.length < clamped; i++) {
        const d = addDaysLocal(weekStartDate, i)
        if (d < weekStartDate || d > weekEndDate) continue
        synthesized.push(d)
      }
      if (synthesized.length > 0) weekObj[taskId] = synthesized
    }

    if (Object.keys(weekObj).length === 0) delete weeklyCompletionDays[weekStartDate]
  }

  // Derive weeklyProgress from weeklyCompletionDays (kept for compatibility/export).
  const weeklyProgress: AppStateV1['weeklyProgress'] = {}
  for (const [weekStartDate, byTask] of Object.entries(weeklyCompletionDays)) {
    const nextForWeek: Record<string, number> = {}
    for (const [taskId, days] of Object.entries(byTask)) {
      if (!validWeeklyTaskIds.has(taskId)) continue
      const count = Array.isArray(days) ? days.length : 0
      const clamped = Math.max(0, Math.min(count, weeklyTasks[taskId].targetPerWeek))
      if (clamped > 0) nextForWeek[taskId] = clamped
    }
    if (Object.keys(nextForWeek).length > 0) weeklyProgress[weekStartDate] = nextForWeek
  }

  return {
    ...state,
    categories,
    habits: normalizedHabits,
    dailyScores,
    dayLocks,
    weeklyTasks,
    weeklyProgress,
    weeklyCompletionDays,
    uiState: {
      ...state.uiState,
      // Never resume priority edit mode after reload.
      dailyLeftMode: state.uiState.dailyLeftMode === 'priorityEdit' ? 'normal' : state.uiState.dailyLeftMode,
      themeMode,
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

    weeklyTasks: {},
    weeklyProgress: {},
    weeklyCompletionDays: {},

    todos: {},
    todoArchive: {},

    uiState: {
      dailyViewMode: 'category',
      selectedDate: today,

      overviewRangeDays: 7,
      overviewWindowEndDate: today,
      overviewMode: 'overall',
      overviewSelectedCategoryId: null,
      overviewSelectedHabitId: null,

      dailyLeftMode: 'normal',
      todoMode: 'normal',

      themeMode: 'system',
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

export function exportBackupJson(state?: AppStateV1): string {
  const toExport = state ?? loadState()
  return JSON.stringify(toExport, null, 2)
}

export function importBackupJson(json: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Nederīgs JSON.' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Nederīgs rezerves kopijas formāts (nav objekts).' }
  }

  const candidate = parsed as Partial<AppStateV1>
  if (candidate.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Nederīga schemaVersion ${String(candidate.schemaVersion)} (gaidīts ${CURRENT_SCHEMA_VERSION}).`,
    }
  }

  if (!candidate.uiState || !candidate.meta) {
    return { ok: false, error: 'Nederīgs rezerves kopijas formāts (trūkst uiState/meta).' }
  }

  const repaired = repairStateV1(parsed as AppStateV1)
  saveState(repaired)
  return { ok: true }
}
