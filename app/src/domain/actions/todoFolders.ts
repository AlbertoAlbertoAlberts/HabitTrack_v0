import type {
  AppStateV1,
  IsoTimestamp,
  TodoFolder,
  TodoFolderId,
} from '../types'

function nowIso(): IsoTimestamp {
  return new Date().toISOString()
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}`
}

function normalizeFolderSortIndex(
  folders: Record<TodoFolderId, TodoFolder>,
): Record<TodoFolderId, TodoFolder> {
  const list = Object.values(folders)
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex)

  const normalized: Record<TodoFolderId, TodoFolder> = {}
  list.forEach((f, idx) => {
    normalized[f.id] = { ...f, sortIndex: idx }
  })
  return normalized
}

export function addTodoFolder(state: AppStateV1, name: string): AppStateV1 {
  const trimmed = name.trim()
  if (!trimmed) return state

  const createdAt = nowIso()
  const id = newId()

  const folder: TodoFolder = {
    id,
    name: trimmed,
    sortIndex: Object.keys(state.todoFolders).length,
    createdAt,
    updatedAt: createdAt,
  }

  return {
    ...state,
    todoFolders: {
      ...state.todoFolders,
      [id]: folder,
    },
  }
}

export function renameTodoFolder(
  state: AppStateV1,
  folderId: TodoFolderId,
  name: string,
): AppStateV1 {
  const folder = state.todoFolders[folderId]
  if (!folder) return state
  const trimmed = name.trim()
  if (!trimmed) return state

  return {
    ...state,
    todoFolders: {
      ...state.todoFolders,
      [folderId]: {
        ...folder,
        name: trimmed,
        updatedAt: nowIso(),
      },
    },
  }
}

export function deleteTodoFolder(
  state: AppStateV1,
  folderId: TodoFolderId,
): AppStateV1 {
  if (!state.todoFolders[folderId]) return state

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [folderId]: _, ...remainingFolders } = state.todoFolders

  // Move all todos in this folder to "no folder" (folderId → undefined)
  const updatedTodos = { ...state.todos }
  for (const [todoId, todo] of Object.entries(updatedTodos)) {
    if (todo.folderId === folderId) {
      updatedTodos[todoId] = { ...todo, folderId: undefined, updatedAt: nowIso() }
    }
  }

  return {
    ...state,
    todoFolders: normalizeFolderSortIndex(remainingFolders),
    todos: updatedTodos,
  }
}

export function reorderTodoFolders(
  state: AppStateV1,
  orderedIds: TodoFolderId[],
): AppStateV1 {
  if (orderedIds.length === 0) return state

  const nextFolders: Record<TodoFolderId, TodoFolder> = { ...state.todoFolders }
  let changed = false

  orderedIds.forEach((id, idx) => {
    const f = nextFolders[id]
    if (!f) return
    if (f.sortIndex !== idx) changed = true
    nextFolders[id] = { ...f, sortIndex: idx }
  })

  if (!changed) return state

  return {
    ...state,
    todoFolders: normalizeFolderSortIndex(nextFolders),
  }
}
