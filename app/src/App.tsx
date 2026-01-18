import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import TopNav from './components/TopNav'
import ArchivePage from './pages/ArchivePage/ArchivePage'
import DailyPage from './pages/DailyPage/DailyPage'
import LabPage from './pages/LabPage/LabPage'
import OverviewPage from './pages/OverviewPage/OverviewPage'

import { useAppState } from './domain/store/useAppStore'

export default function App() {
  const themeMode = useAppState().uiState.themeMode

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
