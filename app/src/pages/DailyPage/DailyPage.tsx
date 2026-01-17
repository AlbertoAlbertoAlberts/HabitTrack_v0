import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import DebugPanel from '../../components/debug/DebugPanel'
import { Dialog, DialogBody, DialogFooter, dialogStyles } from '../../components/ui/Dialog'
import { HabitGroupCard } from './components/HabitGroupCard'
import { LeftNavButtons } from './components/LeftNavButtons'
import { LeftPanelMenu } from './components/LeftPanelMenu'
import { LeftPanelCategoriesList } from './components/LeftPanelCategoriesList'
import { WeekPanel } from './components/WeekPanel'
import { RightTodosPanel } from './components/RightTodosPanel'
import { useDailyData } from './hooks/useDailyData'
import { appStore } from '../../domain/store/appStore'
import { useAppState } from '../../domain/store/useAppStore'
import { addDays } from '../../domain/utils/localDate'
import { getWeeklyTaskTargetPerWeekForWeekStart } from '../../domain/utils/weeklyTaskTarget'
import { exportBackupJson, importBackupJson } from '../../persistence/storageService'

import sharedStyles from '../../components/ui/shared.module.css'
import styles from './DailyPage.module.css'

export function DailyPage() {
  const state = useAppState()
  const activeDateRef = useRef(state.uiState.selectedDate)
  const [newTodoText, setNewTodoText] = useState('')
  const [addTodoOpen, setAddTodoOpen] = useState(false)
  const [todoDragOverId, setTodoDragOverId] = useState<string | null>(null)
  const pendingPriorityChangedRef = useRef<Set<string>>(new Set())

  const leftMenuRef = useRef<HTMLDetailsElement | null>(null)
  const todoMenuRef = useRef<HTMLDetailsElement | null>(null)

  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [addCategoryName, setAddCategoryName] = useState('')

  const [addHabitOpen, setAddHabitOpen] = useState(false)
  const [addHabitName, setAddHabitName] = useState('')
  const [addHabitCategoryId, setAddHabitCategoryId] = useState('')
  const [addHabitPriority, setAddHabitPriority] = useState<1 | 2 | 3>(1)

  const [addWeeklyTaskOpen, setAddWeeklyTaskOpen] = useState(false)
  const [addWeeklyTaskName, setAddWeeklyTaskName] = useState('')
  const [addWeeklyTaskTarget, setAddWeeklyTaskTarget] = useState(2)

  const [weeklyMode, setWeeklyMode] = useState<'normal' | 'reorder' | 'delete' | 'rename'>('normal')
  const [weeklyDragOverId, setWeeklyDragOverId] = useState<string | null>(null)

  const [renameTarget, setRenameTarget] = useState<
    | null
    | {
        kind: 'category' | 'habit' | 'weeklyTask' | 'todo'
        id: string
        name: string
      }
  >(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameHabitCategoryId, setRenameHabitCategoryId] = useState('')
  const [renameWeeklyTarget, setRenameWeeklyTarget] = useState(2)

  const [pendingImport, setPendingImport] = useState<{ filename: string; text: string } | null>(null)
  const [message, setMessage] = useState<
    { title: string; body: string; reloadOnClose?: boolean } | null
  >(null)

  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<
    | null
    | {
        id: string
        name: string
        anchor: { left: number; top: number; right: number; bottom: number }
      }
  >(null)
  const categoryDeletePopoverRef = useRef<HTMLDivElement | null>(null)

  function closeLeftMenu() {
    if (!leftMenuRef.current) return
    leftMenuRef.current.open = false
  }

  function closeWeeklyMenu() {
    // No-op: WeekPanel manages its own menu ref
  }

  function closeTodoMenu() {
    if (!todoMenuRef.current) return
    todoMenuRef.current.open = false
  }

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const menu = leftMenuRef.current
      if (!menu || !menu.open) return
      const target = e.target as Node | null
      if (!target) return
      if (menu.contains(target)) return
      menu.open = false
    }

    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const menu = todoMenuRef.current
      if (!menu || !menu.open) return
      const target = e.target as Node | null
      if (!target) return
      if (menu.contains(target)) return
      menu.open = false
    }

    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  useEffect(() => {
    if (!pendingCategoryDelete) return

    const onPointerDown = (e: PointerEvent) => {
      const popover = categoryDeletePopoverRef.current
      const target = e.target as Node | null
      if (!popover || !target) {
        setPendingCategoryDelete(null)
        return
      }
      if (popover.contains(target)) return
      setPendingCategoryDelete(null)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingCategoryDelete(null)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pendingCategoryDelete])

  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const isPriorityEdit = state.uiState.dailyLeftMode === 'priorityEdit'
  const isReorderMode = state.uiState.dailyLeftMode === 'reorder'
  const isDeleteMode = state.uiState.dailyLeftMode === 'delete'
  const isRenameMode = state.uiState.dailyLeftMode === 'rename'

  const todoMode = state.uiState.todoMode

  function isPlainEnter(e: React.KeyboardEvent): boolean {
    if (e.key !== 'Enter') return false
    if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return false
    // Avoid IME composition submits.
    if ((e.nativeEvent as KeyboardEvent).isComposing) return false
    return true
  }

  function flushPendingPriorityChanges() {
    if (pendingPriorityChangedRef.current.size === 0) return
    for (const habitId of pendingPriorityChangedRef.current) {
      appStore.actions.repositionHabitAfterPriorityChange(habitId)
    }
    pendingPriorityChangedRef.current.clear()
  }

  function setLeftMode(next: 'normal' | 'reorder' | 'delete' | 'priorityEdit' | 'rename') {
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

  const {
    today,
    selectedDate,
    locked,
    currentWeekStart,
    formatDateLabel,
    categories,
    habitsByCategory,
    scoresForSelectedDate,
    habitsByPriority,
    todos,
    weeklyTasks,
    weekStartDate,
    weekEndDate,
  } = useDailyData(state)

  function downloadTextFile(filename: string, text: string) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const categoryDeletePopoverStyle = useMemo((): React.CSSProperties => {
    if (!pendingCategoryDelete) return {}
    const width = 300
    const approxHeight = 120
    const margin = 8
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800

    let left = pendingCategoryDelete.anchor.right + 10
    let top = pendingCategoryDelete.anchor.top - 6

    if (left + width > vw - margin) {
      left = pendingCategoryDelete.anchor.left - width - 10
    }
    left = Math.max(margin, Math.min(left, vw - width - margin))

    if (top + approxHeight > vh - margin) {
      top = vh - approxHeight - margin
    }
    top = Math.max(margin, top)

    return { left, top, width }
  }, [pendingCategoryDelete])

  return (
    <div className={sharedStyles.page}>
      <section className={`${styles.panel} ${styles.leftPanel}`}>
        <LeftNavButtons
          activeMode={state.uiState.dailyViewMode}
          onModeChange={(mode) => appStore.actions.setDailyViewMode(mode)}
        />

        <div className={`${styles.panelHeaderRow} ${styles.leftHeaderRow}`}>
          <h2 className={styles.panelTitle}>Izaicinājumi</h2>

          <div className={styles.panelHeaderActions}>
            {isReorderMode || isDeleteMode || isPriorityEdit || isRenameMode ? (
              <button
                type="button"
                className={styles.exitModeBtn}
                aria-label="Iziet no režīma"
                title="Iziet"
                onClick={() => {
                  closeLeftMenu()
                  setLeftMode('normal')
                }}
              >
                ✕
              </button>
            ) : null}

            <LeftPanelMenu
              ref={leftMenuRef}
              isReorderMode={isReorderMode}
              isDeleteMode={isDeleteMode}
              isPriorityEdit={isPriorityEdit}
              isRenameMode={isRenameMode}
              onToggleReorder={() => {
                setLeftMode(isReorderMode ? 'normal' : 'reorder')
              }}
              onToggleDelete={() => {
                setLeftMode(isDeleteMode ? 'normal' : 'delete')
              }}
              onTogglePriorityEdit={() => {
                setLeftMode(isPriorityEdit ? 'normal' : 'priorityEdit')
              }}
              onToggleRename={() => {
                setLeftMode(isRenameMode ? 'normal' : 'rename')
              }}
              onAddHabit={() => {
                if (categories.length === 0) {
                  setMessage({ title: 'Nav kategoriju', body: 'Vispirms izveido kategoriju.' })
                  return
                }

                setAddHabitName('')
                setAddHabitCategoryId(categories[0]?.id ?? '')
                setAddHabitPriority(1)
                setAddHabitOpen(true)
              }}
              onAddCategory={() => {
                setAddCategoryName('')
                setAddCategoryOpen(true)
              }}
              onExport={() => {
                const json = exportBackupJson(appStore.getState())
                const date = new Date().toISOString().slice(0, 10)
                downloadTextFile(`habittrack-backup-${date}.json`, json)
              }}
              onImportFile={async (file: File) => {
                const text = await file.text()
                setPendingImport({ filename: file.name, text })
              }}
              onClose={closeLeftMenu}
            />
          </div>
        </div>

        <LeftPanelCategoriesList
          categories={categories}
          habitsByCategory={habitsByCategory}
          isReorderMode={isReorderMode}
          isDeleteMode={isDeleteMode}
          isPriorityEdit={isPriorityEdit}
          isRenameMode={isRenameMode}
          dragOverKey={dragOverKey}
          onAddCategoryClick={() => {
            setAddCategoryName('')
            setAddCategoryOpen(true)
          }}
          onSetDragOverKey={(key) => {
            setDragOverKey((k) => (key === null && k !== null ? null : key))
          }}
          onCategoryDragStart={() => {
            // No-op for now
          }}
          onCategoryDrop={(categoryId, payload) => {
            if (payload.kind === 'category' && payload.categoryId) {
              const ordered = categories.map((c) => c.id)
              const fromIndex = ordered.indexOf(payload.categoryId)
              const toIndex = ordered.indexOf(categoryId)
              if (fromIndex === -1 || toIndex === -1 || payload.categoryId === categoryId) return

              // Move dragged category before the drop target.
              const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex
              const next = reorderIds(ordered, payload.categoryId, adjustedTo)
              appStore.actions.reorderCategories(next)
              return
            }

            if (payload.kind === 'habit' && payload.habitId) {
              // Drop habit onto category = move to end.
              appStore.actions.moveHabit(payload.habitId, categoryId)
            }
          }}
          onHabitDragStart={() => {
            // No-op for now
          }}
          onHabitDrop={(habitId, categoryId, payload) => {
            if (payload.kind !== 'habit' || !payload.habitId || !payload.fromCategoryId) return

            const targetHabits = habitsByCategory.get(categoryId) ?? []
            const ordered = targetHabits.map((hh) => hh.id)
            const targetIndex = ordered.indexOf(habitId)
            if (targetIndex === -1) return

            if (payload.fromCategoryId === categoryId) {
              // Reorder within the same category.
              const next = reorderIds(ordered, payload.habitId, targetIndex)
              appStore.actions.reorderHabits(categoryId, next)
            } else {
              // Move across categories at target index.
              appStore.actions.moveHabit(payload.habitId, categoryId, targetIndex)
            }
          }}
          onCategoryEditClick={(id, name) => {
            setRenameTarget({ kind: 'category', id, name })
            setRenameValue(name)
          }}
          onCategoryDeleteClick={(id, name, anchor) => {
            setPendingCategoryDelete({ id, name, anchor })
          }}
          onHabitEditClick={(id, name, categoryId) => {
            setRenameTarget({ kind: 'habit', id, name })
            setRenameValue(name)
            setRenameHabitCategoryId(categoryId)
          }}
          onHabitDeleteClick={(id) => {
            appStore.actions.deleteHabit(id)
          }}
          onHabitPriorityChange={(id, delta, currentPriority) => {
            const next = Math.max(1, Math.min(3, currentPriority + delta)) as 1 | 2 | 3
            appStore.actions.setHabitPriorityValue(id, next)
            pendingPriorityChangedRef.current.add(id)
          }}
        />

        <Dialog open={addCategoryOpen} title="Jauna kategorija" onClose={() => setAddCategoryOpen(false)}>
          <div
            onKeyDown={(e) => {
              if (!isPlainEnter(e)) return
              const target = e.target
              if (!(target instanceof HTMLInputElement)) return
              e.preventDefault()
              const name = addCategoryName.trim()
              if (!name) return
              appStore.actions.addCategory(name)
              setAddCategoryOpen(false)
            }}
          >
            <DialogBody>
              <div className={dialogStyles.row}>
                <label className={dialogStyles.label}>
                  Nosaukums
                  <input
                    className={dialogStyles.input}
                    value={addCategoryName}
                    onChange={(e) => setAddCategoryName(e.target.value)}
                    autoFocus
                  />
                </label>
                <div className={dialogStyles.hint}>Kategorijas palīdz grupēt ieradumus.</div>
              </div>
            </DialogBody>
            <DialogFooter>
              <button type="button" className={dialogStyles.btn} onClick={() => setAddCategoryOpen(false)}>
                Atcelt
              </button>
              <button
                type="button"
                className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
                onClick={() => {
                  const name = addCategoryName.trim()
                  if (!name) return
                  appStore.actions.addCategory(name)
                  setAddCategoryOpen(false)
                }}
              >
                Saglabāt
              </button>
            </DialogFooter>
          </div>
        </Dialog>

        <Dialog open={addHabitOpen} title="+ Ieradumu" onClose={() => setAddHabitOpen(false)}>
          <div
            onKeyDown={(e) => {
              if (!isPlainEnter(e)) return
              const target = e.target
              if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
              e.preventDefault()
              const name = addHabitName.trim()
              if (!name) return
              if (!addHabitCategoryId) return
              appStore.actions.addHabit(addHabitCategoryId, name, addHabitPriority)
              setAddHabitOpen(false)
            }}
          >
            <DialogBody>
              <div className={dialogStyles.row}>
                <label className={dialogStyles.label}>
                  Ieraduma nosaukums
                  <input
                    className={dialogStyles.input}
                    value={addHabitName}
                    onChange={(e) => setAddHabitName(e.target.value)}
                    autoFocus
                  />
                </label>
              </div>

              <div className={dialogStyles.row}>
                <label className={dialogStyles.label}>
                  Kategorija
                  <select
                    className={dialogStyles.input}
                    value={addHabitCategoryId}
                    onChange={(e) => setAddHabitCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={dialogStyles.row}>
                <label className={dialogStyles.label}>
                  Prioritāte
                  <div className={styles.priorityStepper} style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className={sharedStyles.smallBtn}
                      onClick={() => setAddHabitPriority((p) => (Math.max(1, p - 1) as 1 | 2 | 3))}
                      disabled={addHabitPriority === 1}
                      aria-label="Samazināt prioritāti"
                    >
                      &lt;
                    </button>
                    <span className={styles.muted}>{addHabitPriority}</span>
                    <button
                      type="button"
                      className={sharedStyles.smallBtn}
                      onClick={() => setAddHabitPriority((p) => (Math.min(3, p + 1) as 1 | 2 | 3))}
                      disabled={addHabitPriority === 3}
                      aria-label="Palielināt prioritāti"
                    >
                      &gt;
                    </button>
                  </div>
                </label>
              </div>
            </DialogBody>
            <DialogFooter>
              <button type="button" className={dialogStyles.btn} onClick={() => setAddHabitOpen(false)}>
                Atcelt
              </button>
              <button
                type="button"
                className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
                onClick={() => {
                  const name = addHabitName.trim()
                  if (!name) return
                  if (!addHabitCategoryId) return
                  appStore.actions.addHabit(addHabitCategoryId, name, addHabitPriority)
                  setAddHabitOpen(false)
                }}
              >
                Pievienot
              </button>
            </DialogFooter>
          </div>
        </Dialog>

        <Dialog
          open={addWeeklyTaskOpen}
          title="Jauns nedēļas uzdevums"
          onClose={() => setAddWeeklyTaskOpen(false)}
        >
          <div
            onKeyDown={(e) => {
              if (!isPlainEnter(e)) return
              const target = e.target
              if (!(target instanceof HTMLInputElement)) return
              e.preventDefault()
              const name = addWeeklyTaskName.trim()
              if (!name) return
              appStore.actions.addWeeklyTask(name, addWeeklyTaskTarget)
              setAddWeeklyTaskOpen(false)
              setAddWeeklyTaskName('')
            }}
          >
            <DialogBody>
              <div className={dialogStyles.row}>
                <label className={dialogStyles.label}>
                  Nosaukums
                  <input
                    className={dialogStyles.input}
                    value={addWeeklyTaskName}
                    onChange={(e) => setAddWeeklyTaskName(e.target.value)}
                    autoFocus
                  />
                </label>
              </div>

              <div className={dialogStyles.row}>
                <label className={dialogStyles.label}>
                  Mērķis nedēļā
                  <div className={styles.priorityStepper} style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className={sharedStyles.smallBtn}
                      onClick={() => setAddWeeklyTaskTarget((n) => Math.max(1, n - 1))}
                      disabled={addWeeklyTaskTarget <= 1}
                      aria-label="Samazināt mērķi"
                    >
                      &lt;
                    </button>
                    <span className={styles.muted}>{addWeeklyTaskTarget}</span>
                    <button
                      type="button"
                      className={sharedStyles.smallBtn}
                      onClick={() => setAddWeeklyTaskTarget((n) => Math.min(16, n + 1))}
                      disabled={addWeeklyTaskTarget >= 16}
                      aria-label="Palielināt mērķi"
                    >
                      &gt;
                    </button>
                  </div>
                </label>
              </div>
            </DialogBody>
            <DialogFooter>
              <button
                type="button"
                className={dialogStyles.btn}
                onClick={() => {
                  setAddWeeklyTaskOpen(false)
                  setAddWeeklyTaskName('')
                }}
              >
                Atcelt
              </button>
              <button
                type="button"
                className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
                onClick={() => {
                  const name = addWeeklyTaskName.trim()
                  if (!name) return
                  appStore.actions.addWeeklyTask(name, addWeeklyTaskTarget)
                  setAddWeeklyTaskOpen(false)
                  setAddWeeklyTaskName('')
                }}
              >
                Pievienot
              </button>
            </DialogFooter>
          </div>
        </Dialog>

        <Dialog
          open={renameTarget !== null}
          title={
            renameTarget?.kind === 'habit'
              ? 'Rediģēt paradumu'
              : renameTarget?.kind === 'category'
                ? 'Rediģēt kategoriju'
                : 'Rediģēt'
          }
          onClose={() => {
            setRenameTarget(null)
            setRenameValue('')
            setRenameHabitCategoryId('')
            setRenameWeeklyTarget(2)
          }}
        >
          <div
            onKeyDown={(e) => {
              if (!isPlainEnter(e)) return
              const target = e.target
              if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
              e.preventDefault()
              if (!renameTarget) return
              const next = renameValue.trim()
              if (!next) return

              if (renameTarget.kind === 'category') {
                appStore.actions.renameCategory(renameTarget.id, next)
              } else if (renameTarget.kind === 'habit') {
                appStore.actions.renameHabit(renameTarget.id, next)

                const current = state.habits[renameTarget.id]
                if (current && renameHabitCategoryId && renameHabitCategoryId !== current.categoryId) {
                  appStore.actions.moveHabit(renameTarget.id, renameHabitCategoryId)
                }
              } else if (renameTarget.kind === 'todo') {
                appStore.actions.renameTodo(renameTarget.id, next)
              } else {
                appStore.actions.renameWeeklyTask(renameTarget.id, next)
                appStore.actions.setWeeklyTaskTargetPerWeek(renameTarget.id, renameWeeklyTarget)
              }

              setRenameTarget(null)
              setRenameValue('')
              setRenameHabitCategoryId('')
              setRenameWeeklyTarget(2)
            }}
          >
            <DialogBody>
              {renameTarget?.kind === 'habit' ? (
                <div className={dialogStyles.row}>
                  <label className={dialogStyles.label}>
                    Kategorija
                    <select
                      className={dialogStyles.input}
                      value={renameHabitCategoryId}
                      onChange={(e) => setRenameHabitCategoryId(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <div className={dialogStyles.row}>
                <label className={dialogStyles.label}>
                  Nosaukums
                  <input
                    className={dialogStyles.input}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                  />
                </label>
              </div>

              {renameTarget?.kind === 'weeklyTask' ? (
                <div className={dialogStyles.row}>
                  <label className={dialogStyles.label}>
                    Mērķis nedēļā
                    <div className={styles.priorityStepper} style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className={sharedStyles.smallBtn}
                        onClick={() => setRenameWeeklyTarget((n) => Math.max(1, n - 1))}
                        disabled={renameWeeklyTarget <= 1}
                        aria-label="Samazināt mērķi"
                      >
                        &lt;
                      </button>
                      <span className={styles.muted}>{renameWeeklyTarget}</span>
                      <button
                        type="button"
                        className={sharedStyles.smallBtn}
                        onClick={() => setRenameWeeklyTarget((n) => Math.min(7, n + 1))}
                        disabled={renameWeeklyTarget >= 7}
                        aria-label="Palielināt mērķi"
                      >
                        &gt;
                      </button>
                    </div>
                  </label>
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <button
                type="button"
                className={dialogStyles.btn}
                onClick={() => {
                  setRenameTarget(null)
                  setRenameValue('')
                  setRenameHabitCategoryId('')
                }}
              >
                Atcelt
              </button>
              <button
                type="button"
                className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
                onClick={() => {
                  if (!renameTarget) return
                  const next = renameValue.trim()
                  if (!next) return

                  if (renameTarget.kind === 'category') {
                    appStore.actions.renameCategory(renameTarget.id, next)
                  } else if (renameTarget.kind === 'habit') {
                    appStore.actions.renameHabit(renameTarget.id, next)

                    const current = state.habits[renameTarget.id]
                    if (current && renameHabitCategoryId && renameHabitCategoryId !== current.categoryId) {
                      appStore.actions.moveHabit(renameTarget.id, renameHabitCategoryId)
                    }
                  } else if (renameTarget.kind === 'todo') {
                    appStore.actions.renameTodo(renameTarget.id, next)
                  } else {
                    appStore.actions.renameWeeklyTask(renameTarget.id, next)
                    appStore.actions.setWeeklyTaskTargetPerWeek(renameTarget.id, renameWeeklyTarget)
                  }

                  setRenameTarget(null)
                  setRenameValue('')
                  setRenameHabitCategoryId('')
                  setRenameWeeklyTarget(2)
                }}
              >
                Saglabāt
              </button>
            </DialogFooter>
          </div>
        </Dialog>

        <Dialog
          open={addTodoOpen}
          title="Pievienot uzdevumu"
          onClose={() => {
            setAddTodoOpen(false)
            setNewTodoText('')
          }}
        >
          <div
            onKeyDown={(e) => {
              if (!isPlainEnter(e)) return
              const target = e.target
              if (!(target instanceof HTMLInputElement)) return
              e.preventDefault()

              const text = newTodoText.trim()
              if (!text) return
              appStore.actions.addTodo(text)
              setAddTodoOpen(false)
              setNewTodoText('')
            }}
          >
            <DialogBody>
              <div className={dialogStyles.row}>
                <label className={dialogStyles.label}>
                  Uzdevums
                  <input
                    className={dialogStyles.input}
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    autoFocus
                  />
                </label>
              </div>
            </DialogBody>
            <DialogFooter>
              <button
                type="button"
                className={dialogStyles.btn}
                onClick={() => {
                  setAddTodoOpen(false)
                  setNewTodoText('')
                }}
              >
                Atcelt
              </button>
              <button
                type="button"
                className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
                onClick={() => {
                  const text = newTodoText.trim()
                  if (!text) return
                  appStore.actions.addTodo(text)
                  setAddTodoOpen(false)
                  setNewTodoText('')
                }}
              >
                Pievienot
              </button>
            </DialogFooter>
          </div>
        </Dialog>

        <Dialog open={pendingImport !== null} title="Importēt datus" onClose={() => setPendingImport(null)}>
          <DialogBody>
            <div className={dialogStyles.hint}>
              Rezerves kopija: <strong>{pendingImport?.filename ?? ''}</strong>
            </div>
            <div className={dialogStyles.hint}>Importēšana pārrakstīs pašreizējos datus šajā pārlūkā.</div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className={dialogStyles.btn} onClick={() => setPendingImport(null)}>
              Atcelt
            </button>
            <button
              type="button"
              className={`${dialogStyles.btn} ${dialogStyles.btnDanger}`}
              onClick={() => {
                if (!pendingImport) return
                const result = importBackupJson(pendingImport.text)
                if (!result.ok) {
                  setPendingImport(null)
                  setMessage({ title: 'Importa kļūda', body: result.error })
                  return
                }
                setPendingImport(null)
                setMessage({
                  title: 'Dati importēti',
                  body: 'Lapa tiks pārlādēta, lai piemērotu izmaiņas.',
                  reloadOnClose: true,
                })
              }}
            >
              Importēt
            </button>
          </DialogFooter>
        </Dialog>

        <Dialog
          open={message !== null}
          title={message?.title ?? ''}
          onClose={() => {
            const shouldReload = message?.reloadOnClose
            setMessage(null)
            if (shouldReload) window.location.reload()
          }}
        >
          <DialogBody>
            <div className={dialogStyles.hint}>{message?.body ?? ''}</div>
          </DialogBody>
          <DialogFooter>
            <button
              type="button"
              className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
              onClick={() => {
                const shouldReload = message?.reloadOnClose
                setMessage(null)
                if (shouldReload) window.location.reload()
              }}
            >
              Labi
            </button>
          </DialogFooter>
        </Dialog>

        {pendingCategoryDelete && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={categoryDeletePopoverRef}
                className={styles.deletePopover}
                style={categoryDeletePopoverStyle}
                role="dialog"
                aria-label="Dzēst kategoriju"
              >
                <div className={styles.deletePopoverText}>
                  Dzēst kategoriju <strong>{pendingCategoryDelete.name}</strong> un visus tās ieradumus?
                </div>
                <div className={styles.deletePopoverActions}>
                  <button
                    type="button"
                    className={styles.deletePopoverBtn}
                    onClick={() => setPendingCategoryDelete(null)}
                  >
                    Atcelt
                  </button>
                  <button
                    type="button"
                    className={`${styles.deletePopoverBtn} ${styles.deletePopoverBtnDanger}`}
                    onClick={() => {
                      appStore.actions.deleteCategory(pendingCategoryDelete.id)
                      setPendingCategoryDelete(null)
                    }}
                  >
                    Dzēst
                  </button>
                </div>
              </div>,
              document.body,
            )
          : null}
      </section>

      <section className={`${styles.panel} ${styles.dailyPanel}`}>
        <div className={styles.dailyTopBarSingle}>
          <div className={styles.dateNav}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Iepriekšējā diena"
              onClick={() => {
                appStore.actions.commitIfNeeded(selectedDate)
                appStore.actions.setSelectedDate(addDays(selectedDate, -1))
              }}
            >
              ‹
            </button>

            <div className={styles.dateLabel}>
              <span>{formatDateLabel(selectedDate)}</span>
            </div>

            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Nākamā diena"
              disabled={today}
              title={today ? 'Nav pieejams, skatoties šodienu' : undefined}
              onClick={() => {
                appStore.actions.commitIfNeeded(selectedDate)
                appStore.actions.setSelectedDate(addDays(selectedDate, +1))
              }}
            >
              ›
            </button>
          </div>
        </div>

          <div className={styles.dailyContentGrid}>
            <div className={styles.dailyMainCol}>
              <div className={styles.scrollArea}>
                {state.uiState.dailyViewMode === 'category'
                  ? categories.map((cat) => {
                      const habits = habitsByCategory.get(cat.id) ?? []
                      if (habits.length === 0) return null

                      return (
                        <HabitGroupCard
                          key={cat.id}
                          type="category"
                          title={cat.name}
                          habits={habits}
                          selectedDate={selectedDate}
                          scoresForSelectedDate={scoresForSelectedDate}
                          locked={locked}
                          onScoreChange={(habitId, score) => appStore.actions.setScore(selectedDate, habitId, score)}
                        />
                      )
                    })
                  : ([1, 2, 3] as const).map((p) => {
                      const habits = habitsByPriority[p]
                      if (habits.length === 0) return null

                      return (
                        <HabitGroupCard
                          key={p}
                          type="priority"
                          title={`Prioritāte ${p}`}
                          habits={habits}
                          selectedDate={selectedDate}
                          scoresForSelectedDate={scoresForSelectedDate}
                          locked={locked}
                          onScoreChange={(habitId, score) => appStore.actions.setScore(selectedDate, habitId, score)}
                        />
                      )
                    })}

                {categories.length > 0 && Object.keys(state.habits).length === 0 ? (
                  <p className={styles.muted}>Pievieno ieradumu, lai sāktu vērtēt.</p>
                ) : null}

                <details style={{ marginTop: 16 }}>
                  <summary className={styles.muted}>Debug</summary>
                  <DebugPanel />
                </details>
              </div>
            </div>

            <WeekPanel
              weekStartDate={weekStartDate}
              weekEndDate={weekEndDate}
              selectedDate={selectedDate}
              currentWeekStart={currentWeekStart}
              weeklyTasks={weeklyTasks}
              weeklyProgress={state.weeklyProgress}
              weeklyMode={weeklyMode}
              weeklyDragOverId={weeklyDragOverId}
              formatDateLabel={formatDateLabel}
              getWeeklyTaskTargetPerWeekForWeekStart={getWeeklyTaskTargetPerWeekForWeekStart}
              onSetWeeklyMode={setWeeklyMode}
              onSetWeeklyDragOverId={setWeeklyDragOverId}
              onAddWeeklyTask={() => {
                setAddWeeklyTaskTarget(2)
                setAddWeeklyTaskName('')
                setAddWeeklyTaskOpen(true)
              }}
              onAdjustWeeklyCompletion={appStore.actions.adjustWeeklyCompletionForDate}
              onRenameWeeklyTask={(taskId, name, targetPerWeek) => {
                setRenameTarget({ kind: 'weeklyTask', id: taskId, name })
                setRenameValue(name)
                setRenameWeeklyTarget(targetPerWeek)
              }}
              onDeleteWeeklyTask={appStore.actions.deleteWeeklyTask}
              onReorderWeeklyTasks={appStore.actions.reorderWeeklyTasks}
              onCloseWeeklyMenu={closeWeeklyMenu}
            />
          </div>
      </section>

      <RightTodosPanel
        todos={todos}
        todoMode={todoMode}
        todoDragOverId={todoDragOverId}
        todoMenuRef={todoMenuRef}
        onSetTodoDragOverId={setTodoDragOverId}
        onSetTodoMode={appStore.actions.setTodoMode}
        onOpenAddTodo={() => setAddTodoOpen(true)}
        onCloseTodoMenu={closeTodoMenu}
        onCompleteTodo={appStore.actions.completeTodo}
        onDeleteTodo={appStore.actions.deleteTodo}
        onReorderTodos={appStore.actions.reorderTodos}
        onBeginRenameTodo={(todoId, currentText) => {
          setRenameTarget({ kind: 'todo', id: todoId, name: currentText })
          setRenameValue(currentText)
        }}
      />
    </div>
  )
}

export default DailyPage
