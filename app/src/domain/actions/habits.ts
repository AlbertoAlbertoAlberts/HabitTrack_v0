import type {
  AppStateV1,
  CategoryId,
  Habit,
  HabitId,
  IsoTimestamp,
  Priority,
} from '../types'

import { todayLocalDateString } from '../utils/localDate'

function nowIso(): IsoTimestamp {
  return new Date().toISOString()
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}`
}

function getHabitsInCategory(state: AppStateV1, categoryId: CategoryId): Habit[] {
  return Object.values(state.habits)
    .filter((h) => h.categoryId === categoryId)
    .sort((a, b) => a.sortIndex - b.sortIndex)
}

function renumberHabits(habits: Habit[]): Habit[] {
  return habits.map((h, idx) => ({ ...h, sortIndex: idx }))
}

function repositionHabitOnly(
  state: AppStateV1,
  habitId: HabitId,
  priorityToUse: Priority,
  setPriority: boolean,
): AppStateV1 {
  const habit = state.habits[habitId]
  if (!habit) return state

  const categoryId = habit.categoryId
  const habits = getHabitsInCategory(state, categoryId)
  const index = habits.findIndex((h) => h.id === habitId)
  if (index === -1) return state

  const updated: Habit = {
    ...habit,
    priority: setPriority ? priorityToUse : habit.priority,
    updatedAt: nowIso(),
  }

  const others = habits.filter((h) => h.id !== habitId)

  // Keep other items fixed; only move this one as little as possible.
  const lastHigher =
    others
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h.priority < priorityToUse)
      .map(({ i }) => i)
      .at(-1) ?? -1

  const firstLower =
    others
      .map((h, i) => ({ h, i }))
      .find(({ h }) => h.priority > priorityToUse)?.i ?? others.length

  const minIndex = lastHigher + 1
  const maxIndex = firstLower
  const clampedIndex = Math.max(minIndex, Math.min(index, maxIndex))

  const next = [...others]
  next.splice(clampedIndex, 0, updated)

  const renumbered = renumberHabits(next)
  const nextHabits: AppStateV1['habits'] = { ...state.habits }
  renumbered.forEach((h) => {
    nextHabits[h.id] = { ...h, updatedAt: h.id === habitId ? updated.updatedAt : nowIso() }
  })

  return { ...state, habits: nextHabits }
}

export function addHabit(
  state: AppStateV1,
  categoryId: CategoryId,
  name: string,
  priority: Priority = 1,
): AppStateV1 {
  if (!state.categories[categoryId]) return state

  const createdAt = nowIso()
  const id = newId()
  const nextSortIndex = getHabitsInCategory(state, categoryId).length

  const habit: Habit = {
    id,
    name,
    categoryId,
    priority,
    sortIndex: nextSortIndex,
    startDate: todayLocalDateString(),
    createdAt,
    updatedAt: createdAt,
  }

  // Insert new habit according to priority ordering rules (only the new habit moves).
  const withNew: AppStateV1 = {
    ...state,
    habits: {
      ...state.habits,
      [id]: habit,
    },
  }
  return repositionHabitOnly(withNew, id, priority, true)
}

export function deleteHabit(state: AppStateV1, habitId: HabitId): AppStateV1 {
  const habit = state.habits[habitId]
  if (!habit) return state

  const { [habitId]: _deleted, ...remainingHabits } = state.habits

  const remainingDailyScores: AppStateV1['dailyScores'] = {}
  for (const [date, scoresByHabitId] of Object.entries(state.dailyScores)) {
    const { [habitId]: _removed, ...rest } = scoresByHabitId
    if (Object.keys(rest).length > 0) remainingDailyScores[date] = rest
  }

  const categoryHabits = Object.values(remainingHabits)
    .filter((h) => h.categoryId === habit.categoryId)
    .sort((a, b) => a.sortIndex - b.sortIndex)

  const renumbered = renumberHabits(categoryHabits)
  const nextHabits: AppStateV1['habits'] = { ...remainingHabits }
  renumbered.forEach((h) => {
    nextHabits[h.id] = { ...h, updatedAt: nowIso() }
  })

  return {
    ...state,
    habits: nextHabits,
    dailyScores: remainingDailyScores,
  }
}

export function reorderHabits(
  state: AppStateV1,
  categoryId: CategoryId,
  orderedHabitIds: HabitId[],
): AppStateV1 {
  const current = getHabitsInCategory(state, categoryId)
  const currentById = new Map(current.map((h) => [h.id, h]))

  const reordered: Habit[] = []
  orderedHabitIds.forEach((id) => {
    const h = currentById.get(id)
    if (h) reordered.push(h)
  })
  // Append any missing ones (defensive)
  current.forEach((h) => {
    if (!orderedHabitIds.includes(h.id)) reordered.push(h)
  })

  const nextHabits: AppStateV1['habits'] = { ...state.habits }
  renumberHabits(reordered).forEach((h) => {
    nextHabits[h.id] = { ...h, updatedAt: nowIso() }
  })

  return { ...state, habits: nextHabits }
}

export function moveHabit(
  state: AppStateV1,
  habitId: HabitId,
  targetCategoryId: CategoryId,
  targetIndex?: number,
): AppStateV1 {
  const habit = state.habits[habitId]
  if (!habit) return state
  if (!state.categories[targetCategoryId]) return state

  const sourceCategoryId = habit.categoryId

  const sourceHabits = getHabitsInCategory(state, sourceCategoryId).filter((h) => h.id !== habitId)
  const targetHabits = getHabitsInCategory(state, targetCategoryId)

  const insertAt =
    typeof targetIndex === 'number'
      ? Math.max(0, Math.min(targetIndex, targetHabits.length))
      : targetHabits.length

  const moved: Habit = {
    ...habit,
    categoryId: targetCategoryId,
    updatedAt: nowIso(),
  }

  const nextTarget = [...targetHabits]
  nextTarget.splice(insertAt, 0, moved)

  const nextHabits: AppStateV1['habits'] = { ...state.habits }

  renumberHabits(sourceHabits).forEach((h) => {
    nextHabits[h.id] = { ...h, updatedAt: nowIso() }
  })

  renumberHabits(nextTarget).forEach((h) => {
    nextHabits[h.id] = { ...h, updatedAt: nowIso() }
  })

  return { ...state, habits: nextHabits }
}

export function setHabitPriority(
  state: AppStateV1,
  habitId: HabitId,
  newPriority: Priority,
): AppStateV1 {
  return repositionHabitOnly(state, habitId, newPriority, true)
}

// Phase 5: priority edit mode changes priority but delays reordering until exit.
export function setHabitPriorityValue(
  state: AppStateV1,
  habitId: HabitId,
  newPriority: Priority,
): AppStateV1 {
  const habit = state.habits[habitId]
  if (!habit) return state
  if (habit.priority === newPriority) return state

  return {
    ...state,
    habits: {
      ...state.habits,
      [habitId]: {
        ...habit,
        priority: newPriority,
        updatedAt: nowIso(),
      },
    },
  }
}

export function repositionHabitAfterPriorityChange(state: AppStateV1, habitId: HabitId): AppStateV1 {
  const habit = state.habits[habitId]
  if (!habit) return state
  return repositionHabitOnly(state, habitId, habit.priority, false)
}

export function renameHabit(state: AppStateV1, habitId: HabitId, name: string): AppStateV1 {
  const habit = state.habits[habitId]
  if (!habit) return state

  const trimmed = name.trim()
  if (!trimmed) return state
  if (habit.name === trimmed) return state

  return {
    ...state,
    habits: {
      ...state.habits,
      [habitId]: {
        ...habit,
        name: trimmed,
        updatedAt: nowIso(),
      },
    },
  }
}
