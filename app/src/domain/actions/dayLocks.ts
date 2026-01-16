import type { AppStateV1, IsoTimestamp, LocalDateString } from '../types'
import { todayLocalDateString } from '../utils/localDate'

function nowIso(): IsoTimestamp {
  return new Date().toISOString()
}

export function isLocked(state: AppStateV1, date: LocalDateString): boolean {
  // Policy: "today" stays editable even if a lock record exists.
  if (date === todayLocalDateString()) return false
  return Boolean(state.dayLocks[date])
}

export function commitIfNeeded(state: AppStateV1, date: LocalDateString): AppStateV1 {
  // Never auto-lock "today" so you can keep updating throughout the day.
  if (date === todayLocalDateString()) return state
  if (state.dayLocks[date]) return state

  const scoresForDate = state.dailyScores[date]
  if (!scoresForDate || Object.keys(scoresForDate).length === 0) return state

  return {
    ...state,
    dayLocks: {
      ...state.dayLocks,
      [date]: nowIso(),
    },
  }
}
