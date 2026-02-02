import { useEffect, useMemo, useState } from 'react'

import { Dialog, DialogBody, DialogFooter, dialogStyles } from './ui/Dialog'
import navStyles from './TopNav.module.css'
import { getSupabaseClient, isSupabaseConfigured } from '../persistence/supabaseClient'
import {
  forceSupabasePull,
  forceSupabasePush,
  getConflictPolicyForUi,
  getSupabaseSyncStatus,
  setConflictPolicy,
  subscribeSupabaseSync,
} from '../persistence/supabaseSync'

export function SupabaseSyncControl() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState(getSupabaseSyncStatus())
  const [conflictPolicy, setConflictPolicyState] = useState(getConflictPolicyForUi())

  useEffect(() => subscribeSupabaseSync(() => setStatus(getSupabaseSyncStatus())), [])

  const configured = isSupabaseConfigured()

  const supabaseHost = useMemo(() => {
    const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
    if (!raw) return null
    try {
      return new URL(raw).host
    } catch {
      return raw
    }
  }, [])

  const label = useMemo(() => {
    if (!configured) return 'Sync'
    if (!status.signedIn) return 'Sync'
    return status.email ? `Synced: ${status.email}` : 'Synced'
  }, [configured, status.signedIn, status.email])

  async function sendMagicLink() {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setMessage('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }

    const trimmed = email.trim()
    if (!trimmed) {
      setMessage('Enter your email address.')
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      // Remember where the user was so the callback can return there.
      sessionStorage.setItem('habittrack.postAuthRedirect', window.location.pathname + window.location.search)

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Magic link sent. Check your inbox and open the link on this device.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    const supabase = getSupabaseClient()
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function forcePushNow() {
    setBusy(true)
    setMessage(null)
    try {
      await forceSupabasePush()
    } finally {
      setBusy(false)
    }
  }

  async function forcePullNow() {
    setBusy(true)
    setMessage(null)
    try {
      await forceSupabasePull()
    } finally {
      setBusy(false)
    }
  }

  function formatTime(value: string | null): string {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }

  async function copyDebugInfo() {
    const info = {
      supabaseHost,
      signedIn: status.signedIn,
      email: status.email,
      userId: status.userId,
      lastPulledAt: status.lastPulledAt,
      lastPushedAt: status.lastPushedAt,
      lastError: status.lastError,
      conflict: status.conflict,
      conflictPolicy,
      page: window.location.href,
    }

    const text = JSON.stringify(info, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Copied debug info to clipboard.')
    } catch {
      setMessage(text)
    }
  }

  return (
    <>
      <button
        type="button"
        className={[navStyles.toggleBtn, status.signedIn ? navStyles.toggleBtnActive : ''].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
        title={configured ? 'Supabase sync' : 'Supabase not configured'}
      >
        {label}
      </button>

      <Dialog open={open} title="Supabase Sync" onClose={() => setOpen(false)}>
        <DialogBody>
          {!configured ? (
            <div className={dialogStyles.hint}>
              Supabase env vars are missing. Create <strong>app/.env.local</strong> with
              <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12 }}>
                VITE_SUPABASE_URL=...<br />
                VITE_SUPABASE_ANON_KEY=...
              </div>
            </div>
          ) : status.signedIn ? (
            <div className={dialogStyles.hint}>
              Signed in{status.email ? ` as ${status.email}` : ''}. Changes sync automatically.

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                {supabaseHost ? (
                  <>
                    Supabase: {supabaseHost}
                    <br />
                  </>
                ) : null}
                User id: {status.userId ?? '—'}
                <br />
                Last pulled: {formatTime(status.lastPulledAt)}
                <br />
                Last pushed: {formatTime(status.lastPushedAt)}
              </div>

              {status.lastError ? (
                <div style={{ marginTop: 8, color: 'var(--danger)' }}>Last sync error: {status.lastError}</div>
              ) : null}

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
                Conflict policy:{' '}
                <select
                  value={conflictPolicy}
                  onChange={(e) => {
                    const v = e.target.value === 'manual' ? 'manual' : 'last-write-wins'
                    setConflictPolicy(v)
                    setConflictPolicyState(v)
                  }}
                  style={{ marginLeft: 6 }}
                >
                  <option value="last-write-wins">Auto (last write wins)</option>
                  <option value="manual">Manual (ask on conflicts)</option>
                </select>
                <div style={{ marginTop: 6 }}>
                  Auto mode avoids pull/push prompts but can overwrite near-simultaneous edits.
                </div>
              </div>

              {status.conflict ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: 'var(--danger)' }}>Sync needs a decision.</div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
                    This device’s local data looks newer than what’s in Supabase.
                    <br />
                    Local savedAt: {formatTime(status.conflict.localSavedAt)}
                    <br />
                    Supabase savedAt: {formatTime(status.conflict.remoteSavedAt)}
                    <br />
                    To avoid accidentally overwriting Supabase, automatic push is paused.
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className={dialogStyles.btn} onClick={forcePullNow} disabled={busy}>
                      Use Supabase data (pull)
                    </button>
                    <button type="button" className={dialogStyles.btn} onClick={forcePushNow} disabled={busy}>
                      Overwrite Supabase (push)
                    </button>
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: 12 }}>
                <button type="button" className={dialogStyles.btn} onClick={copyDebugInfo} disabled={busy}>
                  Copy debug info
                </button>
              </div>
            </div>
          ) : (
            <div className={dialogStyles.row}>
              <label className={dialogStyles.label}>
                Email
                <input
                  className={dialogStyles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  inputMode="email"
                  autoComplete="email"
                />
              </label>
              <div className={dialogStyles.hint}>
                We’ll email you a magic link. Opening it signs this device in and enables sync.
              </div>
            </div>
          )}

          {message ? <div className={dialogStyles.hint}>{message}</div> : null}
        </DialogBody>

        <DialogFooter>
          {status.signedIn ? (
            <>
              <button type="button" className={dialogStyles.btn} onClick={() => setOpen(false)} disabled={busy}>
                Close
              </button>
              <button type="button" className={dialogStyles.btn} onClick={forcePullNow} disabled={busy}>
                Force pull now
              </button>
              <button type="button" className={dialogStyles.btn} onClick={forcePushNow} disabled={busy}>
                Force push now
              </button>
              <button type="button" className={dialogStyles.btn} onClick={signOut} disabled={busy}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button type="button" className={dialogStyles.btn} onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button
                type="button"
                className={[dialogStyles.btn, dialogStyles.btnPrimary].join(' ')}
                onClick={sendMagicLink}
                disabled={busy || !configured}
              >
                Send magic link
              </button>
            </>
          )}
        </DialogFooter>
      </Dialog>
    </>
  )
}

export default SupabaseSyncControl
