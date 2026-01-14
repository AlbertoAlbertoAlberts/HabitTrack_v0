import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { appStore } from '../../domain/store/appStore'
import { useAppState } from '../../domain/store/useAppStore'
import { addDays } from '../../domain/utils/localDate'
import type { Habit, LocalDateString, OverviewMode, Score } from '../../domain/types'

import styles from './OverviewPage.module.css'

type ChartPoint = { date: LocalDateString; value: number }

function formatDateLabel(date: LocalDateString): string {
  // Input is YYYY-MM-DD (local). Display as DD.MM.YYYY.
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date)
  if (!m) return date
  return `${m[3]}.${m[2]}.${m[1]}`
}

function clampMin(value: number, min: number): number {
  return value < min ? min : value
}

function getHabitIdsForMode(
  mode: OverviewMode,
  habits: Habit[],
  selectedCategoryId: string | null,
  selectedHabitId: string | null,
): string[] {
  if (mode === 'overall') return habits.map((h) => h.id)
  if (mode === 'priority1') return habits.filter((h) => h.priority === 1).map((h) => h.id)
  if (mode === 'priority2') return habits.filter((h) => h.priority === 2).map((h) => h.id)
  if (mode === 'priority3') return habits.filter((h) => h.priority === 3).map((h) => h.id)
  if (mode === 'category') {
    if (!selectedCategoryId) return []
    return habits.filter((h) => h.categoryId === selectedCategoryId).map((h) => h.id)
  }
  if (mode === 'habit') {
    if (!selectedHabitId) return []
    return habits.some((h) => h.id === selectedHabitId) ? [selectedHabitId] : []
  }
  return []
}

function niceTickStep(maxValue: number): number {
  const raw = maxValue / 5
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const scaled = raw / pow10
  const base = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return base * pow10
}

function buildSeries(
  dates: LocalDateString[],
  dailyScores: Record<LocalDateString, Record<string, Score>>,
  habitIds: string[],
): ChartPoint[] {
  return dates.map((date) => {
    const scores = dailyScores[date] ?? {}
    let value = 0
    for (const id of habitIds) value += scores[id] ?? 0
    return { date, value }
  })
}

