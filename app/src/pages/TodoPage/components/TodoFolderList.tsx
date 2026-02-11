import { useState } from 'react'
import type { TodoFolder, TodoItem } from '../../../domain/types'
import type { FolderMode } from '../TodoPage'
import sharedStyles from '../../../components/ui/shared.module.css'
import uiStyles from '../../DailyPage/DailyShared.module.css'
import styles from './TodoFolderList.module.css'

interface TodoFolderListProps {
  folders: TodoFolder[]
  todosByFolder: Map<string | undefined, TodoItem[]>
  folderMode: FolderMode
  dragSource: 'list' | 'matrix' | null
  onTodoDragStart: (todoId: string) => void
  onTodoDragEnd: () => void
  onDropBack: (todoId: string) => void
  onDropTodoOnFolder: (todoId: string, folderId: string | undefined) => void
  onBeginRenameFolder: (folderId: string, currentName: string) => void
  onBeginDeleteFolder: (folderId: string, folderName: string) => void
  onBeginRenameTodo: (todoId: string, currentText: string) => void
  onDeleteTodo: (todoId: string) => void
  onReorderFolders: (orderedIds: string[]) => void
  onAddTodoInFolder: (folderId: string) => void
}

const BEZ_MAPES_ID = undefined as string | undefined

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

function TodoDot({ assigned, className }: { assigned: boolean; className?: string }) {
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
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
      {assigned ? <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.85" /> : null}
    </svg>
  )
}

