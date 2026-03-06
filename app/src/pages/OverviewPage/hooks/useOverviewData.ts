import { useMemo } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { addDays, todayLocalDateString, weekStartMonday } from '../../../domain/utils/localDate'
import { getWeeklyTaskTargetPerWeekForWeekStart } from '../../../domain/utils/weeklyTaskTarget'
import type {
  Habit,
  LabProject,
  LabDailyProjectConfig,
  LocalDateString,
  OverviewMode,
  OverviewSelection,
  Score,
  WeeklyTask,
} from '../../../domain/types'

type ChartPoint = { date: LocalDateString; value: number; earned: number; maxPossible: number }

export type EventBar = {
  date: LocalDateString
  count: number
}

export type WeeklySegment = {
  weekStart: LocalDateString
  pct: number          // 0..1
  startDate: LocalDateString   // segment start (clipped to chart range)
  endDate: LocalDateString     // segment end (clipped to chart range)
}

export type MultiSeriesEntry = {
  label: string
  color: string
  series: ChartPoint[]
  kind: OverviewSelection['kind']
  eventBars?: EventBar[]
  weeklySegments?: WeeklySegment[]
}

const SLOT_COLORS = ['#ffffff', '#06b6d4', '#d946ef'] as const

/* Priority-based weight: P1 → 1, P2 → 0.66, P3 → 0.33 */
const PRIORITY_WEIGHT: Record<number, number> = { 1: 1, 2: 0.66, 3: 0.33 }

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
  weighted: boolean,
): ChartPoint[] {
  const today = todayLocalDateString()
  
  return dates.map((date) => {
    const sameDayScores = dailyScores[date] ?? {}

    const activeHabitIds = habitIds.filter((id) => {
      const h = habitsById[id]
      if (!h) return false
      const start = h.startDate
      return !start || date >= start
    })

    let maxPossible = 0
    let earned = 0
    for (const id of activeHabitIds) {
      const h = habitsById[id]
      if (!h) continue
      const w = weighted ? (PRIORITY_WEIGHT[h.priority] ?? 1) : 1
      maxPossible += 2 * w
      // No special handling for scoreDay === 'previous' — the write path
      // already stores the score at D-1, so sameDayScores is correct.
      earned += (sameDayScores[id] ?? 0) * w
    }

    // For future dates, set value to NaN so chart can skip rendering
    const value = date > today ? NaN : (maxPossible > 0 ? earned / maxPossible : 0)
    return { date, value, earned, maxPossible }
  })
}

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : min
  return Math.max(min, Math.min(max, n))
}

/** Build chart series for a lab daily project */
function buildLabDailySeries(
  dates: LocalDateString[],
  logs: Record<string, { outcome?: number }> | undefined,
  config: LabDailyProjectConfig,
): ChartPoint[] {
  const today = todayLocalDateString()
  const scaleMin = config.outcome.scale.min
  const scaleMax = config.outcome.scale.max
  const range = scaleMax - scaleMin

  return dates.map((date) => {
    if (date > today) return { date, value: NaN, earned: 0, maxPossible: 0 }
    const log = logs?.[date]
    if (!log || log.outcome == null) return { date, value: NaN, earned: 0, maxPossible: 0 }

    const pct = range > 0 ? (log.outcome - scaleMin) / range : 0
    return { date, value: Math.max(0, Math.min(1, pct)), earned: log.outcome, maxPossible: scaleMax }
  })
}

/** Build event bars for a lab event project */
function buildEventBars(
  dates: LocalDateString[],
  eventLogs: Record<string, { timestamp: string }> | undefined,
): EventBar[] {
  if (!eventLogs) return []

  // Count events per date
  const countByDate = new Map<string, number>()
  for (const ev of Object.values(eventLogs)) {
    // timestamp is ISO-8601, extract the local date (YYYY-MM-DD)
    const date = ev.timestamp.slice(0, 10) as LocalDateString
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1)
  }

  const dateSet = new Set(dates)
  const bars: EventBar[] = []
  for (const [date, count] of countByDate.entries()) {
    if (dateSet.has(date as LocalDateString)) {
      bars.push({ date: date as LocalDateString, count })
    }
  }
  return bars
}

