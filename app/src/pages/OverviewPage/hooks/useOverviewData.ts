import { useMemo } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { addDays, todayLocalDateString, weekStartMonday } from '../../../domain/utils/localDate'
import { getWeeklyTaskTargetPerWeekForWeekStart } from '../../../domain/utils/weeklyTaskTarget'
import type { Habit, LocalDateString, OverviewMode, Score, WeeklyTask } from '../../../domain/types'

type ChartPoint = { date: LocalDateString; value: number; earned: number; maxPossible: number }

function getHabitIdsForMode(
  mode: OverviewMode,
  habits: Habit[],
  selectedCategoryId: string | null,
  selectedHabitId: string | null,
): string[] {
  if (mode === 'overall') return habits.map((h) => h.id)
  if (mode === 'priority1') return habits.filter((h) => h.priority === 1).map((h) => h.id)
  if (mode === 'priority2') return habits.filter((h) => h.priority === 2).map((h) => h.id)
  if (mode === 'priority3') return habits.filter((h) => h.priority === 3).map((h) => h.id)
  if (mode === 'category') {
    if (!selectedCategoryId) return []
    return habits.filter((h) => h.categoryId === selectedCategoryId).map((h) => h.id)
  }
  if (mode === 'habit') {
    if (!selectedHabitId) return []
    return habits.some((h) => h.id === selectedHabitId) ? [selectedHabitId] : []
  }
  return []
}

function buildSeries(
  dates: LocalDateString[],
  dailyScores: Record<LocalDateString, Record<string, Score>>,
  habitIds: string[],
  habitsById: Record<string, Habit>,
): ChartPoint[] {
  return dates.map((date) => {
    const scores = dailyScores[date] ?? {}

    const activeHabitIds = habitIds.filter((id) => {
      const h = habitsById[id]
      if (!h) return false
      const start = h.startDate
      return !start || date >= start
    })

    const maxPossible = activeHabitIds.length * 2
    let earned = 0
    for (const id of activeHabitIds) earned += scores[id] ?? 0

    const value = maxPossible > 0 ? earned / maxPossible : 0
    return { date, value, earned, maxPossible }
  })
}

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : min
  return Math.max(min, Math.min(max, n))
}

export function useOverviewData() {
  const state = useAppState()

  const currentWeekStart = useMemo(() => weekStartMonday(todayLocalDateString()), [])

  const anchorDate = state.uiState.overviewWindowEndDate
  const rangeDays = state.uiState.overviewRangeDays
  const mode = state.uiState.overviewMode

  const { startDate, endDate } = useMemo(() => {
    if (rangeDays === 7) {
      const start = weekStartMonday(anchorDate)
      return { startDate: start, endDate: addDays(start, 6) }
    }

    const end = anchorDate
    return { startDate: addDays(end, -(rangeDays - 1)), endDate: end }
  }, [anchorDate, rangeDays])

  const weeklyTasks = useMemo(
    () => Object.values(state.weeklyTasks).slice().sort((a, b) => a.sortIndex - b.sortIndex),
    [state.weeklyTasks],
  )

  // Overview weekly summary is always Monday–Sunday for the week that contains the anchor date.
  const overviewWeekStart = useMemo(() => weekStartMonday(anchorDate), [anchorDate])
  const overviewWeekEnd = useMemo(() => addDays(overviewWeekStart, 6), [overviewWeekStart])

  const weeklyPoints = useMemo(() => {
    const byTaskDays = state.weeklyCompletionDays[overviewWeekStart] ?? {}
    const byTaskProgress = state.weeklyProgress[overviewWeekStart] ?? {}

    let earned = 0
    let max = 0

    const perTask: Array<{ task: WeeklyTask; earned: number }> = []

    for (const task of weeklyTasks) {
      const effectiveTarget = getWeeklyTaskTargetPerWeekForWeekStart(task, overviewWeekStart, currentWeekStart)
      const maxForTask = clampInt(effectiveTarget, 1, 7)
      max += maxForTask

      const days = byTaskDays[task.id]
      const fallbackCount = typeof byTaskProgress[task.id] === 'number' ? byTaskProgress[task.id] : 0
      const rawCount = Array.isArray(days) ? days.length : fallbackCount
      const earnedForTask = clampInt(rawCount, 0, maxForTask)

      earned += earnedForTask
      perTask.push({ task, earned: earnedForTask })
    }

    return { earned, max, perTask }
  }, [currentWeekStart, overviewWeekStart, state.weeklyCompletionDays, state.weeklyProgress, weeklyTasks])

  const categories = useMemo(
    () => Object.values(state.categories).sort((a, b) => a.sortIndex - b.sortIndex),
    [state.categories],
  )

  const habits = useMemo(() => {
    return Object.values(state.habits)
      .slice()
      .sort((a, b) => {
        if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId)
        return a.sortIndex - b.sortIndex
      })
  }, [state.habits])

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, c.name)
    return m
  }, [categories])

  const dates: LocalDateString[] = useMemo(() => {
    const list: LocalDateString[] = []
    for (let i = 0; i < rangeDays; i++) list.push(addDays(startDate, i))
    return list
  }, [startDate, rangeDays])

  const habitIds = useMemo(
    () =>
      getHabitIdsForMode(
        mode,
        habits,
        state.uiState.overviewSelectedCategoryId,
        state.uiState.overviewSelectedHabitId,
      ),
    [habits, mode, state.uiState.overviewSelectedCategoryId, state.uiState.overviewSelectedHabitId],
  )

  const series = useMemo(
    () => buildSeries(dates, state.dailyScores, habitIds, state.habits),
    [dates, state.dailyScores, habitIds, state.habits],
  )

  const yMax = useMemo(() => {
    // Elastic overview: plot completion ratio (0..1), keep max pinned to the top.
    return 1
  }, [])

  const totalEarned = useMemo(() => series.reduce((sum, p) => sum + p.earned, 0), [series])
  const totalMaxPossible = useMemo(() => series.reduce((sum, p) => sum + p.maxPossible, 0), [series])
  const totalPct = useMemo(
    () => (totalMaxPossible > 0 ? totalEarned / totalMaxPossible : 0),
    [totalEarned, totalMaxPossible],
  )
  const avgPct = useMemo(
    () => (series.length ? series.reduce((sum, p) => sum + p.value, 0) / series.length : 0),
    [series],
  )
  const maxPossibleEnd = useMemo(() => series.at(-1)?.maxPossible ?? 0, [series])
  const activeHabitsEnd = useMemo(() => Math.floor(maxPossibleEnd / 2), [maxPossibleEnd])

  return {
    // Date range
    startDate,
    endDate,
    dates,
    rangeDays,
    
    // Mode and selections
    mode,
    selectedCategoryId: state.uiState.overviewSelectedCategoryId,
    selectedHabitId: state.uiState.overviewSelectedHabitId,
    
    // Weekly data
    weeklyTasks,
    overviewWeekStart,
    overviewWeekEnd,
    weeklyPoints,
    currentWeekStart,
    
    // Categories and habits
    categories,
    habits,
    categoryNameById,
    
    // Chart data
    series,
    yMax,
    
    // Statistics
    totalEarned,
    totalMaxPossible,
    totalPct,
    avgPct,
    maxPossibleEnd,
    activeHabitsEnd,
  }
}
