import type { Score } from '../../../domain/types'

import styles from './ScoreRow.module.css'

interface ScoreRowProps {
  value: Score | undefined
  disabled: boolean
  disabledTitle?: string
  onChange: (score: 0 | 1 | 2) => void
}

export function ScoreRow({ value, disabled, disabledTitle, onChange }: ScoreRowProps) {
  return (
    <span className={styles.scoreGroup}>
      {[0, 1, 2].map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          title={disabledTitle}
          className={`${styles.scoreBtn} ${styles[`scoreBtn${s}`]} ${value === s ? styles.scoreBtnActive : ''}`}
          onClick={() => onChange(s as 0 | 1 | 2)}
        >
          {s}
        </button>
      ))}
    </span>
  )
}
