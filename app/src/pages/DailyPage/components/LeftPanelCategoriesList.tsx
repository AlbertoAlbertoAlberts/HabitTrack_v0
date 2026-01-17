import type { Category, Habit } from '../../../domain/types'
import sharedStyles from '../../../components/ui/shared.module.css'
import uiStyles from '../DailyShared.module.css'
import styles from './LeftPanelCategoriesList.module.css'
import habitStyles from './HabitRow.module.css'

interface LeftPanelCategoriesListProps {
  categories: Category[]
  habitsByCategory: Map<string, Habit[]>
  isReorderMode: boolean
  isDeleteMode: boolean
  isPriorityEdit: boolean
  isRenameMode: boolean
  dragOverKey: string | null
  onAddCategoryClick: () => void
  onSetDragOverKey: (key: string | null) => void
  onCategoryDragStart: (categoryId: string) => void
  onCategoryDrop: (categoryId: string, payload: { kind: string; categoryId?: string; habitId?: string; fromCategoryId?: string }) => void
  onHabitDragStart: (habitId: string, categoryId: string) => void
  onHabitDrop: (habitId: string, categoryId: string, payload: { kind: string; habitId?: string; fromCategoryId?: string }) => void
  onCategoryEditClick: (categoryId: string, name: string) => void
  onCategoryDeleteClick: (categoryId: string, name: string, anchor: { left: number; top: number; right: number; bottom: number }) => void
  onHabitEditClick: (habitId: string, name: string, categoryId: string) => void
  onHabitDeleteClick: (habitId: string) => void
  onHabitPriorityChange: (habitId: string, delta: number, currentPriority: number) => void
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

export function LeftPanelCategoriesList({
  categories,
  habitsByCategory,
  isReorderMode,
  isDeleteMode,
  isPriorityEdit,
  isRenameMode,
  dragOverKey,
  onAddCategoryClick,
  onSetDragOverKey,
  onCategoryDragStart,
  onCategoryDrop,
  onHabitDragStart,
  onHabitDrop,
  onCategoryEditClick,
  onCategoryDeleteClick,
  onHabitEditClick,
  onHabitDeleteClick,
  onHabitPriorityChange,
}: LeftPanelCategoriesListProps) {
  if (categories.length === 0) {
    return (
      <div className={styles.scrollArea}>
        <div>
          <p className={uiStyles.muted}>Nav kategoriju.</p>
          <button type="button" className={sharedStyles.smallBtn} onClick={onAddCategoryClick}>
            Izveidot pirmo kategoriju
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.scrollArea}>
      {categories.map((cat) => {
        const habits = habitsByCategory.get(cat.id) ?? []
        return (
          <div
            key={cat.id}
            className={`${styles.categoryCard} ${isReorderMode ? uiStyles.dropZone : ''} ${dragOverKey === `cat:${cat.id}` ? uiStyles.dropZoneActive : ''}`}
            draggable={isReorderMode}
            onDragStart={(e) => {
              if (!isReorderMode) return
              e.dataTransfer.effectAllowed = 'move'
              onCategoryDragStart(cat.id)
              e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'category', categoryId: cat.id }))
            }}
            onDragOver={(e) => {
              if (!isReorderMode) return
              e.preventDefault()
              onSetDragOverKey(`cat:${cat.id}`)
            }}
            onDragLeave={() => {
              if (!isReorderMode) return
              onSetDragOverKey(null)
            }}
            onDrop={(e) => {
              if (!isReorderMode) return
              e.preventDefault()
              onSetDragOverKey(null)
              const payload = JSON.parse(e.dataTransfer.getData('text/plain'))
              if (!payload) return
              onCategoryDrop(cat.id, payload)
            }}
          >
            <div className={styles.categoryHeader}>
              <div className={styles.categoryTitleRow}>
                <FolderIcon className={styles.catIcon} />
                <h3 className={styles.categoryName}>{cat.name}</h3>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isReorderMode ? <span className={uiStyles.dragHandle} title="Velc, lai pārkārtotu">⠿</span> : null}

                {isRenameMode ? (
                  <button
                    type="button"
                    className={`${styles.smallBtn} ${styles.editBtn}`}
                    onClick={() => {
                      onCategoryEditClick(cat.id, cat.name)
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
                      onCategoryDeleteClick(cat.id, cat.name, {
                        left: r.left,
                        top: r.top,
                        right: r.right,
                        bottom: r.bottom,
                      })
                    }}
                    aria-label={`Dzēst kategoriju: ${cat.name}`}
                  >
                    🗑
                  </button>
                ) : null}
              </div>
            </div>

            {habits.length === 0 ? <p className={uiStyles.muted}>Nav ieradumu.</p> : null}

            {habits.map((h) => (
              <div
                key={h.id}
                className={`${styles.habitRowCompact} ${isReorderMode ? uiStyles.dropZone : ''} ${dragOverKey === `habit:${h.id}` ? uiStyles.dropZoneActive : ''}`}
                draggable={isReorderMode}
                onDragStart={(e) => {
                  if (!isReorderMode) return
                  e.dataTransfer.effectAllowed = 'move'
                  onHabitDragStart(h.id, cat.id)
                  e.dataTransfer.setData(
                    'text/plain',
                    JSON.stringify({ kind: 'habit', habitId: h.id, fromCategoryId: cat.id }),
                  )
                }}
                onDragOver={(e) => {
                  if (!isReorderMode) return
                  e.preventDefault()
                  onSetDragOverKey(`habit:${h.id}`)
                }}
                onDragLeave={() => {
                  if (!isReorderMode) return
                  onSetDragOverKey(null)
                }}
                onDrop={(e) => {
                  if (!isReorderMode) return
                  e.preventDefault()
                  onSetDragOverKey(null)

                  const payload = JSON.parse(e.dataTransfer.getData('text/plain'))
                  if (!payload || payload.kind !== 'habit') return

                  onHabitDrop(h.id, cat.id, payload)
                }}
              >
                <div className={`${habitStyles.habitLeft} ${habitStyles.habitLeftIndented}`}>
                  <TargetIcon className={habitStyles.habitIcon} />
                  <span className={habitStyles.habitName} title={h.name}>
                    {h.name}
                  </span>
                </div>

                {isDeleteMode ? (
                  <button
                    type="button"
                    className={`${styles.smallBtn} ${styles.trashBtn}`}
                    onClick={() => {
                      onHabitDeleteClick(h.id)
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
                      onHabitEditClick(h.id, h.name, h.categoryId)
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
                        onHabitPriorityChange(h.id, -1, h.priority)
                      }}
                      disabled={h.priority === 1}
                      aria-label={`Samazināt prioritāti: ${h.name}`}
                    >
                      &lt;
                    </button>
                      <span className={uiStyles.muted}>{h.priority}</span>
                    <button
                      type="button"
                      className={sharedStyles.smallBtn}
                      onClick={() => {
                        onHabitPriorityChange(h.id, 1, h.priority)
                      }}
                      disabled={h.priority === 3}
                      aria-label={`Palielināt prioritāti: ${h.name}`}
                    >
                      &gt;
                    </button>
                  </span>
                ) : (
                  <span className={uiStyles.muted}>P{h.priority}</span>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