/** Build weekly score segments spanning the chart date range */
function buildWeeklySegments(
  chartStartDate: LocalDateString,
  chartEndDate: LocalDateString,
  weeklyTasks: WeeklyTask[],
  weeklyCompletionDays: Record<string, Record<string, string[]>>,
  weeklyProgress: Record<string, Record<string, number>>,
  currentWeekStart: LocalDateString,
): WeeklySegment[] {
  if (weeklyTasks.length === 0) return []

  const segments: WeeklySegment[] = []

  // Walk through all weeks that overlap the chart range
  let ws = weekStartMonday(chartStartDate)
  while (ws <= chartEndDate) {
    const we = addDays(ws, 6) // week end (Sunday)

    // Clip to chart range
    const segStart = ws < chartStartDate ? chartStartDate : ws
    const segEnd = we > chartEndDate ? chartEndDate : we

    // Compute earned / max for this week
    const byTaskDays = weeklyCompletionDays[ws] ?? {}
    const byTaskProgress = weeklyProgress[ws] ?? {}

    let earned = 0
    let max = 0

    for (const task of weeklyTasks) {
      const effectiveTarget = getWeeklyTaskTargetPerWeekForWeekStart(task, ws, currentWeekStart)
      const maxForTask = clampInt(effectiveTarget, 1, 7)
      max += maxForTask

      const days = byTaskDays[task.id]
      const fallbackCount = typeof byTaskProgress[task.id] === 'number' ? byTaskProgress[task.id] : 0
      const rawCount = Array.isArray(days) ? days.length : fallbackCount
      earned += clampInt(rawCount, 0, maxForTask)
    }

    const pct = max > 0 ? earned / max : 0

    segments.push({ weekStart: ws, pct, startDate: segStart, endDate: segEnd })

    ws = addDays(ws, 7)
  }

  return segments
}

