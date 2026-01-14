import { Navigate, Route, Routes } from 'react-router-dom'

import ArchivePage from './pages/ArchivePage/ArchivePage'
import DailyPage from './pages/DailyPage/DailyPage'
import OverviewPage from './pages/OverviewPage/OverviewPage'

export default function App() {
  return (
    <>
      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<DailyPage />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
