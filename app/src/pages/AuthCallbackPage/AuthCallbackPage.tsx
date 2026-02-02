import {useEffect, useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'

import {getSupabaseClient} from '../../persistence/supabaseClient'

type Phase = 'idle' | 'exchanging' | 'signed-in' | 'error'

function readRedirectPath(): string {
  const raw = sessionStorage.getItem('habittrack.postAuthRedirect')
  sessionStorage.removeItem('habittrack.postAuthRedirect')
  if (!raw) return '/'
  if (!raw.startsWith('/')) return '/'
  return raw
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('idle')
  const [details, setDetails] = useState<string | null>(null)

  const urlError = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    const errorCode = params.get('error_code')
    const errorDescription = params.get('error_description')

    if (!error && !errorCode && !errorDescription) return null

    const parts = [errorCode, errorDescription, error].filter(Boolean)
    return parts.join(' — ')
  }, [])

  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setPhase('error')
      setDetails('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
      return
    }

    if (urlError) {
      setPhase('error')
      setDetails(urlError)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        setPhase('exchanging')

        // If this is a PKCE callback, Supabase returns ?code=...
        const hasCode = new URLSearchParams(window.location.search).has('code')
        if (hasCode) {
          const {error} = await supabase.auth.exchangeCodeForSession(window.location.href)
          if (error) {
            if (cancelled) return
            setPhase('error')
            setDetails(error.message)
            return
          }
        }

        // Whether code-based or implicit, ensure session is present.
        const {data, error} = await supabase.auth.getSession()
        if (error) {
          if (cancelled) return
          setPhase('error')
          setDetails(error.message)
          return
        }

        if (!data.session) {
          if (cancelled) return
          setPhase('error')
          setDetails('No session found after sign-in. Try requesting a new magic link and opening it immediately.')
          return
        }

        if (cancelled) return
        setPhase('signed-in')

        const nextPath = readRedirectPath()
        // Give the app a tick to process auth state listeners.
        window.setTimeout(() => navigate(nextPath, {replace: true}), 50)
      } catch (e) {
        if (cancelled) return
        setPhase('error')
        setDetails(e instanceof Error ? e.message : 'Auth callback failed.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [navigate, urlError])

  const title =
    phase === 'signed-in'
      ? 'Signed in'
      : phase === 'error'
        ? 'Sign-in failed'
        : phase === 'exchanging'
          ? 'Signing you in…'
          : 'Preparing…'

  return (
    <div style={{maxWidth: 560, margin: '0 auto', padding: '24px 16px'}}>
      <h1 style={{margin: 0, fontSize: 20}}>{title}</h1>
      <div style={{marginTop: 10, opacity: 0.85, lineHeight: 1.4}}>
        {phase === 'exchanging' ? 'Completing Supabase sign-in. This should only take a second.' : null}
        {phase === 'signed-in' ? 'Redirecting back to the app…' : null}
        {phase === 'error' ? (
          <>
            <div style={{marginTop: 8}}>Details:</div>
            <pre
              style={{
                marginTop: 8,
                padding: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {details ?? 'Unknown error'}
            </pre>
            <button
              type="button"
              onClick={() => navigate('/', {replace: true})}
              style={{marginTop: 12, padding: '10px 12px', borderRadius: 10}}
            >
              Back to app
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