export function OverviewPage() {
  const state = useAppState()

  const endDate = state.uiState.overviewWindowEndDate
  const rangeDays = state.uiState.overviewRangeDays
  const startDate = addDays(endDate, -(rangeDays - 1))

  const categories = useMemo(
    () => Object.values(state.categories).sort((a, b) => a.sortIndex - b.sortIndex),
    [state.categories],
  )
  const habits = useMemo(() => {
    return Object.values(state.habits)
      .slice()
      .sort((a, b) => {
        if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId)
        return a.sortIndex - b.sortIndex
      })
  }, [state.habits])

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, c.name)
    return m
  }, [categories])

  const dates: LocalDateString[] = useMemo(() => {
    const list: LocalDateString[] = []
    for (let i = 0; i < rangeDays; i++) list.push(addDays(startDate, i))
    return list
  }, [startDate, rangeDays])

  const habitIds = useMemo(
    () =>
      getHabitIdsForMode(
        state.uiState.overviewMode,
        habits,
        state.uiState.overviewSelectedCategoryId,
        state.uiState.overviewSelectedHabitId,
      ),
    [
      habits,
      state.uiState.overviewMode,
      state.uiState.overviewSelectedCategoryId,
      state.uiState.overviewSelectedHabitId,
    ],
  )

  const series = useMemo(
    () => buildSeries(dates, state.dailyScores, habitIds),
    [dates, state.dailyScores, habitIds],
  )

  const yMax = useMemo(() => {
    if (state.uiState.overviewMode === 'habit') return 2
    return clampMin(habitIds.length * 2, 2)
  }, [habitIds.length, state.uiState.overviewMode])

  const total = useMemo(() => series.reduce((sum, p) => sum + p.value, 0), [series])
  const avg = useMemo(() => (series.length ? total / series.length : 0), [series.length, total])

  const mode = state.uiState.overviewMode
  const showCategoryList = mode === 'category'
  const showHabitList = mode === 'habit'

  // Simple SVG chart
  const chart = useMemo(() => {
    const width = 760
    const height = 260
    const paddingLeft = 44
    const paddingRight = 10
    const paddingTop = 10
    const paddingBottom = 28
    const innerW = width - paddingLeft - paddingRight
    const innerH = height - paddingTop - paddingBottom
    const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW
    const stepY = yMax > 0 ? innerH / yMax : innerH

    const tickStep = niceTickStep(yMax)
    const ticks: number[] = []
    for (let v = 0; v <= yMax; v += tickStep) ticks.push(v)
    if (ticks.at(-1) !== yMax) ticks.push(yMax)

    const points = series.map((p, i) => {
      const x = paddingLeft + i * stepX
      const y = paddingTop + (innerH - p.value * stepY)
      return { x, y, date: p.date, value: p.value }
    })
    const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

    const xLabelEvery = Math.max(1, Math.round(series.length / 6))

    return (
      <svg className={styles.chartSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Overview chart">
        {/* grid + y labels */}
        {ticks.map((t) => {
          const y = paddingTop + (innerH - t * stepY)
          return (
            <g key={t}>
              <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="rgba(17,24,39,0.10)" />
              <text x={paddingLeft - 8} y={y + 4} fontSize={11} textAnchor="end" fill="rgba(17,24,39,0.65)">
                {t}
              </text>
            </g>
          )
        })}

        {/* x labels */}
        {points.map((p, i) => {
          if (i % xLabelEvery !== 0 && i !== points.length - 1) return null
          const label = p.date.slice(5)
          return (
            <text
              key={p.date}
              x={p.x}
              y={height - 8}
              fontSize={11}
              textAnchor="middle"
              fill="rgba(17,24,39,0.65)"
            >
              {label}
            </text>
          )
        })}

        {/* series */}
        <path d={lineD} fill="none" stroke="#4f46e5" strokeWidth={2} />
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={3} fill="#4f46e5" />
        ))}
      </svg>
    )
  }, [series, yMax])

  return (
    <div className={styles.page}>
      <div className={styles.overviewTop}>
        <section className={styles.panel}>
          <div className={styles.overviewHeader}>
            <h2 className={styles.panelTitle} style={{ margin: 0 }}>
              PĀRSKATS
            </h2>

            <div className={styles.windowNav}>
              <button type="button" className={styles.smallBtn} onClick={() => appStore.actions.shiftOverviewWindow(-1)}>
                ←
              </button>
              <span className={styles.muted}>
                {formatDateLabel(startDate)} → {formatDateLabel(endDate)}
              </span>
              <button type="button" className={styles.smallBtn} onClick={() => appStore.actions.shiftOverviewWindow(1)}>
                →
              </button>
            </div>
          </div>

          <div className={styles.chartWrap}>{chart}</div>

          <div className={styles.legend}>
            <span className={styles.kpi}>
              <strong>Total</strong>: {total}
            </span>
            <span className={styles.kpi}>
              <strong>Avg</strong>: {avg.toFixed(2)}
            </span>
            <span className={styles.kpi}>
              <strong>Y max</strong>: {yMax}
            </span>
            <span className={styles.kpi}>
              <strong>Habits</strong>: {habitIds.length}
            </span>
          </div>
        </section>

        <aside className={styles.rightRail}>
          <Link to="/" className={styles.smallBtn} style={{ textDecoration: 'none' }}>
            SĀKUMA LAPA
          </Link>

          <button
            type="button"
            className={`${styles.smallBtn} ${rangeDays === 7 ? styles.smallBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewRangeDays(7)}
          >
            7 dienas
          </button>
          <button
            type="button"
            className={`${styles.smallBtn} ${rangeDays === 30 ? styles.smallBtnActive : ''}`}
            onClick={() => appStore.actions.setOverviewRangeDays(30)}
          >
            30 dienas
          </button>
        </aside>
      </div>

      <div className={styles.bottomRow}>
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Atlase</h3>

          {showCategoryList ? (
            <>
              <p className={styles.muted} style={{ marginTop: 0 }}>
                Izvēlies kategoriju
              </p>
              <div className={styles.list}>
                {categories.map((c) => {
                  const active = state.uiState.overviewSelectedCategoryId === c.id
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
                  const active = state.uiState.overviewSelectedHabitId === h.id
                  const catName = categoryNameById.get(h.categoryId) ?? '—'
                  return (
                    <div
                      key={h.id}
                      className={`${styles.listItem} ${active ? styles.listItemActive : ''}`}
                      onClick={() => appStore.actions.selectOverviewHabit(active ? null : h.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className={styles.itemTitle}>{h.name}</span>
                      <span className={styles.muted}>{catName}</span>
                    </div>
                  )
                })}
                {habits.length === 0 ? <p className={styles.muted}>Nav ieradumu.</p> : null}
              </div>
            </>
          ) : (
            <p className={styles.muted} style={{ marginTop: 0 }}>
              Atlase pieejama režīmos “Kategorija” un “Ieradums”.
            </p>
          )}
        </section>

        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Filtrs</h3>

          <div className={styles.filtersGrid}>
            <button
              type="button"
              className={`${styles.smallBtn} ${mode === 'overall' ? styles.smallBtnActive : ''}`}
              onClick={() => appStore.actions.setOverviewMode('overall')}
            >
              Kopējais rezultāts
            </button>
            <button
              type="button"
              className={`${styles.smallBtn} ${mode === 'priority1' ? styles.smallBtnActive : ''}`}
              onClick={() => appStore.actions.setOverviewMode('priority1')}
            >
              Prioritāte 1
            </button>
            <button
              type="button"
              className={`${styles.smallBtn} ${mode === 'priority2' ? styles.smallBtnActive : ''}`}
              onClick={() => appStore.actions.setOverviewMode('priority2')}
            >
              Prioritāte 2
            </button>
            <button
              type="button"
              className={`${styles.smallBtn} ${mode === 'priority3' ? styles.smallBtnActive : ''}`}
              onClick={() => appStore.actions.setOverviewMode('priority3')}
            >
              Prioritāte 3
            </button>
            <button
              type="button"
              className={`${styles.smallBtn} ${mode === 'category' ? styles.smallBtnActive : ''}`}
              onClick={() => appStore.actions.setOverviewMode('category')}
            >
              Kategorija
            </button>
            <button
              type="button"
              className={`${styles.smallBtn} ${mode === 'habit' ? styles.smallBtnActive : ''}`}
              onClick={() => appStore.actions.setOverviewMode('habit')}
            >
              Atsevišķa sadaļa
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default OverviewPage
