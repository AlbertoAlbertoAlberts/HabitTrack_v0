import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import DebugPanel from '../../components/debug/DebugPanel'
import { appStore } from '../../domain/store/appStore'
import { useAppState } from '../../domain/store/useAppStore'
import { addDays, isToday } from '../../domain/utils/localDate'

import styles from './DailyPage.module.css'

export function DailyPage() {
  const state = useAppState()
  const activeDateRef = useRef(state.uiState.selectedDate)
  const [newTodoText, setNewTodoText] = useState('')
  const pendingPriorityChangedRef = useRef<Set<string>>(new Set())

  const isPriorityEdit = state.uiState.dailyLeftMode === 'priorityEdit'

  // Phase 3: commit-on-leave day session controller.
  // - Commit previous date when selectedDate changes
  // - Commit current date when leaving the page (unmount)
  // - Best-effort commit on reload/close
  useEffect(() => {
    const previous = activeDateRef.current
    const next = state.uiState.selectedDate
    if (previous !== next) {
      appStore.actions.commitIfNeeded(previous)

      // Leaving the day/page should also finalize any pending priority changes.
      if (pendingPriorityChangedRef.current.size > 0) {
        for (const habitId of pendingPriorityChangedRef.current) {
          appStore.actions.repositionHabitAfterPriorityChange(habitId)
        }
        pendingPriorityChangedRef.current.clear()
      }

      activeDateRef.current = next
    }
  }, [state.uiState.selectedDate])

  useEffect(() => {
    const handler = () => {
      appStore.actions.commitIfNeeded(activeDateRef.current)

      if (pendingPriorityChangedRef.current.size > 0) {
        for (const habitId of pendingPriorityChangedRef.current) {
          appStore.actions.repositionHabitAfterPriorityChange(habitId)
        }
        pendingPriorityChangedRef.current.clear()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      appStore.actions.commitIfNeeded(activeDateRef.current)

      if (pendingPriorityChangedRef.current.size > 0) {
        for (const habitId of pendingPriorityChangedRef.current) {
          appStore.actions.repositionHabitAfterPriorityChange(habitId)
        }
        pendingPriorityChangedRef.current.clear()
      }
    }
  }, [])

  const today = isToday(state.uiState.selectedDate)
  const selectedDate = state.uiState.selectedDate
  const locked = appStore.selectors.isLocked(selectedDate)

  const categories = useMemo(
    () => Object.values(state.categories).sort((a, b) => a.sortIndex - b.sortIndex),
    [state.categories],
  )

  const habitsByCategory = useMemo(() => {
    const map = new Map<string, typeof state.habits[keyof typeof state.habits][]>();
    for (const habit of Object.values(state.habits)) {
      const list = map.get(habit.categoryId) ?? []
      list.push(habit)
      map.set(habit.categoryId, list)
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => a.sortIndex - b.sortIndex)
      map.set(key, list)
    }
    return map
  }, [state.habits])

  const scoresForSelectedDate = state.dailyScores[selectedDate] ?? {}

  const allHabitsSorted = useMemo(
    () =>
      Object.values(state.habits)
        .slice()
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority
          if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId)
          return a.sortIndex - b.sortIndex
        }),
    [state.habits],
  )

  const habitsByPriority = useMemo(() => {
    const p1: typeof allHabitsSorted = []
    const p2: typeof allHabitsSorted = []
    const p3: typeof allHabitsSorted = []
    for (const h of allHabitsSorted) {
      if (h.priority === 1) p1.push(h)
      else if (h.priority === 2) p2.push(h)
      else p3.push(h)
    }
    return { 1: p1, 2: p2, 3: p3 } as const
  }, [allHabitsSorted])
  const todos = useMemo(
    () =>
      Object.values(state.todos)
        .slice()
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0)),
    [state.todos],
  )

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Izaicinājumi</h2>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={() => appStore.actions.setDailyViewMode('category')}
            aria-pressed={state.uiState.dailyViewMode === 'category'}
            title="Category view"
          >
            Category
          </button>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={() => appStore.actions.setDailyViewMode('priority')}
            aria-pressed={state.uiState.dailyViewMode === 'priority'}
            title="Priority view"
          >
            Priority
          </button>

          <span style={{ flex: 1 }} />

          {isPriorityEdit ? (
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => {
                if (pendingPriorityChangedRef.current.size > 0) {
                  for (const habitId of pendingPriorityChangedRef.current) {
                    appStore.actions.repositionHabitAfterPriorityChange(habitId)
                  }
                  pendingPriorityChangedRef.current.clear()
                }
                appStore.actions.setDailyLeftMode('normal')
              }}
              title="Exit priority edit mode"
            >
              X
            </button>
          ) : (
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => appStore.actions.setDailyLeftMode('priorityEdit')}
              title="Enter priority edit mode"
            >
              Edit priority
            </button>
          )}

          <button
            type="button"
            className={styles.smallBtn}
            onClick={() => {
              const name = window.prompt('Category name?', 'Kategorija')
              if (!name) return
              appStore.actions.addCategory(name)
            }}
          >
            + Category
          </button>
        </div>

        {categories.length === 0 ? (
          <p className={styles.muted}>No categories yet.</p>
        ) : null}

        {categories.map((cat) => {
          const habits = habitsByCategory.get(cat.id) ?? []
          return (
            <div key={cat.id} className={styles.category}>
              <div className={styles.categoryHeader}>
                <h3 className={styles.categoryName}>{cat.name}</h3>
                <button
                  type="button"
                  className={styles.smallBtn}
                  onClick={() => {
                    const habitName = window.prompt('Habit name?', 'Ieradums')
                    if (!habitName) return
                    appStore.actions.addHabit(cat.id, habitName, 1)
                  }}
                >
                  + Habit
                </button>
              </div>

              {habits.length === 0 ? <p className={styles.muted}>No habits.</p> : null}

              {habits.map((h) => (
                <div key={h.id} className={styles.habitRow}>
                  <span className={styles.habitName} title={h.name}>
                    {h.name}
                  </span>

                  {isPriorityEdit ? (
                    <span className={styles.scoreGroup}>
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => {
                          const next = (Math.max(1, h.priority - 1) as 1 | 2 | 3)
                          appStore.actions.setHabitPriorityValue(h.id, next)
                          pendingPriorityChangedRef.current.add(h.id)
                        }}
                        disabled={h.priority === 1}
                        aria-label={`Decrease priority for ${h.name}`}
                      >
                        &lt;
                      </button>
                      <span className={styles.muted}>{h.priority}</span>
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => {
                          const next = (Math.min(3, h.priority + 1) as 1 | 2 | 3)
                          appStore.actions.setHabitPriorityValue(h.id, next)
                          pendingPriorityChangedRef.current.add(h.id)
                        }}
                        disabled={h.priority === 3}
                        aria-label={`Increase priority for ${h.name}`}
                      >
                        &gt;
                      </button>
                    </span>
                  ) : (
                    <span className={styles.muted}>P{h.priority}</span>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Diena</h2>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={() => {
              appStore.actions.commitIfNeeded(selectedDate)
              appStore.actions.setSelectedDate(addDays(selectedDate, -1))
            }}
          >
            Prev day
          </button>
          <button
            type="button"
            className={styles.smallBtn}
            disabled={today}
            title={today ? 'Disabled when viewing today' : undefined}
            onClick={() => {
              appStore.actions.commitIfNeeded(selectedDate)
              appStore.actions.setSelectedDate(addDays(selectedDate, +1))
            }}
          >
            Next day
          </button>
          <span className={styles.muted}>
            {selectedDate} · {locked ? 'Locked' : 'Editable'}
          </span>
        </div>

        {state.uiState.dailyViewMode === 'category'
          ? categories.map((cat) => {
              const habits = habitsByCategory.get(cat.id) ?? []
              if (habits.length === 0) return null

              return (
                <div key={cat.id} className={styles.category}>
                  <h3 className={styles.categoryName}>{cat.name}</h3>
                  {habits.map((h) => {
                    const value = scoresForSelectedDate[h.id]
                    return (
                      <div key={h.id} className={styles.habitRow}>
                        <span className={styles.habitName} title={h.name}>
                          {h.name}
                        </span>
                        <span className={styles.scoreGroup}>
                          {[0, 1, 2].map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={locked}
                              className={`${styles.scoreBtn} ${value === s ? styles.scoreBtnActive : ''}`}
                              onClick={() => {
                                appStore.actions.setScore(selectedDate, h.id, s as 0 | 1 | 2)
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })
          : ([1, 2, 3] as const).map((p) => {
              const habits = habitsByPriority[p]
              if (habits.length === 0) return null

              return (
                <div key={p} className={styles.category}>
                  <h3 className={styles.categoryName}>Prioritāte {p}</h3>
                  {habits.map((h) => {
                    const value = scoresForSelectedDate[h.id]
                    return (
                      <div key={h.id} className={styles.habitRow}>
                        <span className={styles.habitName} title={h.name}>
                          {h.name}
                        </span>
                        <span className={styles.scoreGroup}>
                          {[0, 1, 2].map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={locked}
                              className={`${styles.scoreBtn} ${value === s ? styles.scoreBtnActive : ''}`}
                              onClick={() => {
                                appStore.actions.setScore(selectedDate, h.id, s as 0 | 1 | 2)
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })}

        {categories.length > 0 && Object.keys(state.habits).length === 0 ? (
          <p className={styles.muted}>Add a habit to start scoring.</p>
        ) : null}

        <details style={{ marginTop: 16 }}>
          <summary className={styles.muted}>Debug</summary>
          <DebugPanel />
        </details>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>TO-DO</h2>

        <div className={styles.toolbar}>
          <input
            className={styles.input}
            placeholder="Add todo"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const text = newTodoText.trim()
              if (!text) return
              appStore.actions.addTodo(text)
              setNewTodoText('')
            }}
          />
          <button
            type="button"
            className={styles.smallBtn}
            onClick={() => {
              const text = newTodoText.trim()
              if (!text) return
              appStore.actions.addTodo(text)
              setNewTodoText('')
            }}
          >
            Add
          </button>
          <Link to="/archive" className={styles.smallBtn} style={{ textDecoration: 'none' }}>
            Archive
          </Link>
        </div>

        {todos.length === 0 ? <p className={styles.muted}>No todos.</p> : null}

        {todos.map((t) => (
          <div key={t.id} className={styles.todoRow}>
            <input
              type="checkbox"
              onChange={() => {
                appStore.actions.completeTodo(t.id)
              }}
              aria-label={`Complete todo: ${t.text}`}
            />
            <span className={styles.todoText} title={t.text}>
              {t.text}
            </span>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => appStore.actions.deleteTodo(t.id)}
              aria-label={`Delete todo: ${t.text}`}
            >
              Delete
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}

export default DailyPage
