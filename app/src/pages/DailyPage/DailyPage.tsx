import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

import DebugPanel from '../../components/debug/DebugPanel'
import { Dialog, DialogBody, DialogFooter, dialogStyles } from '../../components/ui/Dialog'
import { WeeklyTaskTile } from '../../components/weekly/WeeklyTaskTile'
import { appStore } from '../../domain/store/appStore'
import { useAppState } from '../../domain/store/useAppStore'
import { addDays, isToday, todayLocalDateString, weekStartMonday } from '../../domain/utils/localDate'
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

  const importFileInputRef = useRef<HTMLInputElement | null>(null)
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
  const weeklyMenuRef = useRef<HTMLDetailsElement | null>(null)

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
    if (!weeklyMenuRef.current) return
    weeklyMenuRef.current.open = false
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
      const menu = weeklyMenuRef.current
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

  function parseDragPayload(payload: string):
    | { kind: 'category'; categoryId: string }
    | { kind: 'habit'; habitId: string; fromCategoryId: string }
    | null {
    try {
      const parsed = JSON.parse(payload) as unknown
      if (!parsed || typeof parsed !== 'object') return null
      const obj = parsed as Record<string, unknown>
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
  const currentWeekStart = useMemo(() => weekStartMonday(todayLocalDateString()), [])

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

  function formatDateLabel(date: string): string {
    // Input is YYYY-MM-DD (local). Display as DD.MM.YYYY.
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date)
    if (!m) return date
    return `${m[3]}.${m[2]}.${m[1]}`
  }

  function FolderIcon({ className }: { className?: string }) {
    return (
      <svg
        className={className}
        width="18"
        height="14"
        viewBox="0 0 18 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1.25 3.25C1.25 2.42157 1.92157 1.75 2.75 1.75H6.55C6.92 1.75 7.275 1.903 7.53 2.172L8.61 3.3H15.25C16.0784 3.3 16.75 3.97157 16.75 4.8V11.25C16.75 12.0784 16.0784 12.75 15.25 12.75H2.75C1.92157 12.75 1.25 12.0784 1.25 11.25V3.25Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    )
  }

  function TargetIcon({ className }: { className?: string }) {
    return (
      <svg
        className={className}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
        <path d="M8 1V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        <path d="M8 13V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        <path d="M1 8H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        <path d="M13 8H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      </svg>
    )
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.habits])

  const categorySortIndexById = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of Object.values(state.categories)) {
      map.set(c.id, c.sortIndex)
    }
    return map
  }, [state.categories])

  const scoresForSelectedDate = state.dailyScores[selectedDate] ?? {}

  const allHabitsSorted = useMemo(
    () =>
      Object.values(state.habits)
        .slice()
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority
          const aCatIndex = categorySortIndexById.get(a.categoryId) ?? 0
          const bCatIndex = categorySortIndexById.get(b.categoryId) ?? 0
          if (aCatIndex !== bCatIndex) return aCatIndex - bCatIndex
          if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId)
          return a.sortIndex - b.sortIndex
        }),
    [state.habits, categorySortIndexById],
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

  const weeklyTasks = useMemo(
    () => Object.values(state.weeklyTasks).slice().sort((a, b) => a.sortIndex - b.sortIndex),
    [state.weeklyTasks],
  )

  const weekStartDate = useMemo(() => weekStartMonday(selectedDate), [selectedDate])
  const weekEndDate = useMemo(() => addDays(weekStartDate, 6), [weekStartDate])

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
        <div className={styles.leftNav}>
          <Link to="/overview" className={`${styles.navBtn} ${styles.navBtnPrimary}`} style={{ textDecoration: 'none' }}>
            PĀRSKATS
          </Link>
          <button
            type="button"
            className={`${styles.navBtn} ${state.uiState.dailyViewMode === 'category' ? styles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setDailyViewMode('category')}
            aria-pressed={state.uiState.dailyViewMode === 'category'}
          >
            KATEGORIJA
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${state.uiState.dailyViewMode === 'priority' ? styles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setDailyViewMode('priority')}
            aria-pressed={state.uiState.dailyViewMode === 'priority'}
          >
            PRIORITĀTE
          </button>
        </div>

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

            <details className={styles.menu} ref={leftMenuRef}>
              <summary className={styles.menuButton} aria-label="Atvērt darbību izvēlni" title="Izvēlne">
                ☰
              </summary>
              <div className={styles.menuPanel}>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  closeLeftMenu()
                  setLeftMode(isReorderMode ? 'normal' : 'reorder')
                }}
              >
                Pārkārtot
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  closeLeftMenu()
                  setLeftMode(isDeleteMode ? 'normal' : 'delete')
                }}
              >
                Dzēst
              </button>

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  closeLeftMenu()
                  setLeftMode(isPriorityEdit ? 'normal' : 'priorityEdit')
                }}
                disabled={!isPriorityEdit && (isDeleteMode || isReorderMode)}
              >
                Rediģēt prioritātes
              </button>

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  closeLeftMenu()
                  setLeftMode(isRenameMode ? 'normal' : 'rename')
                }}
                disabled={!isRenameMode && (isDeleteMode || isReorderMode || isPriorityEdit)}
              >
                Rediģēt paradumus
              </button>

              <hr className={styles.menuDivider} />

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  closeLeftMenu()
                  if (categories.length === 0) {
                    setMessage({ title: 'Nav kategoriju', body: 'Vispirms izveido kategoriju.' })
                    return
                  }

                  setAddHabitName('')
                  setAddHabitCategoryId(categories[0]?.id ?? '')
                  setAddHabitPriority(1)
                  setAddHabitOpen(true)
                }}
              >
                + Ieradumu
              </button>

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  closeLeftMenu()
                  setAddCategoryName('')
                  setAddCategoryOpen(true)
                }}
              >
                + Kategorija
              </button>

              <hr className={styles.menuDivider} />

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  closeLeftMenu()
                  const json = exportBackupJson(appStore.getState())
                  const date = new Date().toISOString().slice(0, 10)
                  downloadTextFile(`habittrack-backup-${date}.json`, json)
                }}
              >
                Eksportēt datus
              </button>

              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  closeLeftMenu()
                  if (!importFileInputRef.current) return
                  importFileInputRef.current.value = ''
                  importFileInputRef.current.click()
                }}
              >
                Importēt datus
              </button>

              <input
                ref={importFileInputRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  const text = await file.text()
                  setPendingImport({ filename: file.name, text })
                }}
              />
              </div>
            </details>
          </div>
        </div>

        <div className={styles.scrollArea}>
          {categories.length === 0 ? (
            <div>
              <p className={styles.muted}>Nav kategoriju.</p>
              <button
                type="button"
                className={sharedStyles.smallBtn}
                onClick={() => {
                  setAddCategoryName('')
                  setAddCategoryOpen(true)
                }}
              >
                Izveidot pirmo kategoriju
              </button>
            </div>
          ) : null}

          {categories.map((cat) => {
            const habits = habitsByCategory.get(cat.id) ?? []
            return (
              <div
                key={cat.id}
                className={`${styles.categoryCard} ${isReorderMode ? styles.dropZone : ''} ${dragOverKey === `cat:${cat.id}` ? styles.dropZoneActive : ''}`}
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
                  <div className={styles.categoryTitleRow}>
                    <FolderIcon className={styles.catIcon} />
                    <h3 className={styles.categoryName}>{cat.name}</h3>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isReorderMode ? <span className={styles.dragHandle} title="Velc, lai pārkārtotu">⠿</span> : null}

                    {isRenameMode ? (
                      <button
                        type="button"
                        className={`${styles.smallBtn} ${styles.editBtn}`}
                        onClick={() => {
                          setRenameTarget({ kind: 'category', id: cat.id, name: cat.name })
                          setRenameValue(cat.name)
                        }}
                        aria-label={`Rediģēt kategorijas nosaukumu: ${cat.name}`}
                      >
                        ✎
                      </button>
                    ) : null}

                    {isDeleteMode ? (
                      <button
                        type="button"
                        className={`${styles.smallBtn} ${styles.trashBtn}`}
                        onClick={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setPendingCategoryDelete({
                            id: cat.id,
                            name: cat.name,
                            anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
                          })
                        }}
                        aria-label={`Dzēst kategoriju: ${cat.name}`}
                      >
                        🗑
                      </button>
                    ) : null}
                  </div>
                </div>

                {habits.length === 0 ? <p className={styles.muted}>Nav ieradumu.</p> : null}

                {habits.map((h) => (
                  <div
                    key={h.id}
                    className={`${styles.habitRowCompact} ${isReorderMode ? styles.dropZone : ''} ${dragOverKey === `habit:${h.id}` ? styles.dropZoneActive : ''}`}
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
                    <div className={`${styles.habitLeft} ${styles.habitLeftIndented}`}>
                      <TargetIcon className={styles.habitIcon} />
                      <span className={styles.habitName} title={h.name}>
                        {h.name}
                      </span>
                    </div>

                    {isDeleteMode ? (
                      <button
                        type="button"
                        className={`${styles.smallBtn} ${styles.trashBtn}`}
                        onClick={() => {
                          appStore.actions.deleteHabit(h.id)
                        }}
                        aria-label={`Dzēst ieradumu: ${h.name}`}
                      >
                        🗑
                      </button>
                    ) : isRenameMode ? (
                      <button
                        type="button"
                        className={`${styles.smallBtn} ${styles.editBtn}`}
                        onClick={() => {
                          setRenameTarget({ kind: 'habit', id: h.id, name: h.name })
                          setRenameValue(h.name)
                          setRenameHabitCategoryId(h.categoryId)
                        }}
                        aria-label={`Rediģēt ieraduma nosaukumu: ${h.name}`}
                      >
                        ✎
                      </button>
                    ) : isPriorityEdit ? (
                      <span className={styles.priorityStepper}>
                        <button
                          type="button"
                          className={sharedStyles.smallBtn}
                          onClick={() => {
                            const next = (Math.max(1, h.priority - 1) as 1 | 2 | 3)
                            appStore.actions.setHabitPriorityValue(h.id, next)
                            pendingPriorityChangedRef.current.add(h.id)
                          }}
                          disabled={h.priority === 1}
                          aria-label={`Samazināt prioritāti: ${h.name}`}
                        >
                          &lt;
                        </button>
                        <span className={styles.muted}>{h.priority}</span>
                        <button
                          type="button"
                          className={sharedStyles.smallBtn}
                          onClick={() => {
                            const next = (Math.min(3, h.priority + 1) as 1 | 2 | 3)
                            appStore.actions.setHabitPriorityValue(h.id, next)
                            pendingPriorityChangedRef.current.add(h.id)
                          }}
                          disabled={h.priority === 3}
                          aria-label={`Palielināt prioritāti: ${h.name}`}
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
        </div>

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
                        <div key={cat.id} className={styles.scoreCard}>
                          <div className={styles.scoreCardHeader}>
                            <FolderIcon className={styles.catIcon} />
                            <h3 className={styles.categoryName}>{cat.name}</h3>
                          </div>
                          {habits.map((h) => {
                            const value = scoresForSelectedDate[h.id]
                            const notStartedYet = Boolean(h.startDate && selectedDate < h.startDate)
                            const scoreDisabled = locked || notStartedYet
                            return (
                              <div
                                key={h.id}
                                className={`${styles.habitRow} ${notStartedYet ? styles.habitRowNotStarted : ''}`}
                              >
                                <div className={`${styles.habitLeft} ${styles.habitLeftIndented}`}>
                                  <TargetIcon className={styles.habitIcon} />
                                  <span className={styles.habitName} title={h.name}>
                                    {h.name}
                                  </span>
                                  {notStartedYet && h.startDate ? (
                                    <span className={styles.habitStartHint} title={`Sākas: ${formatDateLabel(h.startDate)}`}>
                                      Sākas: {formatDateLabel(h.startDate)}
                                    </span>
                                  ) : null}
                                </div>
                                <span className={styles.scoreGroup}>
                                  {[0, 1, 2].map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      disabled={scoreDisabled}
                                      title={notStartedYet && h.startDate ? `Sākas: ${formatDateLabel(h.startDate)}` : undefined}
                                      className={`${styles.scoreBtn} ${styles[`scoreBtn${s}`]} ${value === s ? styles.scoreBtnActive : ''}`}
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
                        <div key={p} className={styles.scoreCard}>
                          <div className={styles.scoreCardHeader}>
                            <span className={styles.priorityBadge}>🎯</span>
                            <h3 className={styles.categoryName}>Prioritāte {p}</h3>
                          </div>
                          {habits.map((h) => {
                            const value = scoresForSelectedDate[h.id]
                            const notStartedYet = Boolean(h.startDate && selectedDate < h.startDate)
                            const scoreDisabled = locked || notStartedYet
                            return (
                              <div
                                key={h.id}
                                className={`${styles.habitRow} ${notStartedYet ? styles.habitRowNotStarted : ''}`}
                              >
                                <div className={`${styles.habitLeft} ${styles.habitLeftIndented}`}>
                                  <TargetIcon className={styles.habitIcon} />
                                  <span className={styles.habitName} title={h.name}>
                                    {h.name}
                                  </span>
                                  {notStartedYet && h.startDate ? (
                                    <span className={styles.habitStartHint} title={`Sākas: ${formatDateLabel(h.startDate)}`}>
                                      Sākas: {formatDateLabel(h.startDate)}
                                    </span>
                                  ) : null}
                                </div>
                                <span className={styles.scoreGroup}>
                                  {[0, 1, 2].map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      disabled={scoreDisabled}
                                      title={notStartedYet && h.startDate ? `Sākas: ${formatDateLabel(h.startDate)}` : undefined}
                                      className={`${styles.scoreBtn} ${styles[`scoreBtn${s}`]} ${value === s ? styles.scoreBtnActive : ''}`}
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
                  <p className={styles.muted}>Pievieno ieradumu, lai sāktu vērtēt.</p>
                ) : null}

                <details style={{ marginTop: 16 }}>
                  <summary className={styles.muted}>Debug</summary>
                  <DebugPanel />
                </details>
              </div>
            </div>

            <aside className={styles.weeklySideCol} aria-label="Nedēļas uzdevumi">
              <div className={`${styles.subCard} ${styles.weeklyCard}`}>
                <div className={styles.weeklyHeaderRow}>
                  <div className={styles.weeklyHeaderLeft}>
                    <h3 className={styles.weeklyTitle}>Nedēļa</h3>
                    <div className={styles.weeklySubLabel}>
                      {formatDateLabel(weekStartDate)}–{formatDateLabel(weekEndDate)}
                    </div>
                  </div>

                  <div className={styles.panelHeaderActions}>
                    {weeklyMode !== 'normal' ? (
                      <button
                        type="button"
                        className={styles.exitModeBtn}
                        aria-label="Iziet no režīma"
                        title="Iziet no režīma"
                        onClick={() => {
                          setWeeklyMode('normal')
                          closeWeeklyMenu()
                        }}
                      >
                        ✕
                      </button>
                    ) : null}

                    <details className={styles.menu} ref={weeklyMenuRef}>
                      <summary className={styles.menuButton} aria-label="Nedēļas izvēlne" title="Nedēļas izvēlne">
                        ☰
                      </summary>
                      <div className={styles.menuPanel} role="menu" aria-label="Nedēļas darbības">

                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => {
                            setWeeklyMode('reorder')
                            closeWeeklyMenu()
                          }}
                        >
                          Pārkārtot
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => {
                            setWeeklyMode('rename')
                            closeWeeklyMenu()
                          }}
                        >
                          Rediģēt
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => {
                            setWeeklyMode('delete')
                            closeWeeklyMenu()
                          }}
                        >
                          Dzēst
                        </button>

                        <hr className={styles.menuDivider} />

                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => {
                            setAddWeeklyTaskTarget(2)
                            setAddWeeklyTaskName('')
                            setAddWeeklyTaskOpen(true)
                            closeWeeklyMenu()
                          }}
                        >
                          + Ieradumu
                        </button>
                      </div>
                    </details>
                  </div>
                </div>

                <div className={styles.weeklyScrollArea}>
                  {weeklyTasks.length === 0 ? (
                    <div className={styles.weeklyEmpty}>
                      <p className={styles.muted} style={{ marginTop: 0 }}>
                        Nav nedēļas uzdevumu.
                      </p>
                    </div>
                  ) : (
                    <div className={styles.weeklyList}>
                      {weeklyTasks.map((t) => {
                        const count = state.weeklyProgress[weekStartDate]?.[t.id] ?? 0
                        const canDrag = weeklyMode === 'reorder'
                        const notStartedYet = Boolean(t.startWeekStart && weekStartDate < t.startWeekStart)
                        const effectiveTargetPerWeek = getWeeklyTaskTargetPerWeekForWeekStart(
                          t,
                          weekStartDate,
                          currentWeekStart,
                        )
                        const progressTitle = notStartedYet && t.startWeekStart
                          ? `Sākas nedēļā: ${formatDateLabel(t.startWeekStart)}`
                          : undefined
                        return (
                          <WeeklyTaskTile
                            key={t.id}
                            task={t}
                            max={effectiveTargetPerWeek}
                            count={count}
                            mode={weeklyMode}
                            progressDisabled={notStartedYet}
                            progressTitle={progressTitle}
                            className={`${styles.weeklyRow} ${weeklyMode === 'reorder' ? styles.weeklyRowReorder : ''} ${weeklyDragOverId === t.id ? styles.weeklyRowDragOver : ''}`}
                            onAdjust={(delta) => {
                              appStore.actions.adjustWeeklyCompletionForDate(
                                weekStartDate,
                                selectedDate,
                                t.id,
                                delta,
                              )
                            }}
                            onRename={() => {
                              setRenameTarget({ kind: 'weeklyTask', id: t.id, name: t.name })
                              setRenameValue(t.name)
                              setRenameWeeklyTarget(t.targetPerWeek)
                            }}
                            onDelete={() => {
                              appStore.actions.deleteWeeklyTask(t.id)
                            }}
                            draggable={canDrag}
                            onDragStart={(e) => {
                              if (!canDrag) return
                              e.dataTransfer.effectAllowed = 'move'
                              e.dataTransfer.setData('text/plain', t.id)
                            }}
                            onDragOver={(e) => {
                              if (!canDrag) return
                              e.preventDefault()
                              setWeeklyDragOverId(t.id)
                            }}
                            onDragLeave={() => {
                              if (!canDrag) return
                              setWeeklyDragOverId((v) => (v === t.id ? null : v))
                            }}
                            onDrop={(e) => {
                              if (!canDrag) return
                              e.preventDefault()
                              setWeeklyDragOverId(null)

                              const draggedId = e.dataTransfer.getData('text/plain')
                              if (!draggedId) return
                              if (draggedId === t.id) return

                              const ordered = weeklyTasks.map((x) => x.id)
                              const fromIndex = ordered.indexOf(draggedId)
                              const toIndex = ordered.indexOf(t.id)
                              if (fromIndex === -1 || toIndex === -1) return

                              const next = reorderIds(ordered, draggedId, toIndex)
                              appStore.actions.reorderWeeklyTasks(next)
                            }}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
      </section>

      <section className={`${styles.panel} ${styles.todoPanel}`}>
        <div className={styles.todoHeaderRow}>
          <div className={styles.todoHeaderSpacer} aria-hidden="true" />
          <h2 className={`${styles.panelTitle} ${styles.todoTitle}`}>Uzdevumi</h2>

          <div className={styles.panelHeaderActions}>
            {todoMode !== 'normal' ? (
              <button
                type="button"
                className={styles.exitModeBtn}
                aria-label="Iziet no režīma"
                title="Iziet no režīma"
                onClick={() => {
                  appStore.actions.setTodoMode('normal')
                  closeTodoMenu()
                }}
              >
                ✕
              </button>
            ) : null}

            <details className={styles.menu} ref={todoMenuRef}>
              <summary className={styles.menuButton} aria-label="Uzdevumu izvēlne" title="Uzdevumu izvēlne">
                ☰
              </summary>
              <div className={styles.menuPanel} role="menu" aria-label="Uzdevumu darbības">

                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    appStore.actions.setTodoMode('reorder')
                    closeTodoMenu()
                  }}
                >
                  Pārkārtot
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    appStore.actions.setTodoMode('rename')
                    closeTodoMenu()
                  }}
                >
                  Pārdēvēt
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    appStore.actions.setTodoMode('delete')
                    closeTodoMenu()
                  }}
                >
                  Dzēst
                </button>

                <hr className={styles.menuDivider} />

                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    appStore.actions.setTodoMode('normal')
                    setAddTodoOpen(true)
                    closeTodoMenu()
                  }}
                >
                  + Uzdevumu
                </button>
              </div>
            </details>
          </div>
        </div>

        <div className={styles.scrollArea}>
          {todos.length === 0 ? <p className={styles.muted}>Nav uzdevumu.</p> : null}

          {todos.map((t) => {
            const canDrag = todoMode === 'reorder'
            return (
            <div
              key={t.id}
              className={`${styles.todoRow} ${canDrag ? styles.todoRowReorder : ''} ${todoDragOverId === t.id ? styles.todoRowDragOver : ''}`}
              draggable={canDrag}
              onDragStart={(e) => {
                if (!canDrag) return
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', t.id)
              }}
              onDragOver={(e) => {
                if (!canDrag) return
                e.preventDefault()
                setTodoDragOverId(t.id)
              }}
              onDragLeave={() => {
                if (!canDrag) return
                setTodoDragOverId((v) => (v === t.id ? null : v))
              }}
              onDrop={(e) => {
                if (!canDrag) return
                e.preventDefault()
                setTodoDragOverId(null)

                const draggedId = e.dataTransfer.getData('text/plain')
                if (!draggedId) return
                if (draggedId === t.id) return

                const ordered = todos.map((x) => x.id)
                const fromIndex = ordered.indexOf(draggedId)
                const toIndex = ordered.indexOf(t.id)
                if (fromIndex === -1 || toIndex === -1) return

                const next = reorderIds(ordered, draggedId, toIndex)
                appStore.actions.reorderTodos(next)
              }}
            >
              <input
                type="checkbox"
                onChange={() => {
                  appStore.actions.completeTodo(t.id)
                }}
                aria-label={`Pabeigt uzdevumu: ${t.text}`}
              />
              <span className={styles.todoText} title={t.text}>
                {t.text}
              </span>

              {todoMode === 'rename' ? (
                <button
                  type="button"
                  className={sharedStyles.smallBtn}
                  onClick={() => {
                    setRenameTarget({ kind: 'todo', id: t.id, name: t.text })
                    setRenameValue(t.text)
                  }}
                  aria-label={`Pārdēvēt uzdevumu: ${t.text}`}
                >
                  Mainīt
                </button>
              ) : null}

              {todoMode === 'delete' ? (
                <button
                  type="button"
                  className={`${styles.smallBtn} ${styles.dangerBtn}`}
                  onClick={() => appStore.actions.deleteTodo(t.id)}
                  aria-label={`Dzēst uzdevumu: ${t.text}`}
                >
                  Dzēst
                </button>
              ) : null}
            </div>
            )
          })}
        </div>

        <div className={styles.todoFooter}>
          <Link to="/archive" className={styles.primaryBtn} style={{ textDecoration: 'none' }}>
            Arhīvs
          </Link>
        </div>
      </section>
    </div>
  )
}

export default DailyPage
