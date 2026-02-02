import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { seedMorningDummyIfNeeded } from './domain/lab/seed/morningDummySeed'
import { startSupabaseSync } from './persistence/supabaseSync'
import { isSupabaseConfigured } from './persistence/supabaseClient'

if (import.meta.env.DEV) {
  // In dev, seed sample LAB data only when Supabase sync isn't configured.
  // This avoids incognito/new-device sessions getting a fresh "dummy" state that then conflicts with remote.
  if (!isSupabaseConfigured()) {
    seedMorningDummyIfNeeded()
  }
}

startSupabaseSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
