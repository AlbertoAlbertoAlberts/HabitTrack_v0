import type { AppStateV1 } from '../../types'
import type { FindingsCache } from '../analysis/cache'

/**
 * Update findings cache for a project
 * Called after analysis runs to persist results
 */
export function updateFindingsCache(
  state: AppStateV1,
  updatedCache: Record<string, FindingsCache>
): AppStateV1 {
  if (!state.lab) return state

  return {
    ...state,
    lab: {
      ...state.lab,
      findingsCache: updatedCache,
    },
  }
}
