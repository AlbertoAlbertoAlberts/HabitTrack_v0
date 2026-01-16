import type { LocalDateString, WeeklyTask, WeeklyTaskTargetChange } from '../types'

function clampTargetPerWeek(value: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : 1
  return Math.max(1, Math.min(7, n))
}

function normalizeHistory(history: WeeklyTaskTargetChange[]): WeeklyTaskTargetChange[] {
  const valid = history
    .filter((h) => h && typeof h.weekStart === 'string')
    .map((h) => ({ weekStart: h.weekStart, targetPerWeek: clampTargetPerWeek(h.targetPerWeek) }))

  valid.sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  // Collapse duplicates by keeping the last entry for each weekStart.
  const byWeek = new Map<string, WeeklyTaskTargetChange>()
  for (const h of valid) byWeek.set(h.weekStart, h)

  return Array.from(byWeek.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

export function getWeeklyTaskTargetPerWeekForWeekStart(
  task: WeeklyTask,
  weekStartDate: LocalDateString,
  currentWeekStart: LocalDateString,
): number {
  // By requirement, current week should instantly reflect the latest target.
  if (weekStartDate >= currentWeekStart) return clampTargetPerWeek(task.targetPerWeek)

  const historyRaw = task.targetHistory
  const history = Array.isArray(historyRaw) ? normalizeHistory(historyRaw) : []

  // Find most recent entry whose weekStart <= weekStartDate.
  let best: WeeklyTaskTargetChange | null = null
  for (const h of history) {
    if (h.weekStart <= weekStartDate) best = h
    else break
  }

  return clampTargetPerWeek(best?.targetPerWeek ?? task.targetPerWeek)
}
