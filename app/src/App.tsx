import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import TopNav from './components/TopNav'
import ArchivePage from './pages/ArchivePage/ArchivePage'
import AuthCallbackPage from './pages/AuthCallbackPage/AuthCallbackPage'
import DailyPage from './pages/DailyPage/DailyPage'
import LabPage from './pages/LabPage/LabPage'
import OverviewPage from './pages/OverviewPage/OverviewPage'
import TodoPage from './pages/TodoPage/TodoPage'

import { useAppState } from './domain/store/useAppStore'
import { getSupabaseSyncStatus, subscribeSupabaseSync } from './persistence/supabaseSync'
import { useState } from 'react'

export default function App() {
  const themeMode = useAppState().uiState.themeMode
  const location = useLocation()
  const navigate = useNavigate()
  const [syncStatus, setSyncStatus] = useState(getSupabaseSyncStatus())

  useEffect(() => subscribeSupabaseSync(() => setSyncStatus(getSupabaseSyncStatus())), [])

  // Supabase links sometimes land on `/` (site URL) instead of the desired callback route.
  // If auth parameters are present, route to `/auth/callback` while preserving URL state.
  useEffect(() => {
    if (location.pathname === '/auth/callback') return

    const searchParams = new URLSearchParams(window.location.search)
    const hasCode = searchParams.has('code')
    const hasUrlError =
      searchParams.has('error') ||
      searchParams.has('error_code') ||
      searchParams.has('error_description')

    const rawHash = window.location.hash.replace(/^#/, '')
    const hashParams = rawHash ? new URLSearchParams(rawHash) : null
    const hasHashTokens =
      Boolean(rawHash) &&
      (rawHash.includes('access_token=') ||
        rawHash.includes('refresh_token=') ||
        hashParams?.has('type') ||
        hashParams?.has('token_hash'))

    if (!hasCode && !hasUrlError && !hasHashTokens) return

    navigate(`/auth/callback${window.location.search}${window.location.hash}`, {replace: true})
  }, [location.pathname, navigate])

  useEffect(() => {
    const el = document.documentElement
    if (themeMode === 'system') {
      el.removeAttribute('data-theme')
    } else {
      el.setAttribute('data-theme', themeMode)
    }
  }, [themeMode])

  return (
    <>
      <TopNav />
      <main>
        {syncStatus.configured && location.pathname !== '/auth/callback' ? (
          syncStatus.authChecked ? (
            syncStatus.signedIn ? (
              <Routes>
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/" element={<DailyPage />} />
                <Route path="/todo" element={<TodoPage />} />
                <Route path="/lab" element={<LabPage />} />
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/archive" element={<ArchivePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            ) : (
              <div style={{ maxWidth: 560, margin: '0 auto', padding: '22px 16px', opacity: 0.9 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>Signed out</h2>
                <p style={{ marginTop: 10, lineHeight: 1.4 }}>
                  Sign in using <strong>Sync</strong> in the top-right to view your data.
                </p>
              </div>
            )
          ) : (
            <div style={{ maxWidth: 560, margin: '0 auto', padding: '22px 16px', opacity: 0.9 }}>
              Checking sign-in…
            </div>
          )
        ) : (
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/" element={<DailyPage />} />
            <Route path="/todo" element={<TodoPage />} />
            <Route path="/lab" element={<LabPage />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </>
  )
}
