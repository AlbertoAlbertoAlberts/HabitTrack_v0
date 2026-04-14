import type {
  AppStateV1,
  DailyLeftMode,
  DailyViewMode,
  OverviewMode,
  OverviewRangeDays,
  OverviewSelection,
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

export function setOverviewRangeDays(state: AppStateV1, rangeDays: OverviewRangeDays): AppStateV1 {
  const normalized: OverviewRangeDays = rangeDays === 7 ? 7 : 30

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
  if (mode !== 'lab') {
    nextUi.overviewSelectedLabProjectId = null
    nextUi.overviewSelectedLabOutcomeId = null
  }

  // Reset multi-select when switching to modes that don't support it
  const multiSelectModes: OverviewMode[] = ['habit', 'lab', 'weekly']
  if (!multiSelectModes.includes(mode)) {
    nextUi.overviewMultiSelectCount = 1
    nextUi.overviewMultiSelections = []
  }

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
  const delta = state.uiState.overviewRangeDays * direction
  const nextEnd = addDays(state.uiState.overviewWindowEndDate, delta)
  return setOverviewWindowEndDate(state, nextEnd)
}

// ── Lab project selection ──

export function selectOverviewLabProject(state: AppStateV1, projectId: string | null, outcomeId?: string | null): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewMode: 'lab',
    overviewSelectedLabProjectId: projectId,
    overviewSelectedLabOutcomeId: outcomeId ?? null,
    overviewSelectedCategoryId: null,
    overviewSelectedHabitId: null,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

// ── Multi-select actions ──

export function setOverviewMultiSelectCount(state: AppStateV1, count: 1 | 2 | 3): AppStateV1 {
  const clamped: 1 | 2 | 3 = count === 2 ? 2 : count === 3 ? 3 : 1

  // Trim excess selections when reducing count
  const currentSelections = state.uiState.overviewMultiSelections
  const trimmed = currentSelections.slice(0, clamped)

  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewMultiSelectCount: clamped,
    overviewMultiSelections: trimmed,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function addOverviewSelection(state: AppStateV1, selection: OverviewSelection): AppStateV1 {
  const max = state.uiState.overviewMultiSelectCount
  const current = state.uiState.overviewMultiSelections

  // Check if already selected — if so, remove it (toggle)
  const existingIndex = current.findIndex(
    (s) => s.kind === selection.kind && s.id === selection.id && s.outcomeId === selection.outcomeId,
  )
  if (existingIndex >= 0) {
    return removeOverviewSelection(state, existingIndex)
  }

  let next: OverviewSelection[]
  if (current.length < max) {
    // Fill next empty slot
    next = [...current, selection]
  } else {
    // Replace the last slot
    next = [...current.slice(0, max - 1), selection]
  }

  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewMultiSelections: next,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function removeOverviewSelection(state: AppStateV1, index: number): AppStateV1 {
  const current = state.uiState.overviewMultiSelections
  if (index < 0 || index >= current.length) return state

  const next = [...current]
  next.splice(index, 1)

  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewMultiSelections: next,
  }

  return {
    ...state,
    uiState: nextUi,
  }
}

export function clearOverviewSelections(state: AppStateV1): AppStateV1 {
  const nextUi: UiStateV1 = {
    ...state.uiState,
    overviewMultiSelections: [],
  }

  return {
    ...state,
    uiState: nextUi,
  }
}
