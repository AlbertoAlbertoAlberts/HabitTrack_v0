import { useMemo, useState } from 'react'

import { appStore } from '../../domain/store/appStore'
import { useAppState } from '../../domain/store/useAppStore'

export function DebugPanel() {
  const state = useAppState()
  const [error, setError] = useState<string | null>(null)

  const selectedDate = state.uiState.selectedDate
  const locked = Boolean(state.dayLocks[selectedDate])

  const categoryIds = useMemo(
    () => Object.values(state.categories).sort((a, b) => a.sortIndex - b.sortIndex).map((c) => c.id),
    [state.categories],
  )

  const firstCategoryId = categoryIds[0] ?? null
  const firstHabitId = useMemo(() => {
    const habits = Object.values(state.habits)
    if (habits.length === 0) return null
    return habits.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)?.id ?? null
  }, [state.habits])

  return (
    <section style={{ marginTop: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Debug actions (Phase 3)</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt('Category name?', 'Kategorija')
            if (!name) return
            appStore.actions.addCategory(name)
          }}
        >
          Add category
        </button>

        <button
          type="button"
          disabled={!firstCategoryId}
          onClick={() => {
            if (!firstCategoryId) return
            const name = window.prompt('Habit name?', 'Ieradums')
            if (!name) return
            appStore.actions.addHabit(firstCategoryId, name, 3)
          }}
        >
          Add habit (to first category)
        </button>

        <button
          type="button"
          disabled={!firstHabitId || locked}
          onClick={() => {
            if (!firstHabitId) return
            try {
              appStore.actions.setScore(selectedDate, firstHabitId, 2)
              setError(null)
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            }
          }}
        >
          Set score=2 (selectedDate, last habit)
        </button>

        <button
          type="button"
          onClick={() => {
            const text = window.prompt('Todo text?', 'Uzdevums')
            if (!text) return
            appStore.actions.addTodo(text)
          }}
        >
          Add todo
        </button>

        <button
          type="button"
          disabled={locked}
          onClick={() => {
            try {
              appStore.actions.commitIfNeeded(selectedDate)
              setError(null)
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            }
          }}
        >
          Commit lock (selectedDate)
        </button>
      </div>

      {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

      <pre
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 8,
          background: '#f3f4f6',
          color: '#111827',
          overflow: 'auto',
          maxHeight: 280,
        }}
      >
        {JSON.stringify(
          {
            schemaVersion: state.schemaVersion,
            savedAt: state.savedAt,
            categories: Object.values(state.categories)
              .sort((a, b) => a.sortIndex - b.sortIndex)
              .map((c) => ({ id: c.id, name: c.name, sortIndex: c.sortIndex })),
            habits: Object.values(state.habits)
              .sort((a, b) => a.sortIndex - b.sortIndex)
              .map((h) => ({
                id: h.id,
                name: h.name,
                categoryId: h.categoryId,
                priority: h.priority,
                sortIndex: h.sortIndex,
              })),
            selectedDate: state.uiState.selectedDate,
            locked,
            scoresForSelectedDate: state.dailyScores[selectedDate] ?? {},
            todos: Object.values(state.todos)
              .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
              .map((t) => ({ id: t.id, text: t.text, sortIndex: t.sortIndex ?? null })),
            todoArchiveCount: Object.keys(state.todoArchive).length,
          },
          null,
          2,
        )}
      </pre>
    </section>
  )
}

export default DebugPanel
