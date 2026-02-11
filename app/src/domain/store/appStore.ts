import type {
  AppStateV1,
  CategoryId,
  HabitId,
  LocalDateString,
  Priority,
  Score,
  ThemeMode,
  TodoArchiveId,
  TodoFolderId,
  TodoId,
  TodoMode,
  TodoQuadrant,
  WeeklyTaskId,
  LabProjectId,
  LabProjectConfig,
  LabTagId,
  LabTagDef,
  ISODate,
  LabTagUse,
  LabLogId,
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
  setHabitScoreDay,
} from '../actions/habits'
import { getScoresForDate, setScore } from '../actions/dailyScores'
import { commitIfNeeded, isLocked } from '../actions/dayLocks'
import { addTodo, completeTodo, deleteTodo, renameTodo, reorderTodos, restoreTodo, setTodoFolder, setTodoQuadrant } from '../actions/todos'
import {
  addTodoFolder,
  deleteTodoFolder,
  renameTodoFolder,
  reorderTodoFolders,
} from '../actions/todoFolders'
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
import {
  addLabProject,
  updateLabProject,
  archiveLabProject,
  unarchiveLabProject,
  deleteLabProject,
  reorderLabProjects,
  setActiveLabProject,
} from '../lab/actions/labProjects'
import {
  addLabTag,
  updateLabTag,
  deleteLabTag,
  reorderLabTags,
  isLabTagInUse,
  validateLabTagIntensity,
} from '../lab/actions/labTags'
import { setLabDailyLog, deleteLabDailyLog } from '../lab/actions/labDailyLogs'
import {
  addLabEventLog,
  updateLabEventLog,
  deleteLabEventLog,
  setLabEventAbsenceMarker,
  removeLabEventAbsenceMarker,
} from '../lab/actions/labEventLogs'
import { updateFindingsCache } from '../lab/actions/labCache'
import { isLabDailyLogComplete } from '../utils/labValidation'
import type { FindingsCache } from '../lab/analysis/cache'

type Listener = () => void

let state: AppStateV1 = loadState()
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function setState(next: AppStateV1) {
  state = saveState(next)
  emit()
}

function hydrateState(next: AppStateV1) {
  // Hydrates (e.g., Supabase pull) should NOT manufacture a new savedAt.
  state = saveState(next, { preserveSavedAt: true })
  emit()
}

function setUiState(next: AppStateV1) {
  // UI-only changes should not affect sync ordering.
  state = saveState(next, { preserveSavedAt: true })
  emit()
}

