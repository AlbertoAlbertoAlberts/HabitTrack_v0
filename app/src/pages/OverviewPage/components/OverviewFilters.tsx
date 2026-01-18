import type { OverviewMode } from '../../../domain/types'
import { appStore } from '../../../domain/store/appStore'
import navButtonStyles from '../../DailyPage/components/LeftNavButtons.module.css'
import styles from './OverviewFilters.module.css'

type OverviewFiltersProps = {
  mode: OverviewMode
}

export function OverviewFilters({ mode }: OverviewFiltersProps) {
  return (
    <div>
      <h3 className={styles.panelTitle}>Filtrs</h3>
      <div className={styles.buttonInset}>
        <div className={styles.filtersGrid}>
          <button
            type="button"
            className={`${navButtonStyles.navBtn} ${mode === 'overall' ? navButtonStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('overall')}
          >
            Kopējais rezultāts
          </button>
          <button
            type="button"
            className={`${navButtonStyles.navBtn} ${mode === 'priority1' ? navButtonStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('priority1')}
          >
            Prioritāte 1
          </button>
          <button
            type="button"
            className={`${navButtonStyles.navBtn} ${mode === 'priority2' ? navButtonStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('priority2')}
          >
            Prioritāte 2
          </button>
          <button
            type="button"
            className={`${navButtonStyles.navBtn} ${mode === 'priority3' ? navButtonStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('priority3')}
          >
            Prioritāte 3
          </button>
          <button
            type="button"
            className={`${navButtonStyles.navBtn} ${mode === 'category' ? navButtonStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('category')}
          >
            Kategorija
          </button>
          <button
            type="button"
            className={`${navButtonStyles.navBtn} ${mode === 'habit' ? navButtonStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('habit')}
          >
            Atsevišķa sadaļa
          </button>
        </div>
      </div>
    </div>
  )
}
