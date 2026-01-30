import type { AppStateV1 } from '../domain/types'
import { repairState, wasBootstrappedFromEmptyState } from './storageService'
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

const REQUEST_TIMEOUT_MS = 10_000

async function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timeoutId: number | null = null
  const promise = Promise.resolve(promiseLike as unknown as T)
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId)
  }
}

async function pullRemoteRow(userId: string): Promise<AppStatesRow | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  let data: AppStatesRow | null = null
  let error: { message: string } | null = null

  try {
    ;({ data, error } = await withTimeout(
      supabase
        .from('app_states')
        .select('user_id, schema_version, state, saved_at')
        .eq('user_id', userId)
        .maybeSingle<AppStatesRow>(),
      REQUEST_TIMEOUT_MS,
      'Supabase pull',
    ))
  } catch (e) {
    setStatus({ lastError: e instanceof Error ? e.message : 'Supabase pull failed.' })
    return null
  }

  if (error) {
    setStatus({ lastError: error.message })
    return null
  }

  return data
}

async function reconcileRemoteLocal(userId: string): Promise<void> {
  const local = appStore.getState()
  const remoteRow = await pullRemoteRow(userId)

  if (!remoteRow?.state) {
    // First-time migration: push local state to Supabase.
    await upsertRemoteState(userId, local)
    return
  }

  // If this browser started from an empty localStorage (new device/incognito),
  // prefer remote to avoid treating a freshly-created default state as authoritative.
  if (wasBootstrappedFromEmptyState()) {
    suppressNextPush = true
    appStore.hydrate(repairState(remoteRow.state))
    setStatus({ lastPulledAt: new Date().toISOString(), lastError: null })
    return
  }

  // Prefer comparing the canonical savedAt values.
  const remoteSavedAt = remoteRow.state.savedAt || remoteRow.saved_at
  const localSavedAt = local.savedAt

  // If local is newer (or equal), keep local and push it up.
  // This avoids losing recent local edits if a stale remote pull happens.
  if (localSavedAt >= remoteSavedAt) {
    if (localSavedAt > remoteSavedAt) {
      await upsertRemoteState(userId, local)
    }
    return
  }

  // Remote is newer → hydrate local from remote.
  suppressNextPush = true
  appStore.hydrate(repairState(remoteRow.state))
  setStatus({ lastPulledAt: new Date().toISOString(), lastError: null })
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

  try {
    const result = await withTimeout(
      supabase.from('app_states').upsert(payload, { onConflict: 'user_id' }),
      REQUEST_TIMEOUT_MS,
      'Supabase push',
    )
    const error = (result as { error?: { message: string } | null }).error
    if (error) {
      setStatus({ lastError: error.message })
      return
    }
  } catch (e) {
    setStatus({ lastError: e instanceof Error ? e.message : 'Supabase push failed.' })
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

      await reconcileRemoteLocal(session.user.id)
    }
  })()

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session?.user) {
      setStatus({ signedIn: false, userId: null, email: null })
      return
    }

    setStatus({ signedIn: true, userId: session.user.id, email: session.user.email ?? null })

    // Avoid re-pulling and overwriting local edits on token refresh.
    if (event === 'TOKEN_REFRESHED') return

    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      await reconcileRemoteLocal(session.user.id)
      return
    }
  })

  appStore.subscribe(() => {
    const s = status
    if (!s.configured || !s.signedIn || !s.userId) return
    schedulePush(s.userId)
  })
}
