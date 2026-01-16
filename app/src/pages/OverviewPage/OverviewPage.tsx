import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { appStore } from '../../domain/store/appStore'
import { useAppState } from '../../domain/store/useAppStore'
import { addDays, parseLocalDateString, todayLocalDateString, weekStartMonday } from '../../domain/utils/localDate'
import { getWeeklyTaskTargetPerWeekForWeekStart } from '../../domain/utils/weeklyTaskTarget'
import type { Habit, LocalDateString, OverviewMode, Score, WeeklyTask } from '../../domain/types'

import styles from './OverviewPage.module.css'

type ChartPoint = { date: LocalDateString; value: number; earned: number; maxPossible: number }
type SvgPoint = { x: number; y: number; date: LocalDateString; value: number }

const CHART_VIEWBOX_WIDTH = 760
const CHART_VIEWBOX_HEIGHT = 364

const RAMP_RED = '#ef4444'
const RAMP_AMBER = '#f59e0b'
const RAMP_GREEN = '#22c55e'

// Move amber earlier so above ~50% score is already greenish.
const RAMP_AMBER_STOP = 0.18

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) return { r: 0, g: 0, b: 0 }
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const to2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`
}

function lerpColor(aHex: string, bHex: string, t: number): string {
  const a = hexToRgb(aHex)
  const b = hexToRgb(bHex)
  return rgbToHex({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) })
}

function scoreToColor(value: number, max: number): string {
  const t = clamp01(max > 0 ? value / max : 0)

  const mid = clamp01(RAMP_AMBER_STOP)
  if (t <= mid) return lerpColor(RAMP_RED, RAMP_AMBER, mid > 0 ? t / mid : 1)
  return lerpColor(RAMP_AMBER, RAMP_GREEN, (t - mid) / Math.max(1e-6, 1 - mid))
}

function buildLinearPathD(points: Array<Pick<SvgPoint, 'x' | 'y'>>): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
}

function buildSmoothPathD(points: Array<Pick<SvgPoint, 'x' | 'y'>>): string {
  if (points.length <= 2) return buildLinearPathD(points)

  const alpha = 1
  const clampPoint = (idx: number) => points[Math.max(0, Math.min(points.length - 1, idx))]

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = clampPoint(i - 1)
    const p1 = clampPoint(i)
    const p2 = clampPoint(i + 1)
    const p3 = clampPoint(i + 2)

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * alpha
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * alpha
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * alpha
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * alpha

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  return d
}

type BezierSeg = {
  p1: SvgPoint
  cp1: { x: number; y: number }
  cp2: { x: number; y: number }
  p2: SvgPoint
}

type ColoredSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

function cubicBezierPoint(seg: BezierSeg, t: number): { x: number; y: number } {
  const tt = clamp01(t)
  const u = 1 - tt

  const p1x = seg.p1.x
  const p1y = seg.p1.y
  const c1x = seg.cp1.x
  const c1y = seg.cp1.y
  const c2x = seg.cp2.x
  const c2y = seg.cp2.y
  const p2x = seg.p2.x
  const p2y = seg.p2.y

  const x =
    u * u * u * p1x +
    3 * u * u * tt * c1x +
    3 * u * tt * tt * c2x +
    tt * tt * tt * p2x
  const y =
    u * u * u * p1y +
    3 * u * u * tt * c1y +
    3 * u * tt * tt * c2y +
    tt * tt * tt * p2y

  return { x, y }
}

function buildSmoothCubicSegments(points: SvgPoint[]): BezierSeg[] {
  if (points.length <= 1) return []

  const alpha = 1
  const clampPoint = (idx: number) => points[Math.max(0, Math.min(points.length - 1, idx))]

  const segs: BezierSeg[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = clampPoint(i - 1)
    const p1 = clampPoint(i)
    const p2 = clampPoint(i + 1)
    const p3 = clampPoint(i + 2)

    const cp1 = {
      x: p1.x + ((p2.x - p0.x) / 6) * alpha,
      y: p1.y + ((p2.y - p0.y) / 6) * alpha,
    }
    const cp2 = {
      x: p2.x - ((p3.x - p1.x) / 6) * alpha,
      y: p2.y - ((p3.y - p1.y) / 6) * alpha,
    }

    segs.push({ p1, cp1, cp2, p2 })
  }

  return segs
}

function buildGradientSegments(points: SvgPoint[], samplesPerSegment: number, maxValue: number): ColoredSegment[] {
  if (points.length <= 1) return []

  const samples = Math.max(2, Math.min(40, Math.floor(samplesPerSegment)))
  const out: ColoredSegment[] = []

  // If we only have 2 points, render a single straight segment.
  if (points.length === 2) {
    const midValue = (points[0].value + points[1].value) / 2
    out.push({
      x1: points[0].x,
      y1: points[0].y,
      x2: points[1].x,
      y2: points[1].y,
      color: scoreToColor(midValue, maxValue),
    })
    return out
  }

  const cubicSegs = buildSmoothCubicSegments(points)
  for (const seg of cubicSegs) {
    let prev = cubicBezierPoint(seg, 0)

    for (let s = 1; s <= samples; s++) {
      const t = s / samples
      const curr = cubicBezierPoint(seg, t)

      const midT = (s - 0.5) / samples
      const midValue = lerp(seg.p1.value, seg.p2.value, midT)

      out.push({
        x1: prev.x,
        y1: prev.y,
        x2: curr.x,
        y2: curr.y,
        color: scoreToColor(midValue, maxValue),
      })

      prev = curr
    }
  }

  return out
}

function formatDateLabel(date: LocalDateString): string {
  // Input is YYYY-MM-DD (local). Display as DD.MM.YYYY.
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date)
  if (!m) return date
  return `${m[3]}.${m[2]}.${m[1]}`
}

function formatWeekdayShort(date: LocalDateString): string {
  const d = parseLocalDateString(date)
  const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return names[d.getDay()] ?? ''
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
  habitsById: Record<string, Habit>,
): ChartPoint[] {
  return dates.map((date) => {
    const scores = dailyScores[date] ?? {}

    const activeHabitIds = habitIds.filter((id) => {
      const h = habitsById[id]
      if (!h) return false
      const start = h.startDate
      return !start || date >= start
    })

    const maxPossible = activeHabitIds.length * 2
    let earned = 0
    for (const id of activeHabitIds) earned += scores[id] ?? 0

    const value = maxPossible > 0 ? earned / maxPossible : 0
    return { date, value, earned, maxPossible }
  })
}

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : min
  return Math.max(min, Math.min(max, n))
}

export function OverviewPage() {
  const state = useAppState()

  const currentWeekStart = useMemo(() => weekStartMonday(todayLocalDateString()), [])

  const endDate = state.uiState.overviewWindowEndDate
  const rangeDays = state.uiState.overviewRangeDays
  const startDate = addDays(endDate, -(rangeDays - 1))

  const weeklyTasks = useMemo(
    () => Object.values(state.weeklyTasks).slice().sort((a, b) => a.sortIndex - b.sortIndex),
    [state.weeklyTasks],
  )

  // Overview weekly summary is always Monday–Sunday for the week that contains `endDate`.
  const overviewWeekStart = useMemo(() => weekStartMonday(endDate), [endDate])
  const overviewWeekEnd = useMemo(() => addDays(overviewWeekStart, 6), [overviewWeekStart])

  const weeklyPoints = useMemo(() => {
    const byTaskDays = state.weeklyCompletionDays[overviewWeekStart] ?? {}
    const byTaskProgress = state.weeklyProgress[overviewWeekStart] ?? {}

    let earned = 0
    let max = 0

    const perTask: Array<{ task: WeeklyTask; earned: number }> = []

    for (const task of weeklyTasks) {
      const effectiveTarget = getWeeklyTaskTargetPerWeekForWeekStart(task, overviewWeekStart, currentWeekStart)
      const maxForTask = clampInt(effectiveTarget, 1, 7)
      max += maxForTask

      const days = byTaskDays[task.id]
      const fallbackCount = typeof byTaskProgress[task.id] === 'number' ? byTaskProgress[task.id] : 0
      const rawCount = Array.isArray(days) ? days.length : fallbackCount
      const earnedForTask = clampInt(rawCount, 0, maxForTask)

      earned += earnedForTask
      perTask.push({ task, earned: earnedForTask })
    }

    return { earned, max, perTask }
  }, [currentWeekStart, overviewWeekStart, state.weeklyCompletionDays, state.weeklyProgress, weeklyTasks])

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
    () => buildSeries(dates, state.dailyScores, habitIds, state.habits),
    [dates, state.dailyScores, habitIds, state.habits],
  )

  const yMax = useMemo(() => {
    // Elastic overview: plot completion ratio (0..1), keep max pinned to the top.
    return 1
  }, [])

  const totalEarned = useMemo(() => series.reduce((sum, p) => sum + p.earned, 0), [series])
  const totalMaxPossible = useMemo(() => series.reduce((sum, p) => sum + p.maxPossible, 0), [series])
  const totalPct = useMemo(
    () => (totalMaxPossible > 0 ? totalEarned / totalMaxPossible : 0),
    [totalEarned, totalMaxPossible],
  )
  const avgPct = useMemo(
    () => (series.length ? series.reduce((sum, p) => sum + p.value, 0) / series.length : 0),
    [series],
  )
  const maxPossibleEnd = useMemo(() => series.at(-1)?.maxPossible ?? 0, [series])
  const activeHabitsEnd = useMemo(() => Math.floor(maxPossibleEnd / 2), [maxPossibleEnd])

  const mode = state.uiState.overviewMode
  const showCategoryList = mode === 'category'
  const showHabitList = mode === 'habit'

  // Simple SVG chart
  const chart = useMemo(() => {
    const width = CHART_VIEWBOX_WIDTH
    const height = CHART_VIEWBOX_HEIGHT
    const paddingLeft = 44
    const paddingRight = 10
    const paddingTop = 10
    const paddingBottom = 28

    // Add a little extra plot breathing room so the smoothed curve/glow can overshoot
    // slightly without clipping against the viewBox.
    const plotInsetTop = 10
    const plotInsetBottom = 10

    const axisFontSize = 10
    const axisTextFill = 'var(--chart-label)'
    const gridStroke = 'var(--chart-grid)'
    const zeroAxisStroke = 'var(--chart-axis)'
    const zeroAxisStrokeWidth = 1.5

    const primaryStrokeWidth = 3.25
    const primaryPointRadius = 3.2
    const glowStrokeWidth = 10
    const glowOpacity = 0.16

    const mainGlowStroke = 'var(--chart-axis)'

    const maxStroke = 'var(--chart-axis)'
    const maxStrokeWidth = 2.1
    const maxPointRadius = 2.7
    const maxGlowStrokeWidth = 13
    const maxGlowOpacity = 0.22
    const innerW = width - paddingLeft - paddingRight
    const plotTop = paddingTop + plotInsetTop
    const innerH = height - paddingTop - paddingBottom - plotInsetTop - plotInsetBottom
    const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW
    const stepY = yMax > 0 ? innerH / yMax : innerH

    const tickStep = niceTickStep(yMax)
    const ticks: number[] = []
    for (let v = 0; v <= yMax; v += tickStep) ticks.push(v)
    if (ticks.at(-1) !== yMax) ticks.push(yMax)

    const points: SvgPoint[] = series.map((p, i) => {
      const x = paddingLeft + i * stepX
      const y = plotTop + (innerH - p.value * stepY)
      return { x, y, date: p.date, value: p.value }
    })
    const mainSeries = {
      points,
      lineD: buildSmoothPathD(points),
    }

    const rampMidOffset = `${Math.round(RAMP_AMBER_STOP * 100)}%`
    const maxPoints: SvgPoint[] = series.map((p, i) => {
      const x = paddingLeft + i * stepX
      const y = plotTop + (innerH - yMax * stepY)
      return { x, y, date: p.date, value: yMax }
    })
    const maxSeries = {
      points: maxPoints,
      lineD: buildSmoothPathD(maxPoints),
    }

    // Phase 6: performance cap for gradient micro-segments.
    // We adapt sampling density based on how many days are being shown so
    // we don't render excessive DOM nodes for long ranges.
    const maxGradientSegments = 600
    const daySegments = Math.max(1, mainSeries.points.length - 1)
    const samplesPerBezier = clampInt(Math.floor(maxGradientSegments / daySegments), 6, 18)
    const mainGradientSegments = buildGradientSegments(mainSeries.points, samplesPerBezier, yMax)

    const xLabelEvery = Math.max(1, Math.round(series.length / 6))

    return (
      <svg className={styles.chartSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Overview chart">
        <defs>
          <filter id="overviewChartGlow" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>

          <linearGradient id="overviewScoreRamp" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={RAMP_RED} />
            <stop offset={rampMidOffset} stopColor={RAMP_AMBER} />
            <stop offset="100%" stopColor={RAMP_GREEN} />
          </linearGradient>
        </defs>

        {/* axes (0 lines) */}
        <line
          x1={paddingLeft}
          x2={paddingLeft}
          y1={plotTop}
          y2={plotTop + innerH}
          stroke={zeroAxisStroke}
          strokeWidth={zeroAxisStrokeWidth}
          shapeRendering="crispEdges"
        />

        {/* grid + y labels */}
        {ticks.map((t) => {
          const y = plotTop + (innerH - t * stepY)
          return (
            <g key={t}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={y}
                y2={y}
                stroke={t === 0 ? zeroAxisStroke : gridStroke}
                strokeWidth={t === 0 ? zeroAxisStrokeWidth : 1}
                shapeRendering="crispEdges"
              />
              <text x={paddingLeft - 8} y={y + 4} fontSize={axisFontSize} textAnchor="end" fill={axisTextFill}>
                {`${Math.round(t * 100)}%`}
              </text>
            </g>
          )
        })}

        {/* x labels */}
        {points.map((p, i) => {
          if (i % xLabelEvery !== 0 && i !== points.length - 1) return null
          const label = formatWeekdayShort(p.date)
          return (
            <text
              key={p.date}
              x={p.x}
              y={height - 8}
              fontSize={axisFontSize}
              textAnchor="middle"
              fill={axisTextFill}
            >
              {label}
            </text>
          )
        })}

        {/* series */}
        <path
          d={maxSeries.lineD}
          fill="none"
          stroke={maxStroke}
          strokeWidth={maxGlowStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={maxGlowOpacity}
          filter="url(#overviewChartGlow)"
        />
        <path
          d={maxSeries.lineD}
          fill="none"
          stroke={maxStroke}
          strokeWidth={maxStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {maxSeries.points.map((p) => (
          <circle key={`max-${p.date}`} cx={p.x} cy={p.y} r={maxPointRadius} fill={maxStroke} />
        ))}

        {/* Show raw maxPossible when it changes (elastic scaling). */}
        {series.map((p, i) => {
          const prev = i > 0 ? series[i - 1] : null
          if (i !== 0 && prev && prev.maxPossible === p.maxPossible) return null
          const x = points[i]?.x
          if (!Number.isFinite(x)) return null
          return (
            <text
              key={`maxlabel-${p.date}`}
              x={x}
              y={plotTop + 14}
              fontSize={axisFontSize}
              textAnchor="middle"
              fill={axisTextFill}
            >
              {p.maxPossible}
            </text>
          )
        })}

        {/* Main series — Option B (gradient-by-segment). */}
        <path
          d={mainSeries.lineD}
          fill="none"
          stroke={mainGlowStroke}
          strokeWidth={glowStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={glowOpacity}
          filter="url(#overviewChartGlow)"
        />
        {mainGradientSegments.map((seg, idx) => (
          <path
            key={`main-${idx}`}
            d={`M ${seg.x1.toFixed(1)} ${seg.y1.toFixed(1)} L ${seg.x2.toFixed(1)} ${seg.y2.toFixed(1)}`}
            fill="none"
            stroke={seg.color}
            strokeWidth={primaryStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {mainSeries.points.map((p) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={primaryPointRadius}
            fill={scoreToColor(p.value, yMax)}
            stroke={zeroAxisStroke}
            strokeWidth={0.8}
          />
        ))}
      </svg>
    )
  }, [series, yMax])

  return (
    <div className={styles.page}>
      <div className={styles.overviewLayout}>
        <main className={styles.mainCol}>
          <section className={styles.panel}>
          <div className={styles.overviewHeader}>
            <h2 className={styles.panelTitle} style={{ margin: 0 }}>
              PĀRSKATS
            </h2>

            <div className={styles.windowNav}>
              <button type="button" className={styles.smallBtn} onClick={() => appStore.actions.shiftOverviewWindow(-1)}>
                ←
              </button>
              <span className={styles.dateRangeLabel}>
                {formatDateLabel(startDate)} → {formatDateLabel(endDate)}
              </span>
              <button type="button" className={styles.smallBtn} onClick={() => appStore.actions.shiftOverviewWindow(1)}>
                →
              </button>
            </div>

            <div aria-hidden />
          </div>

          <div className={styles.chartWrap}>
            <div className={styles.chartInlineLegend} aria-hidden>
              <span className={styles.chartLegendItem}>
                <span className={styles.chartLegendSwatchPrimary} />
                Rezultāts
              </span>
              <span className={styles.chartLegendItem}>
                <span className={styles.chartLegendSwatchMax} />
                Maks.
              </span>
            </div>
            {chart}
          </div>

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
        </main>

        <aside className={styles.leftCol}>
          <section className={`${styles.panel} ${styles.sidebarPanel}`} aria-label="Pārskata sānu sadaļa">
            <div className={styles.sidebarStack}>
              <Link
                to="/"
                className={`${styles.smallBtn} ${styles.homeBtn}`}
                style={{ textDecoration: 'none' }}
                onClick={() => {
                  appStore.actions.setSelectedDate(todayLocalDateString())
                }}
              >
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

              <div>
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
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default OverviewPage
