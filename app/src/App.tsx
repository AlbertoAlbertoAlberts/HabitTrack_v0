import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import TopNav from './components/TopNav'
import ArchivePage from './pages/ArchivePage/ArchivePage'
import AuthCallbackPage from './pages/AuthCallbackPage/AuthCallbackPage'
import DailyPage from './pages/DailyPage/DailyPage'
import LabPage from './pages/LabPage/LabPage'
import OverviewPage from './pages/OverviewPage/OverviewPage'

import { useAppState } from './domain/store/useAppStore'

export default function App() {
  const themeMode = useAppState().uiState.themeMode
  const location = useLocation()
  const navigate = useNavigate()

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
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/" element={<DailyPage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
