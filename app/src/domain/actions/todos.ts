import type {
  AppStateV1,
  IsoTimestamp,
  TodoArchiveId,
  TodoArchiveItem,
  TodoId,
  TodoItem,
} from '../types'

function nowIso(): IsoTimestamp {
  return new Date().toISOString()
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}`
}

function normalizeTodoSortIndex(todos: Record<TodoId, TodoItem>): Record<TodoId, TodoItem> {
  const list = Object.values(todos)
    .slice()
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))

  const normalized: Record<TodoId, TodoItem> = {}
  list.forEach((t, idx) => {
    normalized[t.id] = { ...t, sortIndex: idx }
  })
  return normalized
}

export function addTodo(state: AppStateV1, text: string): AppStateV1 {
  const createdAt = nowIso()
  const id = newId()

  const todo: TodoItem = {
    id,
    text,
    sortIndex: Object.keys(state.todos).length,
    createdAt,
    updatedAt: createdAt,
  }

  return {
    ...state,
    todos: {
      ...state.todos,
      [id]: todo,
    },
  }
}

export function deleteTodo(state: AppStateV1, todoId: TodoId): AppStateV1 {
  if (!state.todos[todoId]) return state
  const { [todoId]: _deleted, ...rest } = state.todos

  return {
    ...state,
    todos: normalizeTodoSortIndex(rest),
  }
}

export function completeTodo(state: AppStateV1, todoId: TodoId): AppStateV1 {
  const todo = state.todos[todoId]
  if (!todo) return state

  const completedAt = nowIso()
  const archiveId = newId() as TodoArchiveId

  const archive: TodoArchiveItem = {
    id: archiveId,
    text: todo.text,
    completedAt,
    restoredAt: null,
  }

  const { [todoId]: _deleted, ...remainingTodos } = state.todos

  return {
    ...state,
    todos: normalizeTodoSortIndex(remainingTodos),
    todoArchive: {
      ...state.todoArchive,
      [archiveId]: archive,
    },
  }
}

export function restoreTodo(state: AppStateV1, archiveId: TodoArchiveId): AppStateV1 {
  const archived = state.todoArchive[archiveId]
  if (!archived) return state
  if (archived.restoredAt) return state

  const restoredAt = nowIso()
  const newTodoId = newId() as TodoId

  const createdAt = restoredAt
  const todo: TodoItem = {
    id: newTodoId,
    text: archived.text,
    sortIndex: Object.keys(state.todos).length,
    createdAt,
    updatedAt: createdAt,
  }

  return {
    ...state,
    todos: {
      ...state.todos,
      [newTodoId]: todo,
    },
    todoArchive: {
      ...state.todoArchive,
      [archiveId]: {
        ...archived,
        restoredAt,
      },
    },
  }
}

export function renameTodo(state: AppStateV1, todoId: TodoId, text: string): AppStateV1 {
  const todo = state.todos[todoId]
  if (!todo) return state
  const nextText = text.trim()
  if (!nextText) return state

  const updatedAt = nowIso()

  return {
    ...state,
    todos: {
      ...state.todos,
      [todoId]: {
        ...todo,
        text: nextText,
        updatedAt,
      },
    },
  }
}

export function reorderTodos(state: AppStateV1, orderedTodoIds: TodoId[]): AppStateV1 {
  if (orderedTodoIds.length === 0) return state

  const nextTodos: Record<TodoId, TodoItem> = { ...state.todos }
  let changed = false

  orderedTodoIds.forEach((id, idx) => {
    const t = nextTodos[id]
    if (!t) return
    if ((t.sortIndex ?? 0) !== idx) changed = true
    nextTodos[id] = { ...t, sortIndex: idx }
  })

  if (!changed) return state

  return {
    ...state,
    todos: normalizeTodoSortIndex(nextTodos),
  }
}
