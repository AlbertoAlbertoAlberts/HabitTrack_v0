import type { AppStateV1 } from '../domain/types'
import { repairState, wasBootstrappedFromEmptyState } from './storageService'
import { getSupabaseClient } from './supabaseClient'
import { appStore } from '../domain/store/appStore'

const PREFER_REMOTE_KEY = 'habitTracker.sync.preferRemoteOnLogin'

function getPreferRemoteOnLogin(): boolean {
  try {
    return window.localStorage.getItem(PREFER_REMOTE_KEY) === 'true'
  } catch {
    return false
  }
}

function setPreferRemoteOnLogin(value: boolean): void {
  try {
    window.localStorage.setItem(PREFER_REMOTE_KEY, value ? 'true' : 'false')
  } catch {
    // ignore
  }
}

function isEffectivelyEmptyState(state: AppStateV1): boolean {
  const hasCoreData =
    Object.keys(state.categories).length > 0 ||
    Object.keys(state.habits).length > 0 ||
    Object.keys(state.todos).length > 0 ||
    Object.keys(state.weeklyTasks).length > 0

  if (hasCoreData) return false

  const labProjects = state.lab?.projects ? Object.keys(state.lab.projects).length : 0
  return labProjects === 0
}

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
  conflict: {
    kind: 'local-newer-than-remote'
    localSavedAt: string
    remoteSavedAt: string
  } | null
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
  conflict: null,
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
  readyToPush = true
}

export async function forceSupabasePull(): Promise<void> {
  const s = status
  if (!s.configured || !s.signedIn || !s.userId) {
    setStatus({ lastError: 'Not signed in to Supabase.' })
    return
  }

  let remoteRow: AppStatesRow | null = null
  try {
    remoteRow = await pullRemoteRow(s.userId)
  } catch {
    return
  }

  if (!remoteRow?.state) {
    setStatus({ lastError: 'No Supabase state found for this user yet.' })
    return
  }

  suppressNextPush = true
  appStore.hydrate(repairState(remoteRow.state))
  setStatus({ lastPulledAt: new Date().toISOString(), lastError: null, conflict: null })
  readyToPush = true
  setPreferRemoteOnLogin(true)
}

let started = false
let suppressNextPush = false
let pushTimer: number | null = null
let lastPushedSavedAt: string | null = null
let readyToPush = false
let activeUserId: string | null = null

let realtimeCleanup: (() => void) | null = null
let pollCleanup: (() => void) | null = null

const REQUEST_TIMEOUT_MS = 10_000

const PUSH_DEBOUNCE_MS = 150
const POLL_INTERVAL_MS = 5_000
const FOCUS_THROTTLE_MS = 2_500

const CONFLICT_POLICY_KEY = 'habitTracker.sync.conflictPolicy'
type ConflictPolicy = 'manual' | 'last-write-wins'

function getConflictPolicy(): ConflictPolicy {
  try {
    const v = window.localStorage.getItem(CONFLICT_POLICY_KEY)
    if (v === 'manual' || v === 'last-write-wins') return v
  } catch {
    // ignore
  }
  // Default to last-write-wins to match expected "it just syncs" behavior.
  return 'last-write-wins'
}

export function setConflictPolicy(policy: ConflictPolicy): void {
  try {
    window.localStorage.setItem(CONFLICT_POLICY_KEY, policy)
  } catch {
    // ignore
  }
}

export function getConflictPolicyForUi(): ConflictPolicy {
  return getConflictPolicy()
}

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
    const message = e instanceof Error ? e.message : 'Supabase pull failed.'
    setStatus({ lastError: message })
    throw new Error(message)
  }

  if (error) {
    setStatus({ lastError: error.message })
    throw new Error(error.message)
  }

  return data
}

function shouldHydrateFromRemote(remoteSavedAt: string): boolean {
  const localSavedAt = appStore.getState().savedAt
  const localMs = Date.parse(localSavedAt)
  const remoteMs = Date.parse(remoteSavedAt)
  const safeLocalMs = Number.isFinite(localMs) ? localMs : 0
  const safeRemoteMs = Number.isFinite(remoteMs) ? remoteMs : 0
  return safeRemoteMs > safeLocalMs
}

async function pullAndHydrateIfNewer(userId: string, reason: string): Promise<void> {
  // If the user has an unresolved conflict (local newer), don't auto-hydrate.
  if (status.conflict) return

  let remoteRow: AppStatesRow | null = null
  try {
    remoteRow = await pullRemoteRow(userId)
  } catch {
    return
  }

  if (!remoteRow?.state) return

  const remoteSavedAt = remoteRow.state.savedAt || remoteRow.saved_at
  if (lastPushedSavedAt && remoteSavedAt === lastPushedSavedAt) {
    // Likely our own write echoed back.
    return
  }

  if (!shouldHydrateFromRemote(remoteSavedAt)) return

  suppressNextPush = true
  appStore.hydrate(repairState(remoteRow.state))
  setStatus({ lastPulledAt: new Date().toISOString(), lastError: null, conflict: null })
  readyToPush = true
  setPreferRemoteOnLogin(true)

  // Helpful breadcrumb when debugging.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[supabaseSync] hydrated from remote (${reason})`)
  }
}

