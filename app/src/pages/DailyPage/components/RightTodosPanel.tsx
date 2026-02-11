import type { RefObject } from 'react'
import { Link } from 'react-router-dom'

import type { TodoItem, TodoMode, TodoFolder, TodoFolderId } from '../../../domain/types'
import type { TodoGroup } from '../hooks/useDailyData'

import sharedStyles from '../../../components/ui/shared.module.css'
import layoutStyles from '../DailyPage.module.css'
import uiStyles from '../DailyShared.module.css'
import styles from './RightTodosPanel.module.css'

interface RightTodosPanelProps {
  todos: TodoItem[]
  groupedTodos: TodoGroup[]
  todoFolders: Record<TodoFolderId, TodoFolder>
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
  groupedTodos,
  todoFolders,
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

  function folderLabel(t: TodoItem): string | null {
    if (!t.folderId) return null
    const folder = todoFolders[t.folderId]
    return folder ? folder.name : null
  }

  function renderTodoRow(t: TodoItem) {
    const canDrag = todoMode === 'reorder'
    const fLabel = folderLabel(t)
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
          {t.text}{fLabel ? <span className={styles.todoFolderLabel}> ({fLabel})</span> : null}
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
            className={`${sharedStyles.smallBtn} ${uiStyles.dangerBtn}`}
            onClick={() => onDeleteTodo(t.id)}
            aria-label={`Dzēst uzdevumu: ${t.text}`}
          >
            Dzēst
          </button>
        ) : null}
      </div>
    )
  }

  // Use grouped view when there are any quadrant-assigned todos, otherwise flat list
  const hasGroups = groupedTodos.length > 1 || (groupedTodos.length === 1 && groupedTodos[0].quadrant !== 'uncategorized')
  return (
    <section className={`${uiStyles.panel} ${layoutStyles.todoPanel}`}>
      <div className={styles.todoHeaderRow}>
        <div className={`${uiStyles.panelHeaderActions} ${styles.todoHeaderLeftActions}`}>
          <button
            type="button"
            className={styles.addTodoBtn}
            aria-label="Pievienot uzdevumu"
            title="Pievienot uzdevumu"
            onClick={() => {
              onSetTodoMode('normal')
              onOpenAddTodo()
              onCloseTodoMenu()
            }}
          >
            +
          </button>
        </div>
        <h2 className={styles.todoTitle}>To-Do</h2>

        <div className={`${uiStyles.panelHeaderActions} ${styles.todoHeaderActions}`}>
          {todoMode !== 'normal' ? (
            <button
              type="button"
              className={uiStyles.exitModeBtn}
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
          <details className={uiStyles.menu} ref={todoMenuRef}>
            <summary className={uiStyles.menuButton} aria-label="Uzdevumu izvēlne" title="Uzdevumu izvēlne">
              ☰
            </summary>
            <div className={uiStyles.menuPanel} role="menu" aria-label="Uzdevumu darbības">
              <button
                type="button"
                className={uiStyles.menuItem}
                onClick={() => {
                  onSetTodoMode('reorder')
                  onCloseTodoMenu()
                }}
              >
                Pārkārtot
              </button>
              <button
                type="button"
                className={uiStyles.menuItem}
                onClick={() => {
                  onSetTodoMode('rename')
                  onCloseTodoMenu()
                }}
              >
                Pārdēvēt
              </button>
              <button
                type="button"
                className={uiStyles.menuItem}
                onClick={() => {
                  onSetTodoMode('delete')
                  onCloseTodoMenu()
                }}
              >
                Dzēst
              </button>

              <hr className={uiStyles.menuDivider} />

              <button
                type="button"
                className={uiStyles.menuItem}
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

      <div className={uiStyles.scrollArea}>
        {todos.length === 0 ? <p className={uiStyles.muted}>Nav uzdevumu.</p> : null}

        {todos.length > 0 && hasGroups
          ? groupedTodos.map((group) => (
              <div key={group.quadrant} className={styles.todoGroup}>
                <div className={styles.todoGroupHeader}>{group.label}</div>
                {group.items.map((t) => renderTodoRow(t))}
              </div>
            ))
          : todos.map((t) => renderTodoRow(t))}
      </div>

      <div className={styles.todoFooter}>
        <Link to="/archive" className={uiStyles.primaryBtn} style={{ textDecoration: 'none' }}>
          Arhīvs
        </Link>
      </div>
    </section>
  )
}
