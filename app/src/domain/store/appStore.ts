import type {
  AppStateV1,
  CategoryId,
  HabitId,
  LocalDateString,
  Priority,
  Score,
  TodoArchiveId,
  TodoId,
} from '../types'

import { loadState, saveState } from '../../persistence/storageService'
import { addCategory, deleteCategory, reorderCategories } from '../actions/categories'
import {
  addHabit,
  deleteHabit,
  moveHabit,
  reorderHabits,
  setHabitPriority,
  setHabitPriorityValue,
  repositionHabitAfterPriorityChange,
} from '../actions/habits'
import { getScoresForDate, setScore } from '../actions/dailyScores'
import { commitIfNeeded, isLocked } from '../actions/dayLocks'
import { addTodo, completeTodo, deleteTodo, restoreTodo } from '../actions/todos'
import {
  selectOverviewCategory,
  selectOverviewHabit,
  setDailyLeftMode,
  setDailyViewMode,
  setOverviewMode,
  setOverviewRangeDays,
  setOverviewWindowEndDate,
  setSelectedDate,
  shiftOverviewWindow,
} from '../actions/uiState'

type Listener = () => void

let state: AppStateV1 = loadState()
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function setState(next: AppStateV1) {
  state = next
  saveState(state)
  emit()
}

export const appStore = {
  getState(): AppStateV1 {
    return state
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  actions: {
    // Categories
    addCategory(name: string) {
      setState(addCategory(state, name))
    },
    deleteCategory(categoryId: CategoryId) {
      setState(deleteCategory(state, categoryId))
    },
    reorderCategories(orderedIds: CategoryId[]) {
      setState(reorderCategories(state, orderedIds))
    },

    // Habits
    addHabit(categoryId: CategoryId, name: string, priority?: Priority) {
      setState(addHabit(state, categoryId, name, priority))
    },
    deleteHabit(habitId: HabitId) {
      setState(deleteHabit(state, habitId))
    },
    reorderHabits(categoryId: CategoryId, orderedHabitIds: HabitId[]) {
      setState(reorderHabits(state, categoryId, orderedHabitIds))
    },
    moveHabit(habitId: HabitId, targetCategoryId: CategoryId, targetIndex?: number) {
      setState(moveHabit(state, habitId, targetCategoryId, targetIndex))
    },
    setHabitPriority(habitId: HabitId, newPriority: Priority) {
      setState(setHabitPriority(state, habitId, newPriority))
    },
    setHabitPriorityValue(habitId: HabitId, newPriority: Priority) {
      setState(setHabitPriorityValue(state, habitId, newPriority))
    },
    repositionHabitAfterPriorityChange(habitId: HabitId) {
      setState(repositionHabitAfterPriorityChange(state, habitId))
    },

    // Daily scores
    setScore(date: LocalDateString, habitId: HabitId, score: Score) {
      setState(setScore(state, date, habitId, score))
    },

    // Day locks
    commitIfNeeded(date: LocalDateString) {
      setState(commitIfNeeded(state, date))
    },

    // UI state
    setSelectedDate(date: LocalDateString) {
      setState(setSelectedDate(state, date))
    },
    setDailyViewMode(mode: 'category' | 'priority') {
      setState(setDailyViewMode(state, mode))
    },
    setDailyLeftMode(mode: 'normal' | 'reorder' | 'delete' | 'priorityEdit') {
      setState(setDailyLeftMode(state, mode))
    },

    // Overview UI state
    setOverviewRangeDays(rangeDays: 7 | 30) {
      setState(setOverviewRangeDays(state, rangeDays))
    },
    shiftOverviewWindow(direction: -1 | 1) {
      setState(shiftOverviewWindow(state, direction))
    },
    setOverviewMode(mode: AppStateV1['uiState']['overviewMode']) {
      setState(setOverviewMode(state, mode))
    },
    selectOverviewCategory(categoryId: CategoryId | null) {
      setState(selectOverviewCategory(state, categoryId))
    },
    selectOverviewHabit(habitId: HabitId | null) {
      setState(selectOverviewHabit(state, habitId))
    },
    setOverviewWindowEndDate(date: LocalDateString) {
      setState(setOverviewWindowEndDate(state, date))
    },

    // Todos
    addTodo(text: string) {
      setState(addTodo(state, text))
    },
    deleteTodo(todoId: TodoId) {
      setState(deleteTodo(state, todoId))
    },
    completeTodo(todoId: TodoId) {
      setState(completeTodo(state, todoId))
    },
    restoreTodo(archiveId: TodoArchiveId) {
      setState(restoreTodo(state, archiveId))
    },
  },

  selectors: {
    isLocked(date: LocalDateString): boolean {
      return isLocked(state, date)
    },
    getScoresForDate(date: LocalDateString) {
      return getScoresForDate(state, date)
    },
  },
}