export function useOverviewData() {
  const state = useAppState()

  const currentWeekStart = useMemo(() => weekStartMonday(todayLocalDateString()), [])

  const anchorDate = state.uiState.overviewWindowEndDate
  const rangeDays = state.uiState.overviewRangeDays
  const mode = state.uiState.overviewMode
  const selectedLabProjectId = state.uiState.overviewSelectedLabProjectId

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

  // Lab projects (non-archived)
  const labProjects: LabProject[] = useMemo(() => {
    if (!state.lab) return []
    const order = state.lab.projectOrder ?? []
    return order
      .map((id) => state.lab!.projects[id])
      .filter((p): p is LabProject => !!p && !p.archived)
  }, [state.lab])

  const selectedLabProject: LabProject | null = useMemo(() => {
    if (!selectedLabProjectId || !state.lab) return null
    return state.lab.projects[selectedLabProjectId] ?? null
  }, [selectedLabProjectId, state.lab])

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

  const weighted = mode === 'overall' || mode === 'category'

  const series = useMemo(
    () => buildSeries(dates, state.dailyScores, habitIds, state.habits, weighted),
    [dates, state.dailyScores, habitIds, state.habits, weighted],
  )

  // Lab daily series — only when a daily lab project is selected
  const labDailySeries: ChartPoint[] = useMemo(() => {
    if (mode !== 'lab' || !selectedLabProject || selectedLabProject.mode !== 'daily') return []
    const logs = state.lab?.dailyLogsByProject[selectedLabProject.id]
    return buildLabDailySeries(dates, logs, selectedLabProject.config as LabDailyProjectConfig)
  }, [mode, selectedLabProject, dates, state.lab?.dailyLogsByProject])

  // Lab event bars — only when an event lab project is selected
  const labEventBars: EventBar[] = useMemo(() => {
    if (mode !== 'lab' || !selectedLabProject || selectedLabProject.mode !== 'event') return []
    const eventLogs = state.lab?.eventLogsByProject[selectedLabProject.id]
    return buildEventBars(dates, eventLogs as Record<string, { timestamp: string }> | undefined)
  }, [mode, selectedLabProject, dates, state.lab?.eventLogsByProject])

  // Weekly segments — only in weekly mode
  const weeklySegments: WeeklySegment[] = useMemo(() => {
    if (mode !== 'weekly') return []
    return buildWeeklySegments(
      startDate,
      endDate,
      weeklyTasks,
      state.weeklyCompletionDays,
      state.weeklyProgress,
      currentWeekStart,
    )
  }, [mode, startDate, endDate, weeklyTasks, state.weeklyCompletionDays, state.weeklyProgress, currentWeekStart])

  // Use lab daily series as the effective series for stats when in lab daily mode
  const effectiveSeries = mode === 'lab' && selectedLabProject?.mode === 'daily' ? labDailySeries : series

  // ── Multi-select data ──
  const multiSelectCount = state.uiState.overviewMultiSelectCount
  const multiSelections = state.uiState.overviewMultiSelections

  const multiSeries: MultiSeriesEntry[] = useMemo(() => {
    if (multiSelectCount <= 1 || multiSelections.length === 0) return []

    return multiSelections.map((sel, idx) => {
      const color = SLOT_COLORS[idx] ?? SLOT_COLORS[0]

      if (sel.kind === 'habit' && sel.id) {
        const h = state.habits[sel.id]
        const label = h?.name ?? 'Ieradums'
        const hSeries = buildSeries(dates, state.dailyScores, [sel.id], state.habits, false)
        return { label, color, series: hSeries, kind: sel.kind }
      }

      if (sel.kind === 'labDaily' && sel.id) {
        const proj = state.lab?.projects[sel.id]
        const label = proj?.name ?? 'Lab'
        if (proj && proj.mode === 'daily') {
          const logs = state.lab?.dailyLogsByProject[proj.id]
          const s = buildLabDailySeries(dates, logs, proj.config as LabDailyProjectConfig)
          return { label, color, series: s, kind: sel.kind }
        }
        return { label, color, series: [], kind: sel.kind }
      }

      if (sel.kind === 'labEvent' && sel.id) {
        const proj = state.lab?.projects[sel.id]
        const label = proj?.name ?? 'Lab Event'
        const eventLogs = state.lab?.eventLogsByProject[sel.id]
        const bars = buildEventBars(dates, eventLogs as Record<string, { timestamp: string }> | undefined)
        return { label, color, series: [], kind: sel.kind, eventBars: bars }
      }

      if (sel.kind === 'weekly') {
        const segments = buildWeeklySegments(
          startDate, endDate, weeklyTasks,
          state.weeklyCompletionDays, state.weeklyProgress, currentWeekStart,
        )
        return { label: 'Nedēļa', color, series: [], kind: sel.kind, weeklySegments: segments }
      }

      return { label: '?', color, series: [], kind: sel.kind }
    })
  }, [
    multiSelectCount, multiSelections, dates, startDate, endDate,
    state.habits, state.dailyScores, state.lab,
    state.weeklyCompletionDays, state.weeklyProgress,
    weeklyTasks, currentWeekStart,
  ])

  const yMax = useMemo(() => {
    // Elastic overview: plot completion ratio (0..1), keep max pinned to the top.
    return 1
  }, [])

  const totalEarned = useMemo(() => effectiveSeries.reduce((sum, p) => sum + p.earned, 0), [effectiveSeries])
  const totalMaxPossible = useMemo(() => effectiveSeries.reduce((sum, p) => sum + p.maxPossible, 0), [effectiveSeries])
  const totalPct = useMemo(
    () => (totalMaxPossible > 0 ? totalEarned / totalMaxPossible : 0),
    [totalEarned, totalMaxPossible],
  )
  const avgPct = useMemo(
    () => {
      const finite = effectiveSeries.filter(p => Number.isFinite(p.value))
      if (finite.length === 0) return 0
      return finite.reduce((sum, p) => sum + p.value, 0) / finite.length
    },
    [effectiveSeries],
  )
  const maxPossibleEnd = useMemo(() => effectiveSeries.at(-1)?.maxPossible ?? 0, [effectiveSeries])
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
    selectedLabProjectId,
    
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

    // Lab projects
    labProjects,
    selectedLabProject,

    // Chart data
    series: effectiveSeries,
    yMax,
    labEventBars,
    weeklySegments,
    multiSeries,

    // Multi-select state
    multiSelectCount,
    multiSelections,
    
    // Statistics
    totalEarned,
    totalMaxPossible,
    totalPct,
    avgPct,
    maxPossibleEnd,
    activeHabitsEnd,
  }
}
