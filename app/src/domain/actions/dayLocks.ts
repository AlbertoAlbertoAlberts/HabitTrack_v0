import type { AppStateV1, LocalDateString } from '../types'

export function isLocked(state: AppStateV1, date: LocalDateString): boolean {
  void state
  void date
  // All days are editable.
  return false
}

export function commitIfNeeded(state: AppStateV1, date: LocalDateString): AppStateV1 {
  void date
  // No-op: we no longer lock days on leave.
  return state
}
