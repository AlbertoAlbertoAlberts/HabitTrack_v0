import { useEffect, useRef } from 'react'

import DebugPanel from '../../components/debug/DebugPanel'
import { appStore } from '../../domain/store/appStore'
import { useAppState } from '../../domain/store/useAppStore'
import { addDays, isToday } from '../../domain/utils/localDate'

export function DailyPage() {
  const state = useAppState()
  const activeDateRef = useRef(state.uiState.selectedDate)

  // Phase 3: commit-on-leave day session controller.
  // - Commit previous date when selectedDate changes
  // - Commit current date when leaving the page (unmount)
  // - Best-effort commit on reload/close
  useEffect(() => {
    const previous = activeDateRef.current
    const next = state.uiState.selectedDate
    if (previous !== next) {
      appStore.actions.commitIfNeeded(previous)
      activeDateRef.current = next
    }
  }, [state.uiState.selectedDate])

  useEffect(() => {
    const handler = () => {
      appStore.actions.commitIfNeeded(activeDateRef.current)
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      appStore.actions.commitIfNeeded(activeDateRef.current)
    }
  }, [])

  const today = isToday(state.uiState.selectedDate)

  return (
    <div>
      <h1>DailyPage</h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Selected date: <strong>{state.uiState.selectedDate}</strong>
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button
          type="button"
          onClick={() => {
            const next = addDays(state.uiState.selectedDate, -1)
            appStore.actions.setSelectedDate(next)
          }}
        >
          Prev day
        </button>
        <button
          type="button"
          disabled={today}
          onClick={() => {
            const next = addDays(state.uiState.selectedDate, +1)
            appStore.actions.setSelectedDate(next)
          }}
          title={today ? 'Disabled when viewing today' : undefined}
        >
          Next day
        </button>
        {appStore.selectors.isLocked(state.uiState.selectedDate) ? (
          <span style={{ marginLeft: 8, opacity: 0.8 }}>Locked</span>
        ) : (
          <span style={{ marginLeft: 8, opacity: 0.8 }}>Editable</span>
        )}
      </div>

      <DebugPanel />
    </div>
  )
}

export default DailyPage
