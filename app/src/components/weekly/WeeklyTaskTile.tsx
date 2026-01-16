import type { DragEventHandler } from 'react'

import type { WeeklyTask } from '../../domain/types'

import { WeeklyProgressRing } from './WeeklyProgressRing'
import styles from './WeeklyTaskTile.module.css'

export function WeeklyTaskTile({
  task,
  count,
  max,
  className,
  onAdjust,
  progressDisabled,
  progressTitle,
  mode = 'normal',
  onRename,
  onDelete,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  task: WeeklyTask
  count: number
  max?: number
  className?: string
  onAdjust: (delta: 1 | -1) => void
  progressDisabled?: boolean
  progressTitle?: string
  mode?: 'normal' | 'reorder' | 'delete' | 'rename'
  onRename?: () => void
  onDelete?: () => void
  draggable?: boolean
  onDragStart?: DragEventHandler<HTMLDivElement>
  onDragOver?: DragEventHandler<HTMLDivElement>
  onDragLeave?: DragEventHandler<HTMLDivElement>
  onDrop?: DragEventHandler<HTMLDivElement>
}) {
  const defaultTitle = `Nedēļas progress: ${task.name}. Klikšķis: atzīmē izvēlēto dienu. Shift+klikšķis: noņem izvēlētās dienas atzīmi.`
  const title = progressTitle ?? defaultTitle

  return (
    <div
      className={className ? `${styles.tile} ${className}` : styles.tile}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className={styles.actions} aria-hidden={mode === 'normal'}>
        {mode === 'reorder' ? <span className={styles.dragHandle} title="Velc, lai pārkārtotu">⠿</span> : null}
        {mode === 'rename' ? (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onRename}
            aria-label={`Mainīt nosaukumu: ${task.name}`}
            title="Mainīt nosaukumu"
          >
            ✎
          </button>
        ) : null}
        {mode === 'delete' ? (
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.trashBtn}`}
            onClick={onDelete}
            aria-label={`Dzēst: ${task.name}`}
            title="Dzēst"
          >
            🗑
          </button>
        ) : null}
      </div>

      <WeeklyProgressRing
        value={count}
        max={typeof max === 'number' ? max : task.targetPerWeek}
        title={title}
        disabled={progressDisabled}
        onAdjust={onAdjust}
      />
      <div className={styles.text}>
        <div className={styles.name} title={task.name}>
          {task.name}
        </div>
      </div>
    </div>
  )
}
