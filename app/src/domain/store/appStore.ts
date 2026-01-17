import type {
  AppStateV1,
  CategoryId,
  HabitId,
  LocalDateString,
  Priority,
  Score,
  ThemeMode,
  TodoArchiveId,
  TodoId,
  TodoMode,
  WeeklyTaskId,
} from '../types'

import { loadState, saveState } from '../../persistence/storageService'
import { addCategory, deleteCategory, reorderCategories } from '../actions/categories'
import { renameCategory } from '../actions/categories'
import {
  addHabit,
  deleteHabit,
  moveHabit,
  reorderHabits,
  setHabitPriority,
  setHabitPriorityValue,
  repositionHabitAfterPriorityChange,
  renameHabit,
} from '../actions/habits'
import { getScoresForDate, setScore } from '../actions/dailyScores'
import { commitIfNeeded, isLocked } from '../actions/dayLocks'
import { addTodo, completeTodo, deleteTodo, renameTodo, reorderTodos, restoreTodo } from '../actions/todos'
import {
  addWeeklyTask,
  adjustWeeklyCompletionForDate,
  deleteWeeklyTask,
  renameWeeklyTask,
  reorderWeeklyTasks,
  setWeeklyTaskTargetPerWeek,
} from '../actions/weeklyTasks'
import {
  selectOverviewCategory,
  selectOverviewHabit,
  setDailyLeftMode,
  setDailyViewMode,
  setOverviewMode,
  setOverviewRangeDays,
  setOverviewWindowEndDate,
  setSelectedDate,
  setThemeMode,
  setTodoMode,
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
    renameCategory(categoryId: CategoryId, name: string) {
      setState(renameCategory(state, categoryId, name))
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
    renameHabit(habitId: HabitId, name: string) {
      setState(renameHabit(state, habitId, name))
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
    setDailyLeftMode(mode: 'normal' | 'reorder' | 'delete' | 'priorityEdit' | 'rename') {
      setState(setDailyLeftMode(state, mode))
    },

    setTodoMode(mode: TodoMode) {
      setState(setTodoMode(state, mode))
    },

    setThemeMode(themeMode: ThemeMode) {
      setState(setThemeMode(state, themeMode))
    },

    // Overview UI state
    setOverviewRangeDays() {
      setState(setOverviewRangeDays(state))
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
    renameTodo(todoId: TodoId, text: string) {
      setState(renameTodo(state, todoId, text))
    },
    reorderTodos(orderedTodoIds: TodoId[]) {
      setState(reorderTodos(state, orderedTodoIds))
    },

    // Weekly tasks (not locked)
    addWeeklyTask(name: string, targetPerWeek?: number) {
      setState(addWeeklyTask(state, name, targetPerWeek))
    },
    deleteWeeklyTask(weeklyTaskId: WeeklyTaskId) {
      setState(deleteWeeklyTask(state, weeklyTaskId))
    },
    renameWeeklyTask(weeklyTaskId: WeeklyTaskId, name: string) {
      setState(renameWeeklyTask(state, weeklyTaskId, name))
    },
    setWeeklyTaskTargetPerWeek(weeklyTaskId: WeeklyTaskId, targetPerWeek: number) {
      setState(setWeeklyTaskTargetPerWeek(state, weeklyTaskId, targetPerWeek))
    },
    reorderWeeklyTasks(orderedWeeklyTaskIds: WeeklyTaskId[]) {
      setState(reorderWeeklyTasks(state, orderedWeeklyTaskIds))
    },
    adjustWeeklyCompletionForDate(
      weekStartDate: LocalDateString,
      date: LocalDateString,
      weeklyTaskId: WeeklyTaskId,
      delta: 1 | -1,
    ) {
      setState(adjustWeeklyCompletionForDate(state, weekStartDate, date, weeklyTaskId, delta))
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
