import type { OverviewMode, Category, Habit } from '../../../domain/types'
import { appStore } from '../../../domain/store/appStore'
import sharedStyles from '../../../components/ui/shared.module.css'
import styles from './OverviewSelectionList.module.css'

type OverviewSelectionListProps = {
  mode: OverviewMode
  categories: Category[]
  habits: Habit[]
  categoryNameById: Map<string, string>
  selectedCategoryId: string | null
  selectedHabitId: string | null
}

export function OverviewSelectionList({
  mode,
  categories,
  habits,
  categoryNameById,
  selectedCategoryId,
  selectedHabitId,
}: OverviewSelectionListProps) {
  const showCategoryList = mode === 'category'
  const showHabitList = mode === 'habit'

  return (
    <section className={sharedStyles.panel}>
      <h3 className={styles.panelTitle}>Atlase</h3>

      {showCategoryList ? (
        <>
          <p className={styles.muted} style={{ marginTop: 0 }}>
            Izvēlies kategoriju
          </p>
          <div className={styles.list}>
            {categories.map((c) => {
              const active = selectedCategoryId === c.id
              return (
                <div
                  key={c.id}
                  className={`${styles.listItem} ${active ? styles.listItemActive : ''}`}
                  onClick={() => appStore.actions.selectOverviewCategory(active ? null : c.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={styles.itemTitle}>{c.name}</span>
                </div>
              )
            })}
            {categories.length === 0 ? <p className={styles.muted}>Nav kategoriju.</p> : null}
          </div>
        </>
      ) : null}

      {showHabitList ? (
        <>
          <p className={styles.muted} style={{ marginTop: 0 }}>
            Izvēlies ieradumu
          </p>
          <div className={styles.list}>
            {habits.map((h) => {
              const active = selectedHabitId === h.id
              const catName = categoryNameById.get(h.categoryId) ?? '—'
              return (
                <div
                  key={h.id}
                  className={`${styles.listItem} ${active ? styles.listItemActive : ''}`}
                  onClick={() => appStore.actions.selectOverviewHabit(active ? null : h.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={styles.muted}>{catName}</span>
                  <span className={styles.itemTitle}> - {h.name}</span>
                </div>
              )
            })}
            {habits.length === 0 ? <p className={styles.muted}>Nav ieradumu.</p> : null}
          </div>
        </>
      ) : (
        !showCategoryList && (
          <p className={styles.muted} style={{ marginTop: 0 }}>
            Atlase pieejama režīmos "Kategorija" un "Ieradums".
          </p>
        )
      )}
    </section>
  )
}
