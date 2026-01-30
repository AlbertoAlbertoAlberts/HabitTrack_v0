import styles from './IntensityPicker.module.css'

function buildSteps(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0) {
    return []
  }
  if (max < min) return []

  const out: number[] = []
  // Guard against infinite loops.
  const maxCount = 40
  let n = min
  for (let i = 0; i < maxCount && n <= max + 1e-9; i++) {
    out.push(Number(n.toFixed(6)))
    n += step
  }
  return out
}

export function IntensityPicker({
  min,
  max,
  step = 1,
  value,
  onChange,
  ariaLabel,
}: {
  min: number
  max: number
  step?: number
  value?: number
  onChange: (next: number) => void
  ariaLabel?: string
}) {
  const steps = buildSteps(min, max, step)

  // Prefer discrete buttons for the common 1..5 / 1..3 cases.
  const canRenderButtons = step === 1 && steps.length > 0 && steps.length <= 10

  if (!canRenderButtons) {
    return (
      <input
        type="number"
        className={styles.fallbackInput}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value
          const next = raw === '' ? NaN : Number(raw)
          if (Number.isFinite(next)) onChange(next)
        }}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        placeholder={`${min}–${max}`}
      />
    )
  }

  return (
    <div className={styles.picker} aria-label={ariaLabel}>
      {steps.map((n) => (
        <button
          key={n}
          type="button"
          className={[styles.btn, value === n ? styles.btnActive : ''].filter(Boolean).join(' ')}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
