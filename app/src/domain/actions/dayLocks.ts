import type { AppStateV1, IsoTimestamp, LocalDateString } from '../types'

function nowIso(): IsoTimestamp {
  return new Date().toISOString()
}

export function isLocked(state: AppStateV1, date: LocalDateString): boolean {
  return Boolean(state.dayLocks[date])
}

export function commitIfNeeded(state: AppStateV1, date: LocalDateString): AppStateV1 {
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
