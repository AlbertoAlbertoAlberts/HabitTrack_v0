import {useCallback, useEffect} from 'react'
import type {HabitId, LocalDateString, Score} from '../../../domain/types'
import {appStore} from '../../../domain/store/appStore'
import {addDays} from '../../../domain/utils/localDate'

export function useScoreHandlers(
  selectedDate: LocalDateString,
  activeDateRef: React.MutableRefObject<LocalDateString>,
  flushPendingPriorityChanges: () => void,
) {
  // Commit previous date when selectedDate changes.
  useEffect(() => {
    const previous = activeDateRef.current
    if (previous !== selectedDate) {
      appStore.actions.commitIfNeeded(previous)

      // Leaving the day/page should also finalize any pending priority changes.
      flushPendingPriorityChanges()
      if (appStore.getState().uiState.dailyLeftMode === 'priorityEdit') {
        appStore.actions.setDailyLeftMode('normal')
      }

      activeDateRef.current = selectedDate
    }
  }, [activeDateRef, flushPendingPriorityChanges, selectedDate])

  // Best-effort commit on reload/close and on unmount.
  useEffect(() => {
    const handler = () => {
      appStore.actions.commitIfNeeded(activeDateRef.current)
      flushPendingPriorityChanges()
    }

    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      appStore.actions.commitIfNeeded(activeDateRef.current)
      flushPendingPriorityChanges()
    }
  }, [activeDateRef, flushPendingPriorityChanges])

  const setScore = useCallback(
    (habitId: HabitId, score: Score) => {
      const habit = appStore.getState().habits[habitId]
      const targetDate = habit?.scoreDay === 'previous' ? addDays(selectedDate, -1) : selectedDate
      appStore.actions.setScore(targetDate, habitId, score)
    },
    [selectedDate],
  )

  const goToPreviousDay = useCallback(() => {
    appStore.actions.commitIfNeeded(selectedDate)
    appStore.actions.setSelectedDate(addDays(selectedDate, -1))
  }, [selectedDate])

  const goToNextDay = useCallback(() => {
    appStore.actions.commitIfNeeded(selectedDate)
    appStore.actions.setSelectedDate(addDays(selectedDate, +1))
  }, [selectedDate])

  return {
    setScore,
    goToPreviousDay,
    goToNextDay,
  }
}
