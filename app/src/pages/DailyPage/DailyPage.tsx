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

  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const isPriorityEdit = state.uiState.dailyLeftMode === 'priorityEdit'
  const isReorderMode = state.uiState.dailyLeftMode === 'reorder'
  const isDeleteMode = state.uiState.dailyLeftMode === 'delete'

  function flushPendingPriorityChanges() {
    if (pendingPriorityChangedRef.current.size === 0) return
    for (const habitId of pendingPriorityChangedRef.current) {
      appStore.actions.repositionHabitAfterPriorityChange(habitId)
    }
    pendingPriorityChangedRef.current.clear()
  }

  function setLeftMode(next: 'normal' | 'reorder' | 'delete' | 'priorityEdit') {
    if (isPriorityEdit && next !== 'priorityEdit') {
      flushPendingPriorityChanges()
    }
    appStore.actions.setDailyLeftMode(next)
  }

  function reorderIds<T extends string>(ids: T[], idToMove: T, targetIndex: number): T[] {
    const currentIndex = ids.indexOf(idToMove)
    if (currentIndex === -1) return ids

    const next = ids.slice()
    next.splice(currentIndex, 1)
    const clamped = Math.max(0, Math.min(targetIndex, next.length))
    next.splice(clamped, 0, idToMove)
    return next
  }

  function parseDragPayload(payload: string):
    | { kind: 'category'; categoryId: string }
    | { kind: 'habit'; habitId: string; fromCategoryId: string }
    | null {
    try {
      const parsed = JSON.parse(payload) as unknown
      if (!parsed || typeof parsed !== 'object') return null
      const obj = parsed as any
      if (obj.kind === 'category' && typeof obj.categoryId === 'string') {
        return { kind: 'category', categoryId: obj.categoryId }
      }
      if (
        obj.kind === 'habit' &&
        typeof obj.habitId === 'string' &&
        typeof obj.fromCategoryId === 'string'
      ) {
        return { kind: 'habit', habitId: obj.habitId, fromCategoryId: obj.fromCategoryId }
      }
      return null
    } catch {
      return null
    }
  }

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
      flushPendingPriorityChanges()
      if (appStore.getState().uiState.dailyLeftMode === 'priorityEdit') {
        appStore.actions.setDailyLeftMode('normal')
      }

      activeDateRef.current = next
    }
  }, [state.uiState.selectedDate])

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

          <button
            type="button"
            className={`${styles.smallBtn} ${state.uiState.dailyLeftMode === 'normal' ? styles.smallBtnActive : ''}`}
            onClick={() => setLeftMode('normal')}
            title="Normal mode"
          >
            Normal
          </button>
          <button
            type="button"
            className={`${styles.smallBtn} ${isReorderMode ? styles.smallBtnActive : ''}`}
            onClick={() => setLeftMode(isReorderMode ? 'normal' : 'reorder')}
            title="Reorder mode"
          >
            Reorder
          </button>
          <button
            type="button"
            className={`${styles.smallBtn} ${isDeleteMode ? styles.smallBtnActive : ''}`}
            onClick={() => setLeftMode(isDeleteMode ? 'normal' : 'delete')}
            title="Delete mode"
          >
            Delete
          </button>

          {isPriorityEdit ? (
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => setLeftMode('normal')}
              title="Exit priority edit mode"
            >
              X
            </button>
          ) : (
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => setLeftMode('priorityEdit')}
              title="Enter priority edit mode"
              disabled={isDeleteMode || isReorderMode}
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
            disabled={isDeleteMode || isReorderMode || isPriorityEdit}
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
            <div
              key={cat.id}
              className={`${styles.category} ${isReorderMode ? styles.dropZone : ''} ${dragOverKey === `cat:${cat.id}` ? styles.dropZoneActive : ''}`}
              draggable={isReorderMode}
              onDragStart={(e) => {
                if (!isReorderMode) return
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'category', categoryId: cat.id }))
              }}
              onDragOver={(e) => {
                if (!isReorderMode) return
                e.preventDefault()
                setDragOverKey(`cat:${cat.id}`)
              }}
              onDragLeave={() => {
                if (!isReorderMode) return
                setDragOverKey((k) => (k === `cat:${cat.id}` ? null : k))
              }}
              onDrop={(e) => {
                if (!isReorderMode) return
                e.preventDefault()
                setDragOverKey(null)
                const payload = parseDragPayload(e.dataTransfer.getData('text/plain'))
                if (!payload) return

                if (payload.kind === 'category') {
                  const ordered = categories.map((c) => c.id)
                  const fromIndex = ordered.indexOf(payload.categoryId)
                  const toIndex = ordered.indexOf(cat.id)
                  if (fromIndex === -1 || toIndex === -1 || payload.categoryId === cat.id) return

                  // Move dragged category before the drop target.
                  const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex
                  const next = reorderIds(ordered, payload.categoryId, adjustedTo)
                  appStore.actions.reorderCategories(next)
                  return
                }

                if (payload.kind === 'habit') {
                  // Drop habit onto category = move to end.
                  appStore.actions.moveHabit(payload.habitId, cat.id)
                }
              }}
            >
              <div className={styles.categoryHeader}>
                <h3 className={styles.categoryName}>{cat.name}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isReorderMode ? <span className={styles.dragHandle} title="Drag to reorder">⠿</span> : null}

                  {isDeleteMode ? (
                    <button
                      type="button"
                      className={`${styles.smallBtn} ${styles.dangerBtn}`}
                      onClick={() => {
                        const ok = window.confirm(`Delete category "${cat.name}" and all its habits?`)
                        if (!ok) return
                        appStore.actions.deleteCategory(cat.id)
                      }}
                      aria-label={`Delete category: ${cat.name}`}
                    >
                      🗑
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.smallBtn}
                      onClick={() => {
                        const habitName = window.prompt('Habit name?', 'Ieradums')
                        if (!habitName) return
                        appStore.actions.addHabit(cat.id, habitName, 1)
                      }}
                      disabled={isReorderMode || isPriorityEdit || isDeleteMode}
                    >
                      + Habit
                    </button>
                  )}
                </div>
              </div>

              {habits.length === 0 ? <p className={styles.muted}>No habits.</p> : null}

              {habits.map((h) => (
                <div
                  key={h.id}
                  className={`${styles.habitRow} ${isReorderMode ? styles.dropZone : ''} ${dragOverKey === `habit:${h.id}` ? styles.dropZoneActive : ''}`}
                  draggable={isReorderMode}
                  onDragStart={(e) => {
                    if (!isReorderMode) return
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData(
                      'text/plain',
                      JSON.stringify({ kind: 'habit', habitId: h.id, fromCategoryId: cat.id }),
                    )
                  }}
                  onDragOver={(e) => {
                    if (!isReorderMode) return
                    e.preventDefault()
                    setDragOverKey(`habit:${h.id}`)
                  }}
                  onDragLeave={() => {
                    if (!isReorderMode) return
                    setDragOverKey((k) => (k === `habit:${h.id}` ? null : k))
                  }}
                  onDrop={(e) => {
                    if (!isReorderMode) return
                    e.preventDefault()
                    setDragOverKey(null)

                    const payload = parseDragPayload(e.dataTransfer.getData('text/plain'))
                    if (!payload || payload.kind !== 'habit') return

                    const targetHabits = habitsByCategory.get(cat.id) ?? []
                    const ordered = targetHabits.map((hh) => hh.id)
                    const targetIndex = ordered.indexOf(h.id)
                    if (targetIndex === -1) return

                    if (payload.fromCategoryId === cat.id) {
                      // Reorder within the same category.
                      const next = reorderIds(ordered, payload.habitId, targetIndex)
                      appStore.actions.reorderHabits(cat.id, next)
                    } else {
                      // Move across categories at target index.
                      appStore.actions.moveHabit(payload.habitId, cat.id, targetIndex)
                    }
                  }}
                >
                  <span className={styles.habitName} title={h.name}>
                    {h.name}
                  </span>

                  {isDeleteMode ? (
                    <button
                      type="button"
                      className={`${styles.smallBtn} ${styles.dangerBtn}`}
                      onClick={() => {
                        const ok = window.confirm(`Delete habit "${h.name}"? This removes all its scores.`)
                        if (!ok) return
                        appStore.actions.deleteHabit(h.id)
                      }}
                      aria-label={`Delete habit: ${h.name}`}
                    >
                      🗑
                    </button>
                  ) : isPriorityEdit ? (
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
