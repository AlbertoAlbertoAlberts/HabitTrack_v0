import { useEffect, useMemo, useState } from 'react'

import { Dialog, DialogBody, DialogFooter, dialogStyles } from './ui/Dialog'
import navStyles from './TopNav.module.css'
import { getSupabaseClient, isSupabaseConfigured } from '../persistence/supabaseClient'
import { forceSupabasePush, getSupabaseSyncStatus, subscribeSupabaseSync } from '../persistence/supabaseSync'

export function SupabaseSyncControl() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState(getSupabaseSyncStatus())

  useEffect(() => subscribeSupabaseSync(() => setStatus(getSupabaseSyncStatus())), [])

  const configured = isSupabaseConfigured()

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
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: window.location.origin,
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

  function formatTime(value: string | null): string {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
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
                Last pulled: {formatTime(status.lastPulledAt)}
                <br />
                Last pushed: {formatTime(status.lastPushedAt)}
              </div>

              {status.lastError ? (
                <div style={{ marginTop: 8, color: 'var(--danger)' }}>Last sync error: {status.lastError}</div>
              ) : null}
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
