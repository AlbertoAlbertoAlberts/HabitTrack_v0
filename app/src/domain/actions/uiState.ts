import type { AppStateV1, DailyViewMode, LocalDateString, UiStateV1 } from '../types'

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
