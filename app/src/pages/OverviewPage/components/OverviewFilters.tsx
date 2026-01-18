import type { OverviewMode } from '../../../domain/types'
import { appStore } from '../../../domain/store/appStore'
import sharedStyles from '../../../components/ui/shared.module.css'
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
            className={`${sharedStyles.navBtn} ${mode === 'overall' ? sharedStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('overall')}
          >
            Kopējais rezultāts
          </button>
          <button
            type="button"
            className={`${sharedStyles.navBtn} ${mode === 'priority1' ? sharedStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('priority1')}
          >
            Prioritāte 1
          </button>
          <button
            type="button"
            className={`${sharedStyles.navBtn} ${mode === 'priority2' ? sharedStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('priority2')}
          >
            Prioritāte 2
          </button>
          <button
            type="button"
            className={`${sharedStyles.navBtn} ${mode === 'priority3' ? sharedStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('priority3')}
          >
            Prioritāte 3
          </button>
          <button
            type="button"
            className={`${sharedStyles.navBtn} ${mode === 'category' ? sharedStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('category')}
          >
            Kategorija
          </button>
          <button
            type="button"
            className={`${sharedStyles.navBtn} ${mode === 'habit' ? sharedStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('habit')}
          >
            Atsevišķa sadaļa
          </button>
        </div>
      </div>
    </div>
  )
}
