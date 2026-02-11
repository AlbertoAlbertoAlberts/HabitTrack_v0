import type { AppStateV1, LabState } from '../../types'

/**
 * Create a minimal valid AppStateV1 for testing
 * Stubs out Habit Tracker fields and allows customizing LAB state
 */
export function createTestState(labState: Partial<LabState> = {}): AppStateV1 {
  const selectedDate = '2025-01-20'

  const defaultLabState: LabState = {
    version: 1,
    projects: {},
    projectOrder: [],
    tagsByProject: {},
    tagOrderByProject: {},
    dailyLogsByProject: {},
    eventLogsByProject: {},
    ...labState,
  }

  return {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    meta: {
      appVersion: 'test',
      createdAt: new Date().toISOString(),
    },
    categories: {},
    habits: {},
    weeklyTasks: {},
    dailyScores: {},
    weeklyProgress: {},
    weeklyCompletionDays: {},
    dayLocks: {},
    todos: {},
    todoArchive: {},
    todoFolders: {},
    uiState: {
      dailyViewMode: 'category',
      selectedDate,
      themeMode: 'system',
      overviewRangeDays: 30,
      overviewMode: 'overall',
      overviewSelectedCategoryId: null,
      overviewSelectedHabitId: null,
      overviewWindowEndDate: selectedDate,
      dailyLeftMode: 'normal',
      todoMode: 'normal',
    },
    lab: defaultLabState,
  }
}
