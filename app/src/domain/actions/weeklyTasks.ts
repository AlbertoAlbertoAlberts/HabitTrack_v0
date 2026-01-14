import type {
  AppStateV1,
  IsoTimestamp,
  LocalDateString,
  WeeklyTask,
  WeeklyTaskId,
} from '../types'

import { addDays } from '../utils/localDate'

function nowIso(): IsoTimestamp {
  return new Date().toISOString()
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}`
}

function normalizeWeeklyTaskSortIndex(
  weeklyTasks: Record<WeeklyTaskId, WeeklyTask>,
): Record<WeeklyTaskId, WeeklyTask> {
  const list = Object.values(weeklyTasks)
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex)

  const normalized: Record<WeeklyTaskId, WeeklyTask> = {}
  list.forEach((t, idx) => {
    normalized[t.id] = { ...t, sortIndex: idx }
  })
  return normalized
}

function clampTargetPerWeek(value: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : 1
  return Math.max(1, Math.min(7, n))
}

export function addWeeklyTask(state: AppStateV1, name: string, targetPerWeek: number = 5): AppStateV1 {
  const trimmed = name.trim()
  if (!trimmed) return state

  const createdAt = nowIso()
  const id = newId() as WeeklyTaskId

  const task: WeeklyTask = {
    id,
    name: trimmed,
    targetPerWeek: clampTargetPerWeek(targetPerWeek),
    sortIndex: Object.keys(state.weeklyTasks).length,
    createdAt,
    updatedAt: createdAt,
  }

  return {
    ...state,
    weeklyTasks: {
      ...state.weeklyTasks,
      [id]: task,
    },
  }
}

export function deleteWeeklyTask(state: AppStateV1, weeklyTaskId: WeeklyTaskId): AppStateV1 {
  if (!state.weeklyTasks[weeklyTaskId]) return state

  const { [weeklyTaskId]: _deleted, ...remaining } = state.weeklyTasks

  const nextWeeklyProgress: AppStateV1['weeklyProgress'] = {}
  for (const [weekStartDate, progressByTaskId] of Object.entries(state.weeklyProgress)) {
    const { [weeklyTaskId]: _removed, ...rest } = progressByTaskId
    if (Object.keys(rest).length > 0) nextWeeklyProgress[weekStartDate as LocalDateString] = rest
  }

  const nextWeeklyCompletionDays: AppStateV1['weeklyCompletionDays'] = {}
  for (const [weekStartDate, byTask] of Object.entries(state.weeklyCompletionDays)) {
    const { [weeklyTaskId]: _removed, ...rest } = byTask
    if (Object.keys(rest).length > 0) nextWeeklyCompletionDays[weekStartDate as LocalDateString] = rest
  }

  return {
    ...state,
    weeklyTasks: normalizeWeeklyTaskSortIndex(remaining),
    weeklyProgress: nextWeeklyProgress,
    weeklyCompletionDays: nextWeeklyCompletionDays,
  }
}

export function renameWeeklyTask(state: AppStateV1, weeklyTaskId: WeeklyTaskId, name: string): AppStateV1 {
  const task = state.weeklyTasks[weeklyTaskId]
  if (!task) return state

  const trimmed = name.trim()
  if (!trimmed) return state
  if (task.name === trimmed) return state

  return {
    ...state,
    weeklyTasks: {
      ...state.weeklyTasks,
      [weeklyTaskId]: {
        ...task,
        name: trimmed,
        updatedAt: nowIso(),
      },
    },
  }
}

export function setWeeklyTaskTargetPerWeek(
  state: AppStateV1,
  weeklyTaskId: WeeklyTaskId,
  targetPerWeek: number,
): AppStateV1 {
  const task = state.weeklyTasks[weeklyTaskId]
  if (!task) return state

  const nextTarget = clampTargetPerWeek(targetPerWeek)
  if (task.targetPerWeek === nextTarget) return state

  const nextTasks: AppStateV1['weeklyTasks'] = {
    ...state.weeklyTasks,
    [weeklyTaskId]: {
      ...task,
      targetPerWeek: nextTarget,
      updatedAt: nowIso(),
    },
  }

  // Clamp existing completion days (and derived progress) for all weeks to the new target.
  const nextWeeklyCompletionDays: AppStateV1['weeklyCompletionDays'] = { ...state.weeklyCompletionDays }
  const nextWeeklyProgress: AppStateV1['weeklyProgress'] = { ...state.weeklyProgress }

  for (const [weekStartDate, byTask] of Object.entries(state.weeklyCompletionDays)) {
    const days = byTask[weeklyTaskId]
    if (!Array.isArray(days)) continue

    const limited = days.slice(0, nextTarget)
    const nextWeekStart = weekStartDate as LocalDateString

    if (limited.length === 0) {
      const { [weeklyTaskId]: _removed, ...restDays } = byTask
      if (Object.keys(restDays).length > 0) nextWeeklyCompletionDays[nextWeekStart] = restDays
      else delete nextWeeklyCompletionDays[nextWeekStart]

      const currentWeekProgress = nextWeeklyProgress[nextWeekStart]
      if (currentWeekProgress) {
        const { [weeklyTaskId]: _removedP, ...restP } = currentWeekProgress
        if (Object.keys(restP).length > 0) nextWeeklyProgress[nextWeekStart] = restP
        else delete nextWeeklyProgress[nextWeekStart]
      }
    } else {
      nextWeeklyCompletionDays[nextWeekStart] = {
        ...byTask,
        [weeklyTaskId]: limited,
      }
      nextWeeklyProgress[nextWeekStart] = {
        ...(nextWeeklyProgress[nextWeekStart] ?? {}),
        [weeklyTaskId]: limited.length,
      }
    }
  }

  return {
    ...state,
    weeklyTasks: nextTasks,
    weeklyCompletionDays: nextWeeklyCompletionDays,
    weeklyProgress: nextWeeklyProgress,
  }
}

export function reorderWeeklyTasks(state: AppStateV1, orderedWeeklyTaskIds: WeeklyTaskId[]): AppStateV1 {
  const current = Object.values(state.weeklyTasks)
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex)

  const currentById = new Map(current.map((t) => [t.id, t]))

  const reordered: WeeklyTask[] = []
  orderedWeeklyTaskIds.forEach((id) => {
    const t = currentById.get(id)
    if (t) reordered.push(t)
  })
  current.forEach((t) => {
    if (!orderedWeeklyTaskIds.includes(t.id)) reordered.push(t)
  })

  const nextWeeklyTasks: AppStateV1['weeklyTasks'] = { ...state.weeklyTasks }
  reordered.forEach((t, idx) => {
    nextWeeklyTasks[t.id] = { ...t, sortIndex: idx, updatedAt: nowIso() }
  })

  return { ...state, weeklyTasks: nextWeeklyTasks }
}

// Adjust weekly completion count for a given task/week. Delta is usually +1 (click) or -1 (Shift+click).
// Note: Weekly progress is intentionally NOT locked.
export function adjustWeeklyCompletionForDate(
  state: AppStateV1,
  weekStartDate: LocalDateString,
  date: LocalDateString,
  weeklyTaskId: WeeklyTaskId,
  delta: 1 | -1,
): AppStateV1 {
  const task = state.weeklyTasks[weeklyTaskId]
  if (!task) return state

  const weekEndDate = addDays(weekStartDate, 6)
  if (date < weekStartDate || date > weekEndDate) return state

  const currentWeekDays = state.weeklyCompletionDays[weekStartDate] ?? {}
  const currentDays = currentWeekDays[weeklyTaskId] ?? []
  const set = new Set(currentDays)

  if (delta === 1) {
    // Rule: only once per day
    if (set.has(date)) return state
    if (set.size >= task.targetPerWeek) return state
    set.add(date)
  } else {
    // Shift+click cancels only that day's completion
    if (!set.has(date)) return state
    set.delete(date)
  }

  const nextDays = Array.from(set).sort()

  const nextWeeklyCompletionDays: AppStateV1['weeklyCompletionDays'] = { ...state.weeklyCompletionDays }
  const nextWeeklyProgress: AppStateV1['weeklyProgress'] = { ...state.weeklyProgress }

  if (nextDays.length === 0) {
    const { [weeklyTaskId]: _removed, ...rest } = currentWeekDays
    if (Object.keys(rest).length > 0) nextWeeklyCompletionDays[weekStartDate] = rest
    else delete nextWeeklyCompletionDays[weekStartDate]

    const currentWeekProgress = state.weeklyProgress[weekStartDate] ?? {}
    const { [weeklyTaskId]: _removedP, ...restP } = currentWeekProgress
    if (Object.keys(restP).length > 0) nextWeeklyProgress[weekStartDate] = restP
    else delete nextWeeklyProgress[weekStartDate]
  } else {
    nextWeeklyCompletionDays[weekStartDate] = {
      ...currentWeekDays,
      [weeklyTaskId]: nextDays,
    }
    nextWeeklyProgress[weekStartDate] = {
      ...(state.weeklyProgress[weekStartDate] ?? {}),
      [weeklyTaskId]: nextDays.length,
    }
  }

  return {
    ...state,
    weeklyCompletionDays: nextWeeklyCompletionDays,
    weeklyProgress: nextWeeklyProgress,
  }
}
