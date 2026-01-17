import {useCallback, useEffect} from 'react'
import type {HabitId, LocalDateString, Score} from '../../../domain/types'
import {appStore} from '../../../domain/store/appStore'

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
      appStore.actions.setScore(selectedDate, habitId, score)
    },
    [selectedDate],
  )

  return {
    setScore,
  }
}
