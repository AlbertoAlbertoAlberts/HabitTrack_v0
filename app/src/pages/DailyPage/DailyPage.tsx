import DebugPanel from '../../components/debug/DebugPanel'
import { useAppState } from '../../domain/store/useAppStore'

export function DailyPage() {
  const state = useAppState()

  return (
    <div>
      <h1>DailyPage</h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Selected date: <strong>{state.uiState.selectedDate}</strong>
      </p>

      <DebugPanel />
    </div>
  )
}

export default DailyPage
