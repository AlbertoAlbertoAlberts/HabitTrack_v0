import { useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { WeeklyTask } from '../../../domain/types'
import { WeeklyTaskTile } from '../../../components/weekly/WeeklyTaskTile'
import uiStyles from '../DailyShared.module.css'
import styles from './WeekPanel.module.css'

interface WeekPanelProps {
  weekStartDate: string
  weekEndDate: string
  selectedDate: string
  currentWeekStart: string
  weeklyTasks: WeeklyTask[]
  weeklyProgress: Record<string, Record<string, number>>
  weeklyMode: 'normal' | 'reorder' | 'delete' | 'rename'
  weeklyDragOverId: string | null
  formatDateLabel: (date: string) => string
  getWeeklyTaskTargetPerWeekForWeekStart: (task: WeeklyTask, weekStartDate: string, currentWeekStart: string) => number
  onSetWeeklyMode: (mode: 'normal' | 'reorder' | 'delete' | 'rename') => void
  onSetWeeklyDragOverId: (id: string | null | ((prev: string | null) => string | null)) => void
  onAddWeeklyTask: () => void
  onAdjustWeeklyCompletion: (weekStartDate: string, selectedDate: string, taskId: string, delta: 1 | -1) => void
  onRenameWeeklyTask: (taskId: string, name: string, targetPerWeek: number) => void
  onDeleteWeeklyTask: (taskId: string) => void
  onReorderWeeklyTasks: (orderedIds: string[]) => void
  onCloseWeeklyMenu: () => void
}

export function WeekPanel({
  weekStartDate,
  weekEndDate,
  selectedDate,
  currentWeekStart,
  weeklyTasks,
  weeklyProgress,
  weeklyMode,
  weeklyDragOverId,
  formatDateLabel,
  getWeeklyTaskTargetPerWeekForWeekStart,
  onSetWeeklyMode,
  onSetWeeklyDragOverId,
  onAddWeeklyTask,
  onAdjustWeeklyCompletion,
  onRenameWeeklyTask,
  onDeleteWeeklyTask,
  onReorderWeeklyTasks,
  onCloseWeeklyMenu,
}: WeekPanelProps) {
  const weeklyMenuRef = useRef<HTMLDetailsElement | null>(null)

  const reorderIds = <T extends string>(ids: T[], idToMove: T, targetIndex: number): T[] => {
    const currentIndex = ids.indexOf(idToMove)
    if (currentIndex === -1) return ids

    const next = ids.slice()
    next.splice(currentIndex, 1)
    const clamped = Math.max(0, Math.min(targetIndex, next.length))
    next.splice(clamped, 0, idToMove)
    return next
  }

  return (
    <aside className={styles.weeklySideCol} aria-label="Nedēļas uzdevumi">
      <div className={`${uiStyles.subCard} ${styles.weeklyCard}`}>
        <div className={styles.weeklyHeaderRow}>
          <div className={styles.weeklyHeaderLeft}>
            <h3 className={styles.weeklyTitle}>Nedēļa</h3>
            <div className={styles.weeklySubLabel}>
              {formatDateLabel(weekStartDate)}–{formatDateLabel(weekEndDate)}
            </div>
          </div>

          <div className={uiStyles.panelHeaderActions}>
            {weeklyMode !== 'normal' ? (
              <button
                type="button"
                className={uiStyles.exitModeBtn}
                aria-label="Iziet no režīma"
                title="Iziet no režīma"
                onClick={() => {
                  onSetWeeklyMode('normal')
                  onCloseWeeklyMenu()
                }}
              >
                ✕
              </button>
            ) : null}

            <details className={uiStyles.menu} ref={weeklyMenuRef}>
              <summary className={uiStyles.menuButton} aria-label="Nedēļas izvēlne" title="Nedēļas izvēlne">
                ☰
              </summary>
              <div className={uiStyles.menuPanel} role="menu" aria-label="Nedēļas darbības">
                <button
                  type="button"
                  className={uiStyles.menuItem}
                  onClick={() => {
                    onSetWeeklyMode('reorder')
                    onCloseWeeklyMenu()
                  }}
                >
                  Pārkārtot
                </button>
                <button
                  type="button"
                  className={uiStyles.menuItem}
                  onClick={() => {
                    onSetWeeklyMode('rename')
                    onCloseWeeklyMenu()
                  }}
                >
                  Rediģēt
                </button>
                <button
                  type="button"
                  className={uiStyles.menuItem}
                  onClick={() => {
                    onSetWeeklyMode('delete')
                    onCloseWeeklyMenu()
                  }}
                >
                  Dzēst
                </button>

                <hr className={uiStyles.menuDivider} />

                <button
                  type="button"
                  className={uiStyles.menuItem}
                  onClick={() => {
                    onAddWeeklyTask()
                    onCloseWeeklyMenu()
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
              <p className={uiStyles.muted} style={{ marginTop: 0 }}>
                Nav nedēļas uzdevumu.
              </p>
            </div>
          ) : (
            <div className={styles.weeklyList}>
              <AnimatePresence initial={false}>
                {weeklyTasks.map((t) => {
                  const count = weeklyProgress[weekStartDate]?.[t.id] ?? 0
                  const canDrag = weeklyMode === 'reorder'
                  const notStartedYet = Boolean(t.startWeekStart && weekStartDate < t.startWeekStart)
                  const effectiveTargetPerWeek = getWeeklyTaskTargetPerWeekForWeekStart(
                    t,
                    weekStartDate,
                    currentWeekStart,
                  )
                  const progressTitle =
                    notStartedYet && t.startWeekStart
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
                        onAdjustWeeklyCompletion(weekStartDate, selectedDate, t.id, delta)
                      }}
                      onRename={() => {
                        onRenameWeeklyTask(t.id, t.name, t.targetPerWeek)
                      }}
                      onDelete={() => {
                        onDeleteWeeklyTask(t.id)
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
                        onSetWeeklyDragOverId(t.id)
                      }}
                      onDragLeave={() => {
                        if (!canDrag) return
                        onSetWeeklyDragOverId((v) => (v === t.id ? null : v))
                      }}
                      onDrop={(e) => {
                        if (!canDrag) return
                        e.preventDefault()
                        onSetWeeklyDragOverId(null)

                        const draggedId = e.dataTransfer.getData('text/plain')
                        if (!draggedId) return
                        if (draggedId === t.id) return

                        const ordered = weeklyTasks.map((x) => x.id)
                        const fromIndex = ordered.indexOf(draggedId)
                        const toIndex = ordered.indexOf(t.id)
                        if (fromIndex === -1 || toIndex === -1) return

                        const next = reorderIds(ordered, draggedId, toIndex)
                        onReorderWeeklyTasks(next)
                      }}
                    />
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
