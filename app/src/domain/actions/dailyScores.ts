import type { AppStateV1, HabitId, LocalDateString, Score } from '../types'

export function getScoresForDate(
  state: AppStateV1,
  date: LocalDateString,
): Record<HabitId, Score> {
  return state.dailyScores[date] ?? {}
}

export function setScore(
  state: AppStateV1,
  date: LocalDateString,
  habitId: HabitId,
  score: Score,
): AppStateV1 {
  if (state.dayLocks[date]) {
    throw new Error(`Date ${date} is locked.`)
  }
  if (!state.habits[habitId]) {
    throw new Error(`Habit ${habitId} does not exist.`)
  }

  const dayScores = state.dailyScores[date] ?? {}

  return {
    ...state,
    dailyScores: {
      ...state.dailyScores,
      [date]: {
        ...dayScores,
        [habitId]: score,
      },
    },
  }
}
