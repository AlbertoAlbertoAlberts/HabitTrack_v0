import { useMemo } from 'react'
import type { LocalDateString } from '../../../domain/types'
import { parseLocalDateString } from '../../../domain/utils/localDate'
import styles from './OverviewChart.module.css'

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

function computeMonotoneBeziers(points: SvgPoint[]): BezierSeg[] {
  if (points.length < 2) return []

  const n = points.length
  const d: number[] = new Array(Math.max(0, n - 1))
  const m: number[] = new Array(n)

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    d[i] = dx !== 0 ? dy / dx : 0
  }

  m[0] = d[0] ?? 0
  m[n - 1] = d[n - 2] ?? 0

  for (let i = 1; i < n - 1; i++) {
    const d0 = d[i - 1] ?? 0
    const d1 = d[i] ?? 0
    m[i] = d0 * d1 <= 0 ? 0 : (d0 + d1) / 2
  }

  // Fritsch–Carlson monotone cubic adjustment.
  for (let i = 0; i < n - 1; i++) {
    const di = d[i] ?? 0
    if (di === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }

    const a = (m[i] ?? 0) / di
    const b = (m[i + 1] ?? 0) / di
    const h = Math.hypot(a, b)
    if (h > 3) {
      const t = 3 / h
      m[i] = t * a * di
      m[i + 1] = t * b * di
    }
  }

  const beziers: BezierSeg[] = []
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const dx = p2.x - p1.x
    if (!Number.isFinite(dx) || dx === 0) {
      beziers.push({
        p1,
        cp1: { x: p1.x, y: p1.y },
        cp2: { x: p2.x, y: p2.y },
        p2,
      })
      continue
    }

    const cp1x = p1.x + dx / 3
    const cp1y = p1.y + (m[i] ?? 0) * (dx / 3)
    const cp2x = p2.x - dx / 3
    const cp2y = p2.y - (m[i + 1] ?? 0) * (dx / 3)

    beziers.push({
      p1,
      cp1: { x: cp1x, y: cp1y },
      cp2: { x: cp2x, y: cp2y },
      p2,
    })
  }

  return beziers
}

function buildSmoothPathD(points: SvgPoint[]): string {
  if (points.length <= 2) return buildLinearPathD(points)

  const beziers = computeMonotoneBeziers(points)
  if (beziers.length === 0) return buildLinearPathD(points)

  let dStr = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (const seg of beziers) {
    dStr += ` C ${seg.cp1.x.toFixed(1)} ${seg.cp1.y.toFixed(1)} ${seg.cp2.x.toFixed(1)} ${seg.cp2.y.toFixed(1)} ${seg.p2.x.toFixed(1)} ${seg.p2.y.toFixed(1)}`
  }
  return dStr
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

function buildGradientSegments(
  points: SvgPoint[],
  samplesPerBezier: number,
  yMax: number,
): ColoredSegment[] {
  if (points.length < 2) return []

  const beziers = computeMonotoneBeziers(points)

  function bezierPoint(
    seg: BezierSeg,
    t: number,
  ): { x: number; y: number; value: number } {
    const mt = 1 - t
    const x =
      mt * mt * mt * seg.p1.x +
      3 * mt * mt * t * seg.cp1.x +
      3 * mt * t * t * seg.cp2.x +
      t * t * t * seg.p2.x
    const y =
      mt * mt * mt * seg.p1.y +
      3 * mt * mt * t * seg.cp1.y +
      3 * mt * t * t * seg.cp2.y +
      t * t * t * seg.p2.y
    const value = mt * seg.p1.value + t * seg.p2.value
    return { x, y, value }
  }

  const out: ColoredSegment[] = []
  for (const seg of beziers) {
    let prev = { x: seg.p1.x, y: seg.p1.y, value: seg.p1.value }
    for (let s = 1; s <= samplesPerBezier; s++) {
      const t = s / samplesPerBezier
      const curr = bezierPoint(seg, t)
      const color = scoreToColor(curr.value, yMax)

      out.push({
        x1: prev.x,
        y1: prev.y,
        x2: curr.x,
        y2: curr.y,
        color,
      })

      prev = curr
    }
  }

  return out
}

function formatWeekdayShort(date: LocalDateString): string {
  const d = parseLocalDateString(date)
  const names = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const idx = (d.getDay() + 6) % 7
  return names[idx] ?? ''
}

function formatDateShort(date: LocalDateString): string {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date)
  if (!m) return date
  return `${m[3]}.${m[2]}`
}

/** True if this date is a Monday. */
function isMonday(date: LocalDateString): boolean {
  return parseLocalDateString(date).getDay() === 1
}

function niceTickStep(maxValue: number): number {
  const raw = maxValue / 5
  const pow10 = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const scaled = raw / pow10
  const base = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return base * pow10
}

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : min
  return Math.max(min, Math.min(max, n))
}

type OverviewChartProps = {
  series: ChartPoint[]
  yMax: number
}

