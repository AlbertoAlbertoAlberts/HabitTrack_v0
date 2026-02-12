import type { TodoFolder, TodoItem, TodoQuadrant } from '../../../domain/types'
import styles from './EisenhowerMatrix.module.css'

interface EisenhowerMatrixProps {
  todos: Record<string, TodoItem>
  todoFolders: Record<string, TodoFolder>
  dragOverQuadrant: TodoQuadrant | null
  onDropOnQuadrant: (quadrant: TodoQuadrant, todoId: string) => void
  onDragOverQuadrant: (quadrant: TodoQuadrant | null) => void
  onItemDragStart: (todoId: string) => void
  onItemDragEnd?: () => void
}

const QUADRANT_ORDER: TodoQuadrant[] = ['asap', 'schedule', 'later', 'fun']

const QUADRANT_LABELS: Record<TodoQuadrant, string> = {
  asap: 'ASAP:',
  schedule: 'IEPLĀNOT:',
  later: 'VĒLĀK:',
  fun: 'FUN:',
}

const QUADRANT_HINTS: Record<TodoQuadrant, string> = {
  asap: 'Velc uzdevumu šeit',
  schedule: 'Velc uzdevumu šeit',
  later: 'Velc uzdevumu šeit',
  fun: 'Velc uzdevumu šeit',
}

function parseDragPayload(e: React.DragEvent): string | null {
  try {
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.kind === 'todo' && typeof parsed.todoId === 'string') return parsed.todoId
  } catch {
    // ignore
  }
  return null
}

export function EisenhowerMatrix({
  todos,
  todoFolders,
  dragOverQuadrant,
  onDropOnQuadrant,
  onDragOverQuadrant,
  onItemDragStart,
  onItemDragEnd,
}: EisenhowerMatrixProps) {
  const itemsByQuadrant = new Map<TodoQuadrant, TodoItem[]>()
  for (const q of QUADRANT_ORDER) itemsByQuadrant.set(q, [])

  for (const todo of Object.values(todos)) {
    if (todo.quadrant && itemsByQuadrant.has(todo.quadrant)) {
      itemsByQuadrant.get(todo.quadrant)!.push(todo)
    }
  }

  // Sort items within each quadrant by sortIndex
  for (const [, items] of itemsByQuadrant) {
    items.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
  }

  return (
    <div className={styles.matrix}>
      {/* Row 1: corner + column headers */}
      <div className={styles.cornerCell} />
      <div className={styles.colHeader}>Steidzams</div>
      <div className={styles.colHeader}>Nav steidzams</div>

      {/* Row 2: Svarīgs + ASAP + Ieplānot */}
      <div className={styles.rowHeader}>Svarīgs</div>
      {renderQuadrant('asap')}
      {renderQuadrant('schedule')}

      {/* Row 3: Nav svarīgs + Vēlāk + Fun */}
      <div className={styles.rowHeader}>Nav svarīgs</div>
      {renderQuadrant('later')}
      {renderQuadrant('fun')}
    </div>
  )

  function renderQuadrant(q: TodoQuadrant) {
    const items = itemsByQuadrant.get(q) ?? []
    const isDragOver = dragOverQuadrant === q

    return (
      <div
        className={`${styles.quadrant} ${isDragOver ? styles.quadrantDragOver : ''}`}
        onDragEnter={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDragOverQuadrant(q)
        }}
        onDragLeave={(e) => {
          // Only clear if leaving the quadrant (not entering a child)
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          onDragOverQuadrant(null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDragOverQuadrant(null)
          const todoId = parseDragPayload(e)
          if (todoId) onDropOnQuadrant(q, todoId)
        }}
      >
        <div className={styles.quadrantLabel}>{QUADRANT_LABELS[q]}</div>
        {items.length === 0 ? (
          <div className={styles.quadrantEmpty}>{QUADRANT_HINTS[q]}</div>
        ) : (
          items.map((t) => {
            const folderName = t.folderId ? todoFolders[t.folderId]?.name : undefined
            return (
              <div
                key={t.id}
                className={styles.matrixItem}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation()
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({ kind: 'todo', todoId: t.id }),
                  )
                  onItemDragStart(t.id)
                }}
                onDragEnd={() => onItemDragEnd?.()}
              >
                <span>{t.text}</span>
                {folderName ? (
                  <span className={styles.matrixItemFolder}>({folderName})</span>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    )
  }
}