export const appStore = {
  getState(): AppStateV1 {
    return state
  },

  hydrate(next: AppStateV1) {
    hydrateState(next)
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
    addHabit(categoryId: CategoryId, name: string, priority?: Priority, scoreDay?: 'same' | 'previous') {
      setState(addHabit(state, categoryId, name, priority, scoreDay))
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
    setHabitScoreDay(habitId: HabitId, scoreDay: 'same' | 'previous') {
      setState(setHabitScoreDay(state, habitId, scoreDay))
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
      setUiState(setSelectedDate(state, date))
    },
    setDailyViewMode(mode: 'category' | 'priority') {
      setUiState(setDailyViewMode(state, mode))
    },
    setDailyLeftMode(mode: 'normal' | 'reorder' | 'delete' | 'priorityEdit' | 'rename') {
      setUiState(setDailyLeftMode(state, mode))
    },

    setTodoMode(mode: TodoMode) {
      setUiState(setTodoMode(state, mode))
    },

    setThemeMode(themeMode: ThemeMode) {
      setUiState(setThemeMode(state, themeMode))
    },

    // Overview UI state
    setOverviewRangeDays(rangeDays: 7 | 30) {
      setUiState(setOverviewRangeDays(state, rangeDays))
    },
    shiftOverviewWindow(direction: -1 | 1) {
      setUiState(shiftOverviewWindow(state, direction))
    },
    setOverviewMode(mode: AppStateV1['uiState']['overviewMode']) {
      setUiState(setOverviewMode(state, mode))
    },
    selectOverviewCategory(categoryId: CategoryId | null) {
      setUiState(selectOverviewCategory(state, categoryId))
    },
    selectOverviewHabit(habitId: HabitId | null) {
      setUiState(selectOverviewHabit(state, habitId))
    },
    setOverviewWindowEndDate(date: LocalDateString) {
      setUiState(setOverviewWindowEndDate(state, date))
    },

    // Todos
    addTodo(text: string, folderId?: TodoFolderId) {
      setState(addTodo(state, text, folderId))
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
    setTodoFolder(todoId: TodoId, folderId: TodoFolderId | undefined) {
      setState(setTodoFolder(state, todoId, folderId))
    },
    setTodoQuadrant(todoId: TodoId, quadrant: TodoQuadrant | undefined) {
      setState(setTodoQuadrant(state, todoId, quadrant))
    },

    // Todo Folders
    addTodoFolder(name: string) {
      setState(addTodoFolder(state, name))
    },
    renameTodoFolder(folderId: TodoFolderId, name: string) {
      setState(renameTodoFolder(state, folderId, name))
    },
    deleteTodoFolder(folderId: TodoFolderId) {
      setState(deleteTodoFolder(state, folderId))
    },
    reorderTodoFolders(orderedIds: TodoFolderId[]) {
      setState(reorderTodoFolders(state, orderedIds))
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

    // LAB Projects
    addLabProject(name: string, mode: 'daily' | 'event', config: LabProjectConfig) {
      setState(addLabProject(state, name, mode, config))
    },
    updateLabProject(projectId: LabProjectId, updates: Partial<{ name: string; config: LabProjectConfig }>) {
      setState(updateLabProject(state, projectId, updates))
    },
    archiveLabProject(projectId: LabProjectId) {
      setState(archiveLabProject(state, projectId))
    },
    unarchiveLabProject(projectId: LabProjectId) {
      setState(unarchiveLabProject(state, projectId))
    },
    deleteLabProject(projectId: LabProjectId) {
      setState(deleteLabProject(state, projectId))
    },
    reorderLabProjects(orderedIds: LabProjectId[]) {
      setState(reorderLabProjects(state, orderedIds))
    },
    setActiveLabProject(projectId: LabProjectId | null) {
      setUiState(setActiveLabProject(state, projectId))
    },

    // LAB Tags
    addLabTag(projectId: LabProjectId, tagDef: Omit<LabTagDef, 'id' | 'createdAt' | 'updatedAt'>) {
      setState(addLabTag(state, projectId, tagDef))
    },
    updateLabTag(
      projectId: LabProjectId,
      tagId: LabTagId,
      updates: Partial<Omit<LabTagDef, 'id' | 'createdAt' | 'updatedAt'>>
    ) {
      setState(updateLabTag(state, projectId, tagId, updates))
    },
    deleteLabTag(projectId: LabProjectId, tagId: LabTagId, force?: boolean): boolean {
      const nextState = deleteLabTag(state, projectId, tagId, force)
      if (nextState === null) {
        return false // Blocked
      }
      setState(nextState)
      return true // Success
    },
    reorderLabTags(projectId: LabProjectId, orderedIds: LabTagId[]) {
      setState(reorderLabTags(state, projectId, orderedIds))
    },

    // LAB Daily Logs
    setLabDailyLog(
      projectId: LabProjectId,
      date: ISODate,
      data: { outcome?: number; tags: LabTagUse[]; noTags?: boolean; note?: string }
    ) {
      setState(setLabDailyLog(state, projectId, date, data))
    },
    deleteLabDailyLog(projectId: LabProjectId, date: ISODate) {
      setState(deleteLabDailyLog(state, projectId, date))
    },

    // LAB Event Logs
    addLabEventLog(
      projectId: LabProjectId,
      data: { timestamp: string; severity?: number; tags: LabTagUse[]; note?: string }
    ) {
      setState(addLabEventLog(state, projectId, data))
    },
    updateLabEventLog(
      projectId: LabProjectId,
      logId: LabLogId,
      data: { timestamp?: string; severity?: number; tags?: LabTagUse[]; note?: string }
    ) {
      setState(updateLabEventLog(state, projectId, logId, data))
    },
    deleteLabEventLog(projectId: LabProjectId, logId: LabLogId) {
      setState(deleteLabEventLog(state, projectId, logId))
    },
    setLabEventAbsenceMarker(projectId: LabProjectId, date: ISODate) {
      setState(setLabEventAbsenceMarker(state, projectId, date))
    },
    removeLabEventAbsenceMarker(projectId: LabProjectId, date: ISODate) {
      setState(removeLabEventAbsenceMarker(state, projectId, date))
    },

    // LAB Cache
    updateFindingsCache(updatedCache: Record<string, FindingsCache>) {
      setState(updateFindingsCache(state, updatedCache))
    },
  },

  selectors: {
    isLocked(date: LocalDateString): boolean {
      return isLocked(state, date)
    },
    getScoresForDate(date: LocalDateString) {
      return getScoresForDate(state, date)
    },

    // LAB selectors
    isLabTagInUse(projectId: LabProjectId, tagId: LabTagId): boolean {
      return isLabTagInUse(state, projectId, tagId)
    },
    validateLabTagIntensity(tagDef: LabTagDef, intensity: number | undefined) {
      return validateLabTagIntensity(tagDef, intensity)
    },
    isLabDailyLogComplete(projectId: LabProjectId, date: ISODate): boolean {
      const project = state.lab?.projects[projectId]
      const log = state.lab?.dailyLogsByProject[projectId]?.[date]
      if (!project || !log) return false
      return isLabDailyLogComplete(log, project)
    },
  },
}
