import type { RefObject } from 'react'
import { Link } from 'react-router-dom'

import type { TodoItem, TodoMode } from '../../../domain/types'

import sharedStyles from '../../../components/ui/shared.module.css'
import pageStyles from '../DailyPage.module.css'
import styles from './RightTodosPanel.module.css'

interface RightTodosPanelProps {
  todos: TodoItem[]
  todoMode: TodoMode
  todoDragOverId: string | null
  todoMenuRef: RefObject<HTMLDetailsElement | null>

  onSetTodoDragOverId: (id: string | null | ((prev: string | null) => string | null)) => void
  onSetTodoMode: (mode: TodoMode) => void
  onOpenAddTodo: () => void
  onCloseTodoMenu: () => void

  onCompleteTodo: (todoId: string) => void
  onDeleteTodo: (todoId: string) => void
  onReorderTodos: (orderedIds: string[]) => void
  onBeginRenameTodo: (todoId: string, currentText: string) => void
}

function reorderIds(orderedIds: string[], draggedId: string, targetIndex: number) {
  const fromIndex = orderedIds.indexOf(draggedId)
  if (fromIndex === -1) return orderedIds
  if (targetIndex < 0 || targetIndex >= orderedIds.length) return orderedIds

  const next = orderedIds.slice()
  next.splice(fromIndex, 1)
  next.splice(targetIndex, 0, draggedId)
  return next
}

export function RightTodosPanel({
  todos,
  todoMode,
  todoDragOverId,
  todoMenuRef,
  onSetTodoDragOverId,
  onSetTodoMode,
  onOpenAddTodo,
  onCloseTodoMenu,
  onCompleteTodo,
  onDeleteTodo,
  onReorderTodos,
  onBeginRenameTodo,
}: RightTodosPanelProps) {
  return (
    <section className={`${pageStyles.panel} ${pageStyles.todoPanel}`}>
      <div className={styles.todoHeaderRow}>
        <div className={styles.todoHeaderSpacer} aria-hidden="true" />
        <h2 className={styles.todoTitle}>Uzdevumi</h2>

        <div className={pageStyles.panelHeaderActions}>
          {todoMode !== 'normal' ? (
            <button
              type="button"
              className={pageStyles.exitModeBtn}
              aria-label="Iziet no režīma"
              title="Iziet no režīma"
              onClick={() => {
                onSetTodoMode('normal')
                onCloseTodoMenu()
              }}
            >
              ✕
            </button>
          ) : null}

          <details ref={todoMenuRef}>
            <summary aria-label="Uzdevumu izvēlne" title="Uzdevumu izvēlne">
              ☰
            </summary>
            <div role="menu" aria-label="Uzdevumu darbības">
              <button
                type="button"
                onClick={() => {
                  onSetTodoMode('reorder')
                  onCloseTodoMenu()
                }}
              >
                Pārkārtot
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetTodoMode('rename')
                  onCloseTodoMenu()
                }}
              >
                Pārdēvēt
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetTodoMode('delete')
                  onCloseTodoMenu()
                }}
              >
                Dzēst
              </button>

              <hr />

              <button
                type="button"
                onClick={() => {
                  onSetTodoMode('normal')
                  onOpenAddTodo()
                  onCloseTodoMenu()
                }}
              >
                + Uzdevumu
              </button>
            </div>
          </details>
        </div>
      </div>

      <div className={pageStyles.scrollArea}>
        {todos.length === 0 ? <p className={pageStyles.muted}>Nav uzdevumu.</p> : null}

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
                onSetTodoDragOverId(t.id)
              }}
              onDragLeave={() => {
                if (!canDrag) return
                onSetTodoDragOverId((v) => (v === t.id ? null : v))
              }}
              onDrop={(e) => {
                if (!canDrag) return
                e.preventDefault()
                onSetTodoDragOverId(null)

                const draggedId = e.dataTransfer.getData('text/plain')
                if (!draggedId) return
                if (draggedId === t.id) return

                const ordered = todos.map((x) => x.id)
                const fromIndex = ordered.indexOf(draggedId)
                const toIndex = ordered.indexOf(t.id)
                if (fromIndex === -1 || toIndex === -1) return

                const next = reorderIds(ordered, draggedId, toIndex)
                onReorderTodos(next)
              }}
            >
              <input
                type="checkbox"
                onChange={() => {
                  onCompleteTodo(t.id)
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
                    onBeginRenameTodo(t.id, t.text)
                  }}
                  aria-label={`Pārdēvēt uzdevumu: ${t.text}`}
                >
                  Mainīt
                </button>
              ) : null}

              {todoMode === 'delete' ? (
                <button
                  type="button"
                  className={`${pageStyles.smallBtn} ${pageStyles.dangerBtn}`}
                  onClick={() => onDeleteTodo(t.id)}
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
        <Link to="/archive" className={pageStyles.primaryBtn} style={{ textDecoration: 'none' }}>
          Arhīvs
        </Link>
      </div>
    </section>
  )
}
