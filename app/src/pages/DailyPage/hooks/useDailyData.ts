import { useMemo } from 'react'

import type { AppStateV1 } from '../../../domain/types'
import { appStore } from '../../../domain/store/appStore'
import { addDays, isToday, todayLocalDateString, weekStartMonday } from '../../../domain/utils/localDate'

export function useDailyData(state: AppStateV1) {
  const today = isToday(state.uiState.selectedDate)
  const selectedDate = state.uiState.selectedDate
  const locked = appStore.selectors.isLocked(selectedDate)
  const currentWeekStart = useMemo(() => weekStartMonday(todayLocalDateString()), [])

  function formatDateLabel(date: string): string {
    // Input is YYYY-MM-DD (local). Display as DD.MM.YYYY.
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date)
    if (!m) return date
    return `${m[3]}.${m[2]}.${m[1]}`
  }

  const categories = useMemo(
    () => Object.values(state.categories).sort((a, b) => a.sortIndex - b.sortIndex),
    [state.categories],
  )

  const habitsByCategory = useMemo(() => {
    const map = new Map<string, typeof state.habits[keyof typeof state.habits][]>();
    for (const habit of Object.values(state.habits)) {
      const list = map.get(habit.categoryId) ?? []
      list.push(habit)
      map.set(habit.categoryId, list)
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => a.sortIndex - b.sortIndex)
      map.set(key, list)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.habits])

  const categorySortIndexById = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of Object.values(state.categories)) {
      map.set(c.id, c.sortIndex)
    }
    return map
  }, [state.categories])

  const scoresForSelectedDate = state.dailyScores[selectedDate] ?? {}

  const allHabitsSorted = useMemo(
    () =>
      Object.values(state.habits)
        .slice()
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority
          const aCatIndex = categorySortIndexById.get(a.categoryId) ?? 0
          const bCatIndex = categorySortIndexById.get(b.categoryId) ?? 0
          if (aCatIndex !== bCatIndex) return aCatIndex - bCatIndex
          if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId)
          return a.sortIndex - b.sortIndex
        }),
    [state.habits, categorySortIndexById],
  )

  const habitsByPriority = useMemo(() => {
    const p1: typeof allHabitsSorted = []
    const p2: typeof allHabitsSorted = []
    const p3: typeof allHabitsSorted = []
    for (const h of allHabitsSorted) {
      if (h.priority === 1) p1.push(h)
      else if (h.priority === 2) p2.push(h)
      else p3.push(h)
    }
    return { 1: p1, 2: p2, 3: p3 } as const
  }, [allHabitsSorted])

  const todos = useMemo(
    () =>
      Object.values(state.todos)
        .slice()
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)),
    [state.todos],
  )

  const weeklyTasks = useMemo(
    () => Object.values(state.weeklyTasks).slice().sort((a, b) => a.sortIndex - b.sortIndex),
    [state.weeklyTasks],
  )

  const weekStartDate = useMemo(() => weekStartMonday(selectedDate), [selectedDate])
  const weekEndDate = useMemo(() => addDays(weekStartDate, 6), [weekStartDate])

  return {
    today,
    selectedDate,
    locked,
    currentWeekStart,
    formatDateLabel,
    categories,
    habitsByCategory,
    categorySortIndexById,
    scoresForSelectedDate,
    allHabitsSorted,
    habitsByPriority,
    todos,
    weeklyTasks,
    weekStartDate,
    weekEndDate,
  }
}
