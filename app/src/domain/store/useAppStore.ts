import { useSyncExternalStore } from 'react'

import type { AppStateV1 } from '../types'
import { appStore } from './appStore'

export function useAppState(): AppStateV1 {
  return useSyncExternalStore(appStore.subscribe, appStore.getState, appStore.getState)
}
