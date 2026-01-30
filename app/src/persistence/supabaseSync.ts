import type { AppStateV1 } from '../domain/types'
import { repairState } from './storageService'
import { getSupabaseClient } from './supabaseClient'
import { appStore } from '../domain/store/appStore'

type AppStatesRow = {
  user_id: string
  schema_version: number
  state: AppStateV1
  saved_at: string
}

type SyncStatus = {
  configured: boolean
  signedIn: boolean
  userId: string | null
  email: string | null
  lastPulledAt: string | null
  lastPushedAt: string | null
  lastError: string | null
}

type SyncListener = () => void

let status: SyncStatus = {
  configured: false,
  signedIn: false,
  userId: null,
  email: null,
  lastPulledAt: null,
  lastPushedAt: null,
  lastError: null,
}

const listeners = new Set<SyncListener>()

function emit() {
  for (const l of listeners) l()
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  emit()
}

export function getSupabaseSyncStatus(): SyncStatus {
  return status
}

export function subscribeSupabaseSync(listener: SyncListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function forceSupabasePush(): Promise<void> {
  const s = status
  if (!s.configured || !s.signedIn || !s.userId) {
    setStatus({ lastError: 'Not signed in to Supabase.' })
    return
  }

  await upsertRemoteState(s.userId, appStore.getState())
}

let started = false
let suppressNextPush = false
let pushTimer: number | null = null
let lastPushedSavedAt: string | null = null

async function pullRemoteState(userId: string): Promise<AppStateV1 | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('app_states')
    .select('user_id, schema_version, state, saved_at')
    .eq('user_id', userId)
    .maybeSingle<AppStatesRow>()

  if (error) {
    setStatus({ lastError: error.message })
    return null
  }

  if (!data?.state) return null
  return data.state
}

async function upsertRemoteState(userId: string, state: AppStateV1): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const payload: AppStatesRow = {
    user_id: userId,
    schema_version: state.schemaVersion,
    state,
    saved_at: state.savedAt,
  }

  const { error } = await supabase.from('app_states').upsert(payload)
  if (error) {
    setStatus({ lastError: error.message })
    return
  }

  lastPushedSavedAt = state.savedAt
  setStatus({ lastPushedAt: new Date().toISOString(), lastError: null })
}

function schedulePush(userId: string) {
  if (pushTimer) window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(async () => {
    pushTimer = null
    if (suppressNextPush) {
      suppressNextPush = false
      return
    }

    const current = appStore.getState()
    if (lastPushedSavedAt && current.savedAt === lastPushedSavedAt) return

    await upsertRemoteState(userId, current)
  }, 900)
}

export function startSupabaseSync(): void {
  if (started) return
  started = true

  const supabase = getSupabaseClient()
  setStatus({ configured: Boolean(supabase) })
  if (!supabase) return

  ;(async () => {
    const { data } = await supabase.auth.getSession()
    const session = data.session

    if (session?.user) {
      setStatus({
        signedIn: true,
        userId: session.user.id,
        email: session.user.email ?? null,
      })

      const remote = await pullRemoteState(session.user.id)
      if (remote) {
        suppressNextPush = true
        appStore.hydrate(repairState(remote))
        setStatus({ lastPulledAt: new Date().toISOString(), lastError: null })
      } else {
        // First-time migration: push local state to Supabase.
        await upsertRemoteState(session.user.id, appStore.getState())
      }
    }
  })()

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      setStatus({ signedIn: false, userId: null, email: null })
      return
    }

    setStatus({ signedIn: true, userId: session.user.id, email: session.user.email ?? null })

    const remote = await pullRemoteState(session.user.id)
    if (remote) {
      suppressNextPush = true
      appStore.hydrate(repairState(remote))
      setStatus({ lastPulledAt: new Date().toISOString(), lastError: null })
    } else {
      await upsertRemoteState(session.user.id, appStore.getState())
    }
  })

  appStore.subscribe(() => {
    const s = status
    if (!s.configured || !s.signedIn || !s.userId) return
    schedulePush(s.userId)
  })
}
