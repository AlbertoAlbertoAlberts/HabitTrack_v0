import { useEffect, useState } from 'react'

import type { AppStateV1 } from '../../domain/types'
import { clearState, loadState, saveState } from '../../persistence/storageService'

export function DailyPage() {
  const [state, setState] = useState<AppStateV1 | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setState(loadState())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return (
    <div>
      <h1>DailyPage</h1>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Storage smoke test</h2>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => {
              try {
                const next = loadState()
                saveState(next)
                setState(loadState())
                setError(null)
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            Save now
          </button>

          <button
            type="button"
            onClick={() => {
              try {
                setState(loadState())
                setError(null)
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            Load
          </button>

          <button
            type="button"
            onClick={() => {
              clearState()
              setState(loadState())
              setError(null)
            }}
          >
            Clear
          </button>
        </div>

        {error ? (
          <p style={{ color: '#b91c1c' }}>{error}</p>
        ) : (
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: '#f3f4f6',
              color: '#111827',
              overflow: 'auto',
            }}
          >
            {state ? JSON.stringify({
              schemaVersion: state.schemaVersion,
              savedAt: state.savedAt,
              selectedDate: state.uiState.selectedDate,
            }, null, 2) : 'Loading...'}
          </pre>
        )}
      </section>
    </div>
  )
}

export default DailyPage
