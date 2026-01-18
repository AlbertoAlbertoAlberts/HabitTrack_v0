import { NavLink } from 'react-router-dom'

import type { DailyViewMode } from '../../../domain/types'

import styles from '../../../components/ui/shared.module.css'

interface LeftNavButtonsProps {
  activeMode: DailyViewMode
  onModeChange: (mode: DailyViewMode) => void
}

export function LeftNavButtons({ activeMode, onModeChange }: LeftNavButtonsProps) {
  return (
    <div className={styles.leftNav}>
      <NavLink
        to="/overview"
        className={({ isActive }) => `${styles.navBtn} ${isActive ? styles.navBtnActive : ''}`}
      >
        PĀRSKATS
      </NavLink>
      <button
        type="button"
        className={`${styles.navBtn} ${activeMode === 'category' ? styles.navBtnActive : ''}`}
        onClick={() => onModeChange('category')}
        aria-pressed={activeMode === 'category'}
      >
        KATEGORIJA
      </button>
      <button
        type="button"
        className={`${styles.navBtn} ${activeMode === 'priority' ? styles.navBtnActive : ''}`}
        onClick={() => onModeChange('priority')}
        aria-pressed={activeMode === 'priority'}
      >
        PRIORITĀTE
      </button>
    </div>
  )
}
