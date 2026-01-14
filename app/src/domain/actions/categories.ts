import type { AppStateV1, Category, CategoryId, IsoTimestamp } from '../types'

function nowIso(): IsoTimestamp {
  return new Date().toISOString()
}

function normalizeCategorySortIndices(
  categories: Record<CategoryId, Category>,
): Record<CategoryId, Category> {
  const sorted = Object.values(categories).sort((a, b) => a.sortIndex - b.sortIndex)
  const normalized: Record<CategoryId, Category> = {}
  sorted.forEach((cat, index) => {
    normalized[cat.id] = { ...cat, sortIndex: index }
  })
  return normalized
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}`
}

export function addCategory(state: AppStateV1, name: string): AppStateV1 {
  const createdAt = nowIso()
  const id = newId()

  const category: Category = {
    id,
    name,
    sortIndex: Object.keys(state.categories).length,
    createdAt,
    updatedAt: createdAt,
  }

  return {
    ...state,
    categories: {
      ...state.categories,
      [id]: category,
    },
  }
}

export function deleteCategory(state: AppStateV1, categoryId: CategoryId): AppStateV1 {
  if (!state.categories[categoryId]) return state

  const { [categoryId]: _deleted, ...remainingCategories } = state.categories

  const deletedHabitIds = new Set(
    Object.values(state.habits)
      .filter((h) => h.categoryId === categoryId)
      .map((h) => h.id),
  )

  const remainingHabits: AppStateV1['habits'] = {}
  for (const [habitId, habit] of Object.entries(state.habits)) {
    if (!deletedHabitIds.has(habitId)) remainingHabits[habitId] = habit
  }

  const remainingDailyScores: AppStateV1['dailyScores'] = {}
  for (const [date, scoresByHabitId] of Object.entries(state.dailyScores)) {
    const nextDay: Record<string, 0 | 1 | 2> = {}
    for (const [habitId, score] of Object.entries(scoresByHabitId)) {
      if (!deletedHabitIds.has(habitId)) nextDay[habitId] = score
    }
    if (Object.keys(nextDay).length > 0) remainingDailyScores[date] = nextDay
  }

  const normalizedCategories = normalizeCategorySortIndices(remainingCategories)

  return {
    ...state,
    categories: normalizedCategories,
    habits: remainingHabits,
    dailyScores: remainingDailyScores,
  }
}

export function reorderCategories(state: AppStateV1, orderedIds: CategoryId[]): AppStateV1 {
  const next: Record<CategoryId, Category> = { ...state.categories }

  orderedIds.forEach((id, index) => {
    const cat = next[id]
    if (!cat) return
    next[id] = {
      ...cat,
      sortIndex: index,
      updatedAt: nowIso(),
    }
  })

  return {
    ...state,
    categories: normalizeCategorySortIndices(next),
  }
}

export function renameCategory(state: AppStateV1, categoryId: CategoryId, name: string): AppStateV1 {
  const cat = state.categories[categoryId]
  if (!cat) return state

  const trimmed = name.trim()
  if (!trimmed) return state
  if (cat.name === trimmed) return state

  return {
    ...state,
    categories: {
      ...state.categories,
      [categoryId]: {
        ...cat,
        name: trimmed,
        updatedAt: nowIso(),
      },
    },
  }
}
