import type { AppStateV1, HabitId, LocalDateString, Score } from '../types'
import { isLocked } from './dayLocks'

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
  if (isLocked(state, date)) {
    throw new Error(`Date ${date} is locked.`)
  }
  const habit = state.habits[habitId]
  if (!habit) {
    throw new Error(`Habit ${habitId} does not exist.`)
  }
  if (habit.startDate && date < habit.startDate) {
    throw new Error(`Habit ${habitId} is not active on ${date}.`)
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
