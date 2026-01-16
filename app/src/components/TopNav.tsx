import { NavLink } from 'react-router-dom'

import type { ThemeMode } from '../domain/types'
import { appStore } from '../domain/store/appStore'
import { useAppState } from '../domain/store/useAppStore'

import styles from './TopNav.module.css'

export function TopNav() {
  const themeMode = useAppState().uiState.themeMode

  function setMode(next: ThemeMode) {
    appStore.actions.setThemeMode(next)
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.brand}>HabitTrack</div>

        <nav className={styles.nav} aria-label="Primary">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
            }
          >
            Daily
          </NavLink>
          <NavLink
            to="/overview"
            className={({ isActive }) =>
              [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
            }
          >
            Overview
          </NavLink>
          <NavLink
            to="/archive"
            className={({ isActive }) =>
              [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
            }
          >
            Archive
          </NavLink>
        </nav>
      </div>

      <div className={styles.right}>
        <div className={styles.toggle} role="group" aria-label="Theme">
          <button
            type="button"
            className={[styles.toggleBtn, themeMode === 'system' ? styles.toggleBtnActive : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={themeMode === 'system'}
            onClick={() => setMode('system')}
          >
            Auto
          </button>
          <button
            type="button"
            className={[styles.toggleBtn, themeMode === 'light' ? styles.toggleBtnActive : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={themeMode === 'light'}
            onClick={() => setMode('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={[styles.toggleBtn, themeMode === 'dark' ? styles.toggleBtnActive : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={themeMode === 'dark'}
            onClick={() => setMode('dark')}
          >
            Dark
          </button>
        </div>
      </div>
    </header>
  )
}

export default TopNav
