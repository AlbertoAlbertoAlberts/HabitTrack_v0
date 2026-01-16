import styles from './WeeklyProgressRing.module.css'

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(value) : 0
  return Math.max(min, Math.min(n, max))
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)

  const delta = endAngle - startAngle
  const largeArcFlag = delta > Math.PI ? 1 : 0

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 ${largeArcFlag} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`
}

export function WeeklyProgressRing({
  value,
  max,
  onAdjust,
  title,
  disabled,
}: {
  value: number
  max: number
  onAdjust: (delta: 1 | -1) => void
  title?: string
  disabled?: boolean
}) {
  const safeMax = clampInt(max, 1, 7)
  const safeValue = clampInt(value, 0, safeMax)

  const size = 54
  const strokeWidth = 5
  const cx = size / 2
  const cy = size / 2
  const r = cx - strokeWidth / 2 - 2

  const full = Math.PI * 2
  const per = full / safeMax
  const gap = Math.min(0.28, per * 0.32)
  const seg = per - gap

  const paths = [] as Array<{ d: string; active: boolean }>
  for (let i = 0; i < safeMax; i++) {
    const start = -Math.PI / 2 + i * per + gap / 2
    const end = start + seg
    paths.push({ d: arcPath(cx, cy, r, start, end), active: i < safeValue })
  }

  const done = safeValue >= safeMax

  return (
    <button
      type="button"
      className={styles.ringBtn}
      title={title}
      aria-label={title ?? 'Atzīmēt nedēļas progresu'}
      disabled={disabled}
      onClick={(e) => {
        if (disabled) return
        const delta: 1 | -1 = e.shiftKey ? -1 : 1
        onAdjust(delta)
      }}
    >
      <svg className={styles.ringSvg} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {paths.map((p, idx) => (
          <path
            key={idx}
            d={p.d}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={p.active ? styles.segmentActive : styles.segmentInactive}
          />
        ))}
      </svg>
      <span className={`${styles.center} ${done ? styles.centerDone : ''}`} aria-hidden="true">
        ✓
      </span>
    </button>
  )
}