export function OverviewChart({ series, yMax }: OverviewChartProps) {
  const isMobile =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 520px)').matches

  const chart = useMemo(() => {
    const width = CHART_VIEWBOX_WIDTH
    const height = CHART_VIEWBOX_HEIGHT
    const paddingLeft = 44
    const paddingRight = 10
    const paddingTop = 10
    const paddingBottom = 28

    // A bit of inset keeps the glow from touching the SVG bounds.
    const plotInsetTop = 10
    const plotInsetBottom = 10

    const axisFontSize = isMobile ? 12 : 10
    const axisTextFill = 'var(--chart-label)'
    const gridStroke = 'var(--chart-grid)'
    const zeroAxisStroke = 'var(--chart-axis)'
    const zeroAxisStrokeWidth = 1.5

    const primaryStrokeWidth = 3.25
    const primaryPointRadius = 3.2
    const glowStrokeWidth = 10
    const glowOpacity = 0.16

    const mainGlowStroke = 'var(--chart-axis)'

    const innerW = width - paddingLeft - paddingRight
    const plotTop = paddingTop + plotInsetTop
    const innerH = height - paddingTop - paddingBottom - plotInsetTop - plotInsetBottom
    const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW
    const stepY = yMax > 0 ? innerH / yMax : innerH

    const tickStep = niceTickStep(yMax)
    const ticks: number[] = []
    for (let v = 0; v <= yMax; v += tickStep) ticks.push(v)
    if (ticks.at(-1) !== yMax) ticks.push(yMax)

    // Keep all points for X-axis positioning
    const allPoints: SvgPoint[] = series.map((p, i) => {
      const x = paddingLeft + i * stepX
      const y = plotTop + (innerH - p.value * stepY)
      return { x, y, date: p.date, value: p.value }
    })
    
    // Filter out NaN values for line rendering
    const validPoints = allPoints.filter(p => Number.isFinite(p.value))
    
    const mainSeries = {
      points: validPoints,
      lineD: buildSmoothPathD(validPoints),
    }

    const rampMidOffset = `${Math.round(RAMP_AMBER_STOP * 100)}%`

    // Phase 6: performance cap for gradient micro-segments.
    // We adapt sampling density based on how many days are being shown so
    // we don't render excessive DOM nodes for long ranges.
    const maxGradientSegments = 600
    const daySegments = Math.max(1, mainSeries.points.length - 1)
    const samplesPerBezier = clampInt(Math.floor(maxGradientSegments / daySegments), 6, 18)
    const mainGradientSegments = buildGradientSegments(mainSeries.points, samplesPerBezier, yMax)

    // Average line
    const avgValue = validPoints.length > 0
      ? validPoints.reduce((sum, p) => sum + p.value, 0) / validPoints.length
      : 0
    const avgY = plotTop + (innerH - avgValue * stepY)

    const xLabelEvery = Math.max(1, Math.round(series.length / 6))

    const plotClipId = 'overviewPlotClip'

    return (
      <svg className={styles.chartSvg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Overview chart">
        <defs>
          <filter id="overviewChartGlow" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>

          <clipPath id={plotClipId}>
            <rect x={paddingLeft} y={plotTop} width={innerW} height={innerH} />
          </clipPath>

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
        {allPoints.map((p, i) => {
          // Short range (≤10 days): show weekday names, evenly spaced
          if (series.length <= 10) {
            if (i % xLabelEvery !== 0 && i !== allPoints.length - 1) return null
            const label = formatWeekdayShort(p.date).toUpperCase()
            return (
              <text
                key={p.date}
                x={p.x}
                y={height - 8}
                fontSize={axisFontSize}
                fontWeight={700}
                textAnchor="middle"
                fill={axisTextFill}
              >
                {label}
              </text>
            )
          }

          // 30-day+ view: show DD.MM dates every ~5 days, evenly spaced
          // Target ~6 labels total for a clean look
          const labelStep = Math.max(1, Math.round(allPoints.length / 6))
          if (i % labelStep !== 0 && i !== allPoints.length - 1) return null
          return (
            <text
              key={p.date}
              x={p.x}
              y={height - 8}
              fontSize={axisFontSize}
              fontWeight={700}
              textAnchor="middle"
              fill={axisTextFill}
            >
              {formatDateShort(p.date)}
            </text>
          )
        })}

        {/* Average line — subtle dashed horizontal */}
        {validPoints.length >= 2 && (
          <g opacity={0.32}>
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={avgY}
              y2={avgY}
              stroke="var(--chart-axis)"
              strokeWidth={1}
              strokeDasharray="1.5 3.5"
              strokeLinecap="round"
              shapeRendering="auto"
            />
            <text
              x={width - paddingRight + 2}
              y={avgY + 3.5}
              fontSize={9}
              fill="var(--chart-label)"
              textAnchor="start"
              opacity={0.8}
            >
              {`${Math.round(avgValue * 100)}%`}
            </text>
          </g>
        )}

        {/* series */}
        {/* Main series — Option B (gradient-by-segment). */}
        <g clipPath={`url(#${plotClipId})`}>
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
        </g>
        {mainSeries.points.map((p) => {
          const weekday = formatWeekdayShort(p.date).toUpperCase()
          const dateStr = formatDateShort(p.date)
          const pct = `${Math.round(p.value * 100)}%`
          const tooltip = `${weekday} ${dateStr} — ${pct}`
          return (
            <g key={p.date}>
              {/* Visible dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={primaryPointRadius}
                fill={scoreToColor(p.value, yMax)}
                stroke={zeroAxisStroke}
                strokeWidth={0.8}
                pointerEvents="none"
              />
              {/* Larger invisible hit area for hover tooltip */}
              <circle
                cx={p.x}
                cy={p.y}
                r={primaryPointRadius + 6}
                fill="transparent"
                stroke="none"
              >
                <title>{tooltip}</title>
              </circle>
            </g>
          )
        })}
      </svg>
    )
  }, [isMobile, series, yMax])

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartFrame}>
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
    </div>
  )
}