function FolderSection({
  folderId,
  folderName,
  items,
  folderMode,
  isDraggableFolder,
  folderDragOverId,
  todoDragOverFolderId,
  onTodoDragStart,
  onTodoDragEnd,
  onBeginRenameFolder,
  onBeginDeleteFolder,
  onBeginRenameTodo,
  onDeleteTodo,
  onFolderDragStart,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  onTodoDragOverFolder,
  onTodoDragLeaveFolder,
  onDropTodoOnFolder,
}: {
  folderId: string | undefined
  folderName: string
  items: TodoItem[]
  folderMode: FolderMode
  isDraggableFolder: boolean
  folderDragOverId: string | null
  todoDragOverFolderId: string | null | undefined
  onTodoDragStart: (todoId: string) => void
  onTodoDragEnd: () => void
  onBeginRenameFolder: (folderId: string, currentName: string) => void
  onBeginDeleteFolder: (folderId: string, folderName: string) => void
  onBeginRenameTodo: (todoId: string, currentText: string) => void
  onDeleteTodo: (todoId: string) => void
  onFolderDragStart: (folderId: string) => void
  onFolderDragOver: (folderId: string) => void
  onFolderDragLeave: (folderId: string) => void
  onFolderDrop: (targetFolderId: string) => void
  onTodoDragOverFolder: (folderId: string | undefined) => void
  onTodoDragLeaveFolder: (folderId: string | undefined) => void
  onDropTodoOnFolder: (folderId: string | undefined, e: React.DragEvent) => void
}) {
  const isReorderMode = folderMode === 'reorder'
  const isRenameMode = folderMode === 'rename'
  const isDeleteMode = folderMode === 'delete'

  const isTodoDragOver = todoDragOverFolderId === folderId || (folderId === undefined && todoDragOverFolderId === undefined)

  return (
    <div
      className={`${styles.folderCard} ${isDraggableFolder && isReorderMode ? styles.folderCardReorder : ''} ${folderDragOverId === folderId ? styles.folderCardDragOver : ''} ${isTodoDragOver ? styles.folderCardTodoDragOver : ''}`}
      draggable={isDraggableFolder && isReorderMode}
      onDragStart={(e) => {
        if (!isDraggableFolder || !isReorderMode || !folderId) return
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', folderId)
        onFolderDragStart(folderId)
      }}
      onDragEnter={(e) => {
        // Folder reorder mode
        if (isDraggableFolder && isReorderMode && folderId) {
          e.preventDefault()
          return
        }
        // Todo item drop on folder
        if (folderMode === 'normal') {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }
      }}
      onDragOver={(e) => {
        // Folder reorder mode
        if (isDraggableFolder && isReorderMode && folderId) {
          e.preventDefault()
          onFolderDragOver(folderId)
          return
        }
        // Todo item drop on folder
        if (folderMode === 'normal') {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onTodoDragOverFolder(folderId)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        // Folder reorder mode
        if (isDraggableFolder && isReorderMode && folderId) {
          onFolderDragLeave(folderId)
          return
        }
        // Todo item hover
        if (folderMode === 'normal') {
          onTodoDragLeaveFolder(folderId)
        }
      }}
      onDrop={(e) => {
        // Folder reorder mode
        if (isDraggableFolder && isReorderMode && folderId) {
          e.preventDefault()
          onFolderDrop(folderId)
          return
        }
        // Todo item drop on folder
        if (folderMode === 'normal') {
          e.preventDefault()
          e.stopPropagation()
          onDropTodoOnFolder(folderId, e)
        }
      }}
    >
      <div className={styles.folderHeader}>
        <div className={styles.folderTitleRow}>
          <FolderIcon className={styles.folderIcon} />
          <h3 className={styles.folderName}>{folderName}</h3>
        </div>
        {folderId && isRenameMode ? (
          <button
            type="button"
            className={sharedStyles.smallBtn}
            onClick={() => onBeginRenameFolder(folderId, folderName)}
            aria-label={`Pārdēvēt mapi: ${folderName}`}
          >
            Mainīt
          </button>
        ) : null}
        {folderId && isDeleteMode ? (
          <button
            type="button"
            className={`${sharedStyles.smallBtn} ${uiStyles.dangerBtn}`}
            onClick={() => onBeginDeleteFolder(folderId, folderName)}
            aria-label={`Dzēst mapi: ${folderName}`}
          >
            Dzēst
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 2px 18px' }}>Nav uzdevumu.</p>
      ) : null}

      {items.map((t) => (
        <div key={t.id} className={styles.todoItemRow}>
          <div
            className={styles.todoItemLeft}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('application/json', JSON.stringify({ kind: 'todo', todoId: t.id }))
              onTodoDragStart(t.id)
            }}
            onDragEnd={() => onTodoDragEnd()}
          >
            <TodoDot
              assigned={Boolean(t.quadrant)}
              className={t.quadrant ? styles.todoItemIconAssigned : styles.todoItemIcon}
            />
            <span className={styles.todoItemName} title={t.text}>
              {t.text}
            </span>
          </div>
          {isRenameMode ? (
            <button
              type="button"
              className={sharedStyles.smallBtn}
              onClick={() => onBeginRenameTodo(t.id, t.text)}
              aria-label={`Pārdēvēt: ${t.text}`}
            >
              Mainīt
            </button>
          ) : null}
          {isDeleteMode ? (
            <button
              type="button"
              className={`${sharedStyles.smallBtn} ${uiStyles.dangerBtn}`}
              onClick={() => onDeleteTodo(t.id)}
              aria-label={`Dzēst: ${t.text}`}
            >
              Dzēst
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function TodoFolderList({
  folders,
  todosByFolder,
  folderMode,
  dragSource,
  onTodoDragStart,
  onTodoDragEnd,
  onDropBack,
  onDropTodoOnFolder,
  onBeginRenameFolder,
  onBeginDeleteFolder,
  onBeginRenameTodo,
  onDeleteTodo,
  onReorderFolders,
  onAddTodoInFolder: _onAddTodoInFolder,
}: TodoFolderListProps) {
  const sortedFolders = folders.slice().sort((a, b) => a.sortIndex - b.sortIndex)
  const [folderDragOverId, setFolderDragOverId] = useState<string | null>(null)
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null)
  const [dropHover, setDropHover] = useState(false)
  const [todoDragOverFolderId, setTodoDragOverFolderId] = useState<string | null | undefined>(null)

  function handleDropTodoOnFolder(folderId: string | undefined, e: React.DragEvent) {
    setTodoDragOverFolderId(null)
    const todoId = parseDragPayload(e)
    if (todoId) onDropTodoOnFolder(todoId, folderId)
  }

  const isMatrixDrag = dragSource === 'matrix'

  function parseDragPayload(e: React.DragEvent): string | null {
    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (parsed?.kind === 'todo' && typeof parsed.todoId === 'string') return parsed.todoId
    } catch { /* ignore */ }
    return null
  }

  function handleFolderDrop(targetFolderId: string) {
    setFolderDragOverId(null)
    if (!draggedFolderId || draggedFolderId === targetFolderId) return
    const orderedIds = sortedFolders.map((f) => f.id)
    const fromIndex = orderedIds.indexOf(draggedFolderId)
    const toIndex = orderedIds.indexOf(targetFolderId)
    if (fromIndex === -1 || toIndex === -1) return
    const next = orderedIds.slice()
    next.splice(fromIndex, 1)
    next.splice(toIndex, 0, draggedFolderId)
    onReorderFolders(next)
    setDraggedFolderId(null)
  }

  return (
    <div
      className={`${styles.scrollArea} ${isMatrixDrag ? styles.scrollAreaDropTarget : ''} ${isMatrixDrag && dropHover ? styles.scrollAreaDropHover : ''}`}
      onDragEnter={(e) => {
        if (!isMatrixDrag) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDragOver={(e) => {
        if (!isMatrixDrag) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropHover(true)
      }}
      onDragLeave={(e) => {
        if (!isMatrixDrag) return
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setDropHover(false)
      }}
      onDrop={(e) => {
        if (!isMatrixDrag) return
        e.preventDefault()
        setDropHover(false)
        const todoId = parseDragPayload(e)
        if (todoId) onDropBack(todoId)
      }}
    >
      {sortedFolders.map((folder) => {
        const items = todosByFolder.get(folder.id) ?? []
        return (
          <FolderSection
            key={folder.id}
            folderId={folder.id}
            folderName={folder.name}
            items={items}
            folderMode={folderMode}
            isDraggableFolder
            folderDragOverId={folderDragOverId}
            todoDragOverFolderId={todoDragOverFolderId}
            onTodoDragStart={onTodoDragStart}
            onTodoDragEnd={onTodoDragEnd}
            onBeginRenameFolder={onBeginRenameFolder}
            onBeginDeleteFolder={onBeginDeleteFolder}
            onBeginRenameTodo={onBeginRenameTodo}
            onDeleteTodo={onDeleteTodo}
            onFolderDragStart={(id) => setDraggedFolderId(id)}
            onFolderDragOver={(id) => setFolderDragOverId(id)}
            onFolderDragLeave={(id) => setFolderDragOverId((v) => (v === id ? null : v))}
            onFolderDrop={handleFolderDrop}
            onTodoDragOverFolder={(id) => setTodoDragOverFolderId(id)}
            onTodoDragLeaveFolder={(id) => setTodoDragOverFolderId((v) => (v === id ? null : v))}
            onDropTodoOnFolder={handleDropTodoOnFolder}
          />
        )
      })}

      {/* "Bez mapes" auto-folder for items without a folder */}
      <FolderSection
        folderId={BEZ_MAPES_ID}
        folderName="Bez mapes"
        items={todosByFolder.get(BEZ_MAPES_ID) ?? []}
        folderMode={folderMode}
        isDraggableFolder={false}
        folderDragOverId={folderDragOverId}
        todoDragOverFolderId={todoDragOverFolderId}
        onTodoDragStart={onTodoDragStart}
        onTodoDragEnd={onTodoDragEnd}
        onBeginRenameFolder={onBeginRenameFolder}
        onBeginDeleteFolder={onBeginDeleteFolder}
        onBeginRenameTodo={onBeginRenameTodo}
        onDeleteTodo={onDeleteTodo}
        onFolderDragStart={() => {}}
        onFolderDragOver={() => {}}
        onFolderDragLeave={() => {}}
        onFolderDrop={() => {}}
        onTodoDragOverFolder={(id) => setTodoDragOverFolderId(id)}
        onTodoDragLeaveFolder={(id) => setTodoDragOverFolderId((v) => (v === id ? null : v))}
        onDropTodoOnFolder={handleDropTodoOnFolder}
      />

    </div>
  )
}
