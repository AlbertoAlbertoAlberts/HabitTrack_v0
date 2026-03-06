import type { OverviewMode } from '../../../domain/types'
import { appStore } from '../../../domain/store/appStore'
import sharedStyles from '../../../components/ui/shared.module.css'
import styles from './OverviewFilters.module.css'

const MULTI_SELECT_MODES: OverviewMode[] = ['habit', 'lab', 'weekly']

type OverviewFiltersProps = {
  mode: OverviewMode
  multiSelectCount: 1 | 2 | 3
}

export function OverviewFilters({ mode, multiSelectCount }: OverviewFiltersProps) {
  const showToggle = MULTI_SELECT_MODES.includes(mode)

  return (
    <div>
      <h3 className={styles.panelTitle}>Filtrs</h3>

      {showToggle && (
        <div className={styles.toggleRow}>
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.toggleBtn} ${multiSelectCount === n ? styles.toggleBtnActive : ''}`}
              onClick={() => appStore.actions.setOverviewMultiSelectCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
      )}

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
          <button
            type="button"
            className={`${sharedStyles.navBtn} ${mode === 'lab' ? sharedStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('lab')}
          >
            Lab
          </button>
          <button
            type="button"
            className={`${sharedStyles.navBtn} ${mode === 'weekly' ? sharedStyles.navBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewMode('weekly')}
          >
            Nedēļa
          </button>
        </div>
      </div>
    </div>
  )
}