function startRealtimeForUser(userId: string): () => void {
  const supabase = getSupabaseClient()
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`app_states:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_states',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const next = (payload as { new?: { saved_at?: string } | null }).new
        const nextSavedAt = typeof next?.saved_at === 'string' ? next.saved_at : null
        if (nextSavedAt && lastPushedSavedAt && nextSavedAt === lastPushedSavedAt) return
        await pullAndHydrateIfNewer(userId, 'realtime')
      },
    )
    .subscribe()

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch {
      // ignore
    }
  }
}

function startPollForUser(userId: string): () => void {
  let disposed = false
  let lastFocusPullAt = 0

  async function maybePull(reason: string) {
    if (disposed) return
    const now = Date.now()
    if (reason !== 'poll') {
      if (now - lastFocusPullAt < FOCUS_THROTTLE_MS) return
      lastFocusPullAt = now
    }
    await pullAndHydrateIfNewer(userId, reason)
  }

  const onFocus = () => {
    void maybePull('focus')
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      void maybePull('visible')
    }
  }

  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisibility)

  const intervalId = window.setInterval(() => {
    void maybePull('poll')
  }, POLL_INTERVAL_MS)

  return () => {
    disposed = true
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibility)
    window.clearInterval(intervalId)
  }
}

async function reconcileRemoteLocal(userId: string): Promise<void> {
  const local = appStore.getState()
  let remoteRow: AppStatesRow | null = null
  try {
    remoteRow = await pullRemoteRow(userId)
  } catch {
    // If we can't reach Supabase right now, do NOT push local (would overwrite remote).
    readyToPush = false
    return
  }

  if (!remoteRow?.state) {
    // First-time migration: push local state to Supabase.
    await upsertRemoteState(userId, local)
    readyToPush = true
    return
  }

  // If this browser started from an empty localStorage (new device/incognito),
  // prefer remote to avoid treating a freshly-created default state as authoritative.
  if (wasBootstrappedFromEmptyState()) {
    suppressNextPush = true
    appStore.hydrate(repairState(remoteRow.state))
    setStatus({ lastPulledAt: new Date().toISOString(), lastError: null })
    readyToPush = true
    setPreferRemoteOnLogin(true)
    return
  }

  // Prefer comparing the canonical savedAt values.
  const remoteSavedAt = remoteRow.state.savedAt || remoteRow.saved_at
  const localSavedAt = local.savedAt

  const localMs = Date.parse(localSavedAt)
  const remoteMs = Date.parse(remoteSavedAt)
  const safeLocalMs = Number.isFinite(localMs) ? localMs : 0
  const safeRemoteMs = Number.isFinite(remoteMs) ? remoteMs : 0

  // If local is newer than remote, DO NOT silently overwrite Supabase.
  // This situation often happens in dev (dummy seed updates local savedAt) or on a device
  // with edits that haven't been migrated intentionally.
  // Instead, keep local and require an explicit user choice to push or pull.
  if (safeLocalMs > safeRemoteMs) {
    // Common case: local is just an empty cache state (or the user previously chose remote).
    // In these cases we can safely auto-hydrate remote to achieve the expected "log in and see data" UX.
    if (getPreferRemoteOnLogin() || isEffectivelyEmptyState(local)) {
      suppressNextPush = true
      appStore.hydrate(repairState(remoteRow.state))
      setStatus({ lastPulledAt: new Date().toISOString(), lastError: null, conflict: null })
      readyToPush = true
      setPreferRemoteOnLogin(true)
      return
    }

    // Auto-resolve conflicts for a single-user app: last write wins.
    // This prevents multi-tab/device edits from getting stuck requiring manual pull/push.
    if (getConflictPolicy() === 'last-write-wins') {
      await upsertRemoteState(userId, local)
      readyToPush = true
      setStatus({ conflict: null })
      return
    }

    setStatus({
      conflict: {
        kind: 'local-newer-than-remote',
        localSavedAt,
        remoteSavedAt,
      },
    })
    readyToPush = false
    return
  }

  // Equal timestamps: treat as in sync.
  if (safeLocalMs === safeRemoteMs) {
    setStatus({ conflict: null })
    readyToPush = true
    return
  }

  // Remote is newer → hydrate local from remote.
  suppressNextPush = true
  appStore.hydrate(repairState(remoteRow.state))
  setStatus({ lastPulledAt: new Date().toISOString(), lastError: null, conflict: null })
  readyToPush = true
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
  setStatus({ lastPushedAt: new Date().toISOString(), lastError: null, conflict: null })
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
  }, PUSH_DEBOUNCE_MS)
}

export function startSupabaseSync(): void {
  if (started) return
  started = true

  const supabase = getSupabaseClient()
  setStatus({ configured: Boolean(supabase) })
  if (!supabase) return

  readyToPush = false
  activeUserId = null

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

      if (activeUserId !== session.user.id) {
        realtimeCleanup?.()
        pollCleanup?.()
        activeUserId = session.user.id
        realtimeCleanup = startRealtimeForUser(session.user.id)
        pollCleanup = startPollForUser(session.user.id)
      }
    }
  })()

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session?.user) {
      setStatus({ signedIn: false, userId: null, email: null, conflict: null })
      readyToPush = false
      activeUserId = null
      realtimeCleanup?.()
      realtimeCleanup = null
      pollCleanup?.()
      pollCleanup = null
      return
    }

    setStatus({ signedIn: true, userId: session.user.id, email: session.user.email ?? null })

    // Avoid re-pulling and overwriting local edits on token refresh.
    if (event === 'TOKEN_REFRESHED') return

    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      await reconcileRemoteLocal(session.user.id)

      if (activeUserId !== session.user.id) {
        realtimeCleanup?.()
        pollCleanup?.()
        activeUserId = session.user.id
        realtimeCleanup = startRealtimeForUser(session.user.id)
        pollCleanup = startPollForUser(session.user.id)
      }
      return
    }
  })

  appStore.subscribe(() => {
    const s = status
    if (!s.configured || !s.signedIn || !s.userId) return
    if (!readyToPush) return
    if (s.conflict) return
    schedulePush(s.userId)
  })
}
