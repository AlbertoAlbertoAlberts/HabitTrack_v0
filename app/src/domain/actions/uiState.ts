import type {
  AppStateV1,
  DailyLeftMode,
  DailyViewMode,
  OverviewMode,
  OverviewRangeDays,
  LocalDateString,
  ThemeMode,
  TodoMode,
  UiStateV1,
} from '../types'

import { addDays, todayLocalDateString } from '../utils/localDate'

export function setSelectedDate(state: AppStateV1, date: LocalDateString): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    selectedDate: date,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function setDailyViewMode(state: AppStateV1, mode: DailyViewMode): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    dailyViewMode: mode,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function setDailyLeftMode(state: AppStateV1, mode: DailyLeftMode): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    dailyLeftMode: mode,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function setTodoMode(state: AppStateV1, mode: TodoMode): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    todoMode: mode,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function setThemeMode(state: AppStateV1, themeMode: ThemeMode): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    themeMode,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function setOverviewRangeDays(state: AppStateV1): AppStateV1 {
  // Overview is week-based only (Monday–Sunday).
  const normalized: OverviewRangeDays = 7

  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewRangeDays: normalized,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function setOverviewMode(state: AppStateV1, mode: OverviewMode): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewMode: mode,
  }

  // Enforce exclusivity: only keep selections when relevant.
  if (mode !== 'category') nextUi.overviewSelectedCategoryId = null
  if (mode !== 'habit') nextUi.overviewSelectedHabitId = null

  return {
    ...state,
    uiState: nextUi,
  }
}

export function selectOverviewCategory(state: AppStateV1, categoryId: string | null): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewMode: 'category',
    overviewSelectedCategoryId: categoryId,
    overviewSelectedHabitId: null,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function selectOverviewHabit(state: AppStateV1, habitId: string | null): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewMode: 'habit',
    overviewSelectedHabitId: habitId,
    overviewSelectedCategoryId: null,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function setOverviewWindowEndDate(state: AppStateV1, endDate: LocalDateString): AppStateV1 {
  const today = todayLocalDateString()
  const clamped = endDate > today ? today : endDate

  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewWindowEndDate: clamped,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function shiftOverviewWindow(state: AppStateV1, direction: -1 | 1): AppStateV1 {
  // Overview is week-based only (Monday–Sunday).
  const delta = 7 * direction
  const nextEnd = addDays(state.uiState.overviewWindowEndDate, delta)
  return setOverviewWindowEndDate(state, nextEnd)
}
