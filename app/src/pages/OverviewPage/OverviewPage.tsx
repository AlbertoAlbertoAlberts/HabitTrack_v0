import { Link } from 'react-router-dom'

import { appStore } from '../../domain/store/appStore'
import { todayLocalDateString } from '../../domain/utils/localDate'
import { getWeeklyTaskTargetPerWeekForWeekStart } from '../../domain/utils/weeklyTaskTarget'
import { OverviewChart } from './components/OverviewChart'
import { OverviewFilters } from './components/OverviewFilters'
import { OverviewSelectionList } from './components/OverviewSelectionList'
import { useOverviewData } from './hooks/useOverviewData'

import sharedStyles from '../../components/ui/shared.module.css'
import styles from './OverviewPage.module.css'
import navButtonStyles from '../DailyPage/components/LeftNavButtons.module.css'

function formatDateLabel(date: string): string {
  // Input is YYYY-MM-DD (local). Display as DD.MM.YYYY.
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date)
  if (!m) return date
  return `${m[3]}.${m[2]}.${m[1]}`
}

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : min
  return Math.max(min, Math.min(max, n))
}

export function OverviewPage() {
  const {
    startDate,
    endDate,
    rangeDays,
    mode,
    selectedCategoryId,
    selectedHabitId,
    weeklyTasks,
    overviewWeekStart,
    overviewWeekEnd,
    weeklyPoints,
    currentWeekStart,
    categories,
    habits,
    categoryNameById,
    series,
    yMax,
    totalPct,
    avgPct,
    maxPossibleEnd,
    activeHabitsEnd,
  } = useOverviewData()

  return (
    <div className={sharedStyles.page}>
      <div className={styles.overviewLayout}>
        <main className={styles.mainCol}>
          <section className={sharedStyles.panel}>
          <div className={styles.overviewHeader}>
            <h2 className={styles.panelTitle} style={{ margin: 0 }}>
              PĀRSKATS
            </h2>

            <div className={styles.windowNav}>
              <button type="button" className={sharedStyles.smallBtn} onClick={() => appStore.actions.shiftOverviewWindow(-1)}>
                ←
              </button>
              <span className={styles.dateRangeLabel}>
                {formatDateLabel(startDate)} → {formatDateLabel(endDate)}
              </span>
              <button type="button" className={sharedStyles.smallBtn} onClick={() => appStore.actions.shiftOverviewWindow(1)}>
                →
              </button>
            </div>

            <div aria-hidden />
          </div>

          <OverviewChart series={series} yMax={yMax} />

          <div className={styles.legend}>
            <span className={styles.kpi}>
              <strong>Kopā</strong>: {Math.round(totalPct * 100)}%
            </span>
            <span className={styles.kpi}>
              <strong>Vidēji</strong>: {Math.round(avgPct * 100)}%
            </span>
            <span className={styles.kpi}>
              <strong>Maks.</strong>: {maxPossibleEnd}
            </span>
            <span className={styles.kpi}>
              <strong>Ieradumi</strong>: {activeHabitsEnd}
            </span>
          </div>
          </section>

          <OverviewSelectionList
            mode={mode}
            categories={categories}
            habits={habits}
            categoryNameById={categoryNameById}
            selectedCategoryId={selectedCategoryId}
            selectedHabitId={selectedHabitId}
          />
        </main>

        <aside className={styles.leftCol}>
          <section className={`${sharedStyles.panel} ${styles.sidebarPanel}`} aria-label="Pārskata sānu sadaļa">
            <div className={navButtonStyles.leftNav}>
              <Link
                to="/"
                className={navButtonStyles.navBtn}
                onClick={() => {
                  appStore.actions.setSelectedDate(todayLocalDateString())
                }}
              >
                SĀKUMA LAPA
              </Link>

              <button
                type="button"
                className={`${navButtonStyles.navBtn} ${rangeDays === 7 ? navButtonStyles.navBtnActive : ''}`}
                onClick={() => appStore.actions.setOverviewRangeDays(7)}
              >
                7 dienas
              </button>
              <button
                type="button"
                className={`${navButtonStyles.navBtn} ${rangeDays === 30 ? navButtonStyles.navBtnActive : ''}`}
                onClick={() => appStore.actions.setOverviewRangeDays(30)}
              >
                30 dienas
              </button>
            </div>

            <div className={styles.sidebarStack}>

              <div className={styles.weeklyPanel} aria-label="Nedēļas punkti">
                <div className={styles.weeklyHeader}>
                  <h3 className={styles.panelTitle} style={{ margin: 0 }}>
                    Nedēļa
                  </h3>
                  <div className={styles.weeklyRange}>
                    {formatDateLabel(overviewWeekStart)}–{formatDateLabel(overviewWeekEnd)}
                  </div>
                </div>

                {weeklyTasks.length === 0 ? (
                  <p className={styles.muted} style={{ margin: 0 }}>
                    Nav nedēļas uzdevumu.
                  </p>
                ) : (
                  <>
                    <div className={styles.weeklySummaryRow}>
                      <div className={styles.progressBar} aria-hidden>
                        <div
                          className={styles.progressFill}
                          style={{
                            width:
                              weeklyPoints.max > 0
                                ? `${Math.round((weeklyPoints.earned / weeklyPoints.max) * 100)}%`
                                : '0%',
                          }}
                        />
                      </div>

                      <div className={styles.pointsText}>
                        {weeklyPoints.earned} / {weeklyPoints.max}
                      </div>
                    </div>

                    <div className={styles.weeklyTaskBreakdown}>
                      {weeklyPoints.perTask.map(({ task, earned }) => (
                        <div key={task.id} className={styles.weeklyTaskRow}>
                          <span className={styles.weeklyTaskName} title={task.name}>
                            {task.name}
                          </span>
                          <span className={styles.muted}>
                            {earned}/{clampInt(getWeeklyTaskTargetPerWeekForWeekStart(task, overviewWeekStart, currentWeekStart), 1, 7)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <hr className={styles.sidebarDivider} />

              <OverviewFilters mode={mode} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default OverviewPage
