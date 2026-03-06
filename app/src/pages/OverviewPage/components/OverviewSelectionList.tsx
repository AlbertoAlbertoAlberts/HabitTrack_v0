import type { OverviewMode, OverviewSelection, Category, Habit, LabProject } from '../../../domain/types'
import { appStore } from '../../../domain/store/appStore'
import sharedStyles from '../../../components/ui/shared.module.css'
import styles from './OverviewSelectionList.module.css'

const SLOT_COLORS = ['#ffffff', '#06b6d4', '#d946ef'] as const

type OverviewSelectionListProps = {
  mode: OverviewMode
  categories: Category[]
  habits: Habit[]
  categoryNameById: Map<string, string>
  selectedCategoryId: string | null
  selectedHabitId: string | null
  labProjects: LabProject[]
  selectedLabProjectId: string | null
  multiSelectCount: 1 | 2 | 3
  multiSelections: OverviewSelection[]
}

function getSlotColorIndex(id: string, kind: string, selections: OverviewSelection[]): number | null {
  const idx = selections.findIndex((s) => s.kind === kind && s.id === id)
  return idx >= 0 ? idx : null
}

export function OverviewSelectionList({
  mode,
  categories,
  habits,
  categoryNameById,
  selectedCategoryId,
  selectedHabitId,
  labProjects,
  selectedLabProjectId,
  multiSelectCount,
  multiSelections,
}: OverviewSelectionListProps) {
  const isMulti = multiSelectCount > 1
  const showCategoryList = mode === 'category'
  const showHabitList = mode === 'habit' || (isMulti && (mode === 'habit' || mode === 'lab' || mode === 'weekly'))
  const showLabList = mode === 'lab' || (isMulti && (mode === 'habit' || mode === 'lab' || mode === 'weekly'))
  const showWeeklyEntry = isMulti && (mode === 'habit' || mode === 'lab' || mode === 'weekly')

  // In multi-select, clicking adds/removes from selections
  function handleMultiClick(kind: OverviewSelection['kind'], id?: string) {
    appStore.actions.addOverviewSelection({ kind, id })
  }

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
          {!isMulti && (
            <p className={styles.muted} style={{ marginTop: 0 }}>Izvēlies ieradumu</p>
          )}
          {isMulti && (
            <p className={styles.muted} style={{ marginTop: 0 }}>Ieradumi</p>
          )}
          <div className={styles.list}>
            {habits.map((h) => {
              const catName = categoryNameById.get(h.categoryId) ?? '—'
              if (isMulti) {
                const slotIdx = getSlotColorIndex(h.id, 'habit', multiSelections)
                const selected = slotIdx !== null
                return (
                  <div
                    key={h.id}
                    className={`${styles.listItem} ${selected ? styles.listItemActive : ''}`}
                    onClick={() => handleMultiClick('habit', h.id)}
                    role="button"
                    tabIndex={0}
                    style={selected ? { borderColor: SLOT_COLORS[slotIdx] } : undefined}
                  >
                    {selected && (
                      <span className={styles.slotDot} style={{ background: SLOT_COLORS[slotIdx] }} />
                    )}
                    <span className={styles.muted}>{catName}</span>
                    <span className={styles.itemTitle}> - {h.name}</span>
                  </div>
                )
              }
              const active = selectedHabitId === h.id
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
      ) : null}

      {showLabList ? (
        <>
          {!isMulti && (
            <p className={styles.muted} style={{ marginTop: 0 }}>Izvēlies Lab projektu</p>
          )}
          {isMulti && (
            <p className={styles.muted} style={{ marginTop: 0 }}>Lab projekti</p>
          )}
          <div className={styles.list}>
            {labProjects.map((p) => {
              const badge = p.mode === 'daily' ? 'D' : 'E'
              const multiKind = p.mode === 'daily' ? 'labDaily' : 'labEvent'
              if (isMulti) {
                const slotIdx = getSlotColorIndex(p.id, multiKind, multiSelections)
                const selected = slotIdx !== null
                return (
                  <div
                    key={p.id}
                    className={`${styles.listItem} ${selected ? styles.listItemActive : ''}`}
                    onClick={() => handleMultiClick(multiKind, p.id)}
                    role="button"
                    tabIndex={0}
                    style={selected ? { borderColor: SLOT_COLORS[slotIdx] } : undefined}
                  >
                    {selected && (
                      <span className={styles.slotDot} style={{ background: SLOT_COLORS[slotIdx] }} />
                    )}
                    <span className={styles.modeBadge}>{badge}</span>
                    <span className={styles.itemTitle}>{p.name}</span>
                  </div>
                )
              }
              const active = selectedLabProjectId === p.id
              return (
                <div
                  key={p.id}
                  className={`${styles.listItem} ${active ? styles.listItemActive : ''}`}
                  onClick={() => appStore.actions.selectOverviewLabProject(active ? null : p.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className={styles.modeBadge}>{badge}</span>
                  <span className={styles.itemTitle}>{p.name}</span>
                </div>
              )
            })}
            {labProjects.length === 0 ? <p className={styles.muted}>Nav Lab projektu.</p> : null}
          </div>
        </>
      ) : null}

      {showWeeklyEntry && (() => {
        const selected = multiSelections.some((s) => s.kind === 'weekly')
        const actualIdx = selected ? multiSelections.findIndex((s) => s.kind === 'weekly') : null
        return (
          <>
            <p className={styles.muted} style={{ marginTop: 0 }}>Nedēļa</p>
            <div className={styles.list}>
              <div
                className={`${styles.listItem} ${selected ? styles.listItemActive : ''}`}
                onClick={() => handleMultiClick('weekly')}
                role="button"
                tabIndex={0}
                style={selected && actualIdx !== null ? { borderColor: SLOT_COLORS[actualIdx] } : undefined}
              >
                {selected && actualIdx !== null && (
                  <span className={styles.slotDot} style={{ background: SLOT_COLORS[actualIdx] }} />
                )}
                <span className={styles.itemTitle}>Nedēļas rezultāts</span>
              </div>
            </div>
          </>
        )
      })()}

      {!showCategoryList && !showHabitList && !showLabList && !showWeeklyEntry && mode !== 'weekly' && (
        <p className={styles.muted} style={{ marginTop: 0 }}>
          Atlase pieejama režīmos "Kategorija", "Ieradums" un "Lab".
        </p>
      )}

      {mode === 'weekly' && !isMulti && (
        <p className={styles.muted} style={{ marginTop: 0 }}>
          Nedēļas rezultāts tiek rādīts grafikā automātiski.
        </p>
      )}
    </section>
  )
}
