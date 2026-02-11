import { useEffect, useMemo, useRef, useState } from 'react'

import { Dialog, DialogBody, DialogFooter, dialogStyles } from '../../components/ui/Dialog'
import { TodoFolderList } from './components/TodoFolderList'
import { EisenhowerMatrix } from './components/EisenhowerMatrix'
import { useAppState } from '../../domain/store/useAppStore'
import { appStore } from '../../domain/store/appStore'

import sharedStyles from '../../components/ui/shared.module.css'
import uiStyles from '../DailyPage/DailyShared.module.css'
import layoutStyles from './TodoPage.module.css'
import folderListStyles from './components/TodoFolderList.module.css'

import type { TodoItem, TodoQuadrant } from '../../domain/types'

export type FolderMode = 'normal' | 'reorder' | 'rename' | 'delete'

export function TodoPage() {
  const state = useAppState()

  const [addTodoOpen, setAddTodoOpen] = useState(false)
  const [addTodoText, setAddTodoText] = useState('')
  const [addTodoFolderId, setAddTodoFolderId] = useState<string>('')

  const [addFolderOpen, setAddFolderOpen] = useState(false)
  const [addFolderName, setAddFolderName] = useState('')

  const [folderMode, setFolderMode] = useState<FolderMode>('normal')
  const folderMenuRef = useRef<HTMLDetailsElement | null>(null)

  // Rename folder dialog
  const [renameFolderOpen, setRenameFolderOpen] = useState(false)
  const [renameFolderId, setRenameFolderId] = useState<string>('')
  const [renameFolderValue, setRenameFolderValue] = useState('')

  // Delete folder confirmation dialog
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false)
  const [deleteFolderId, setDeleteFolderId] = useState<string>('')
  const [deleteFolderName, setDeleteFolderName] = useState('')

  const [dragOverQuadrant, setDragOverQuadrant] = useState<TodoQuadrant | null>(null)
  const [dragSource, setDragSource] = useState<'list' | 'matrix' | null>(null)

  const folders = useMemo(
    () => Object.values(state.todoFolders).sort((a, b) => a.sortIndex - b.sortIndex),
    [state.todoFolders],
  )

  const todosByFolder = useMemo(() => {
    const map = new Map<string | undefined, TodoItem[]>()
    const allTodos = Object.values(state.todos)
      .slice()
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))

    for (const todo of allTodos) {
      const key = todo.folderId
      const list = map.get(key) ?? []
      list.push(todo)
      map.set(key, list)
    }
    return map
  }, [state.todos])

  function handleAddTodo() {
    const text = addTodoText.trim()
    if (!text) return
    const folderId = addTodoFolderId || undefined
    appStore.actions.addTodo(text, folderId)
    setAddTodoText('')
    setAddTodoFolderId('')
    setAddTodoOpen(false)
  }

  function handleAddFolder() {
    const name = addFolderName.trim()
    if (!name) return
    appStore.actions.addTodoFolder(name)
    setAddFolderName('')
    setAddFolderOpen(false)
  }

  function closeFolderMenu() {
    if (folderMenuRef.current) folderMenuRef.current.open = false
  }

  function handleRenameFolder() {
    const name = renameFolderValue.trim()
    if (!name || !renameFolderId) return
    appStore.actions.renameTodoFolder(renameFolderId, name)
    setRenameFolderOpen(false)
    setRenameFolderId('')
    setRenameFolderValue('')
  }

  function handleDeleteFolder() {
    if (!deleteFolderId) return
    appStore.actions.deleteTodoFolder(deleteFolderId)
    setDeleteFolderOpen(false)
    setDeleteFolderId('')
    setDeleteFolderName('')
  }

  // Auto-close folder menu on outside click
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const menu = folderMenuRef.current
      if (!menu || !menu.open) return
      if (menu.contains(e.target as Node)) return
      menu.open = false
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  return (
    <div className={`${sharedStyles.page} ${layoutStyles.page}`}>
      {/* ── Left panel: Folder list ── */}
      <section className={`${uiStyles.panel} ${layoutStyles.foldersPanel}`}>
        <div className={folderListStyles.headerRow}>
          <div className={`${uiStyles.panelHeaderActions} ${folderListStyles.headerLeftActions}`}>
            <button
              type="button"
              className={folderListStyles.addBtn}
              aria-label="Pievienot uzdevumu"
              title="Pievienot uzdevumu"
              onClick={() => {
                setAddTodoText('')
                setAddTodoFolderId('')
                setAddTodoOpen(true)
              }}
            >
              +
            </button>
          </div>
          <h2 className={folderListStyles.title}>Uzdevumi</h2>

          <div className={`${uiStyles.panelHeaderActions} ${folderListStyles.headerRightActions}`}>
            {folderMode !== 'normal' ? (
              <button
                type="button"
                className={uiStyles.exitModeBtn}
                aria-label="Iziet no režīma"
                title="Iziet no režīma"
                onClick={() => setFolderMode('normal')}
              >
                ✕
              </button>
            ) : null}
            <details className={uiStyles.menu} ref={folderMenuRef}>
              <summary className={uiStyles.menuButton} aria-label="Mapju izvēlne" title="Mapju izvēlne">
                ☰
              </summary>
              <div className={uiStyles.menuPanel} role="menu" aria-label="Mapju darbības">
                <button type="button" className={uiStyles.menuItem} onClick={() => { setFolderMode('reorder'); closeFolderMenu() }}>
                  Pārkārtot
                </button>
                <button type="button" className={uiStyles.menuItem} onClick={() => { setFolderMode('rename'); closeFolderMenu() }}>
                  Pārdēvēt
                </button>
                <button type="button" className={uiStyles.menuItem} onClick={() => { setFolderMode('delete'); closeFolderMenu() }}>
                  Dzēst
                </button>
                <hr className={uiStyles.menuDivider} />
                <button type="button" className={uiStyles.menuItem} onClick={() => { setAddFolderName(''); setAddFolderOpen(true); closeFolderMenu() }}>
                  + Mapi
                </button>
              </div>
            </details>
          </div>
        </div>

        <TodoFolderList
          folders={folders}
          todosByFolder={todosByFolder}
          folderMode={folderMode}
          dragSource={dragSource}
          onTodoDragStart={() => setDragSource('list')}
          onTodoDragEnd={() => setDragSource(null)}
          onDropBack={(todoId) => {
            appStore.actions.setTodoQuadrant(todoId, undefined)
            setDragSource(null)
          }}
          onDropTodoOnFolder={(todoId, folderId) => {
            appStore.actions.setTodoFolder(todoId, folderId)
            setDragSource(null)
          }}
          onBeginRenameFolder={(folderId, currentName) => {
            setRenameFolderId(folderId)
            setRenameFolderValue(currentName)
            setRenameFolderOpen(true)
          }}
          onBeginDeleteFolder={(folderId, folderName) => {
            setDeleteFolderId(folderId)
            setDeleteFolderName(folderName)
            setDeleteFolderOpen(true)
          }}
          onReorderFolders={(orderedIds) => appStore.actions.reorderTodoFolders(orderedIds)}
          onAddTodoInFolder={(folderId) => {
            setAddTodoText('')
            setAddTodoFolderId(folderId)
            setAddTodoOpen(true)
          }}
        />
      </section>

      {/* ── Right panel: Eisenhower Matrix ── */}
      <section className={`${uiStyles.panel} ${layoutStyles.matrixPanel}`}>
        <EisenhowerMatrix
          todos={state.todos}
          todoFolders={state.todoFolders}
          dragOverQuadrant={dragOverQuadrant}
          onDragOverQuadrant={setDragOverQuadrant}
          onDropOnQuadrant={(quadrant, todoId) => {
            appStore.actions.setTodoQuadrant(todoId, quadrant)
            setDragOverQuadrant(null)
            setDragSource(null)
          }}
          onItemDragStart={() => setDragSource('matrix')}
          onItemDragEnd={() => { setDragSource(null); setDragOverQuadrant(null) }}
        />
      </section>

      {/* ── Add todo dialog ── */}
      <Dialog open={addTodoOpen} title="Jauns uzdevums" onClose={() => setAddTodoOpen(false)}>
        <DialogBody>
          <label className={dialogStyles.label}>
            Nosaukums
            <input
              className={dialogStyles.input}
              value={addTodoText}
              onChange={(e) => setAddTodoText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo() }}
              autoFocus
            />
          </label>
          <label className={dialogStyles.label} style={{ marginTop: 10 }}>
            Mape
            <select
              className={dialogStyles.input}
              value={addTodoFolderId}
              onChange={(e) => setAddTodoFolderId(e.target.value)}
            >
              <option value="">Bez mapes</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
        </DialogBody>
        <DialogFooter>
          <button type="button" className={sharedStyles.smallBtn} onClick={() => setAddTodoOpen(false)}>
            Atcelt
          </button>
          <button
            type="button"
            className={sharedStyles.smallBtn}
            disabled={!addTodoText.trim()}
            onClick={handleAddTodo}
          >
            Pievienot
          </button>
        </DialogFooter>
      </Dialog>

      {/* ── Add folder dialog ── */}
      <Dialog open={addFolderOpen} title="Jauna mape" onClose={() => setAddFolderOpen(false)}>
        <DialogBody>
          <label className={dialogStyles.label}>
            Mapes nosaukums
            <input
              className={dialogStyles.input}
              value={addFolderName}
              onChange={(e) => setAddFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddFolder() }}
              autoFocus
            />
          </label>
        </DialogBody>
        <DialogFooter>
          <button type="button" className={sharedStyles.smallBtn} onClick={() => setAddFolderOpen(false)}>
            Atcelt
          </button>
          <button
            type="button"
            className={sharedStyles.smallBtn}
            disabled={!addFolderName.trim()}
            onClick={handleAddFolder}
          >
            Izveidot
          </button>
        </DialogFooter>
      </Dialog>

      {/* ── Rename folder dialog ── */}
      <Dialog open={renameFolderOpen} title="Pārdēvēt mapi" onClose={() => setRenameFolderOpen(false)}>
        <DialogBody>
          <label className={dialogStyles.label}>
            Jauns nosaukums
            <input
              className={dialogStyles.input}
              value={renameFolderValue}
              onChange={(e) => setRenameFolderValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder() }}
              autoFocus
            />
          </label>
        </DialogBody>
        <DialogFooter>
          <button type="button" className={sharedStyles.smallBtn} onClick={() => setRenameFolderOpen(false)}>
            Atcelt
          </button>
          <button
            type="button"
            className={sharedStyles.smallBtn}
            disabled={!renameFolderValue.trim()}
            onClick={handleRenameFolder}
          >
            Saglabāt
          </button>
        </DialogFooter>
      </Dialog>

      {/* ── Delete folder confirmation dialog ── */}
      <Dialog open={deleteFolderOpen} title="Dzēst mapi" onClose={() => setDeleteFolderOpen(false)}>
        <DialogBody>
          <p style={{ margin: 0 }}>
            Vai tiešām vēlies dzēst mapi <strong>{deleteFolderName}</strong>?
            Visi uzdevumi tiks pārvietoti uz &quot;Bez mapes&quot;.
          </p>
        </DialogBody>
        <DialogFooter>
          <button type="button" className={sharedStyles.smallBtn} onClick={() => setDeleteFolderOpen(false)}>
            Atcelt
          </button>
          <button
            type="button"
            className={`${sharedStyles.smallBtn} ${uiStyles.dangerBtn}`}
            onClick={handleDeleteFolder}
          >
            Dzēst
          </button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

export default TodoPage
