import type { Habit, LocalDateString, Score } from '../../../domain/types'

import { ScoreRow } from './ScoreRow'

import styles from './HabitRow.module.css'

interface HabitRowProps {
  habit: Habit
  selectedDate: LocalDateString
  value: Score | undefined
  locked: boolean
  onChange: (score: 0 | 1 | 2) => void
}

function formatDateLabel(date: string): string {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date)
  if (!m) return date
  return `${m[3]}.${m[2]}.${m[1]}`
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" opacity="0.85" />
      <path d="M8 1V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      <path d="M8 13V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      <path d="M1 8H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
      <path d="M13 8H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
    </svg>
  )
}

export function HabitRow({ habit, selectedDate, value, locked, onChange }: HabitRowProps) {
  const notStartedYet = Boolean(habit.startDate && selectedDate < habit.startDate)
  const scoreDisabled = locked || notStartedYet

  return (
    <div className={`${styles.habitRow} ${notStartedYet ? styles.habitRowNotStarted : ''}`}>
      <div className={`${styles.habitLeft} ${styles.habitLeftIndented}`}>
        <TargetIcon className={styles.habitIcon} />
        <span className={styles.habitName} title={habit.name}>
          {habit.name}{habit.scoreDay === 'previous' ? ' (vakar)' : ''}
        </span>
        {notStartedYet && habit.startDate ? (
          <span className={styles.habitStartHint} title={`Sākas: ${formatDateLabel(habit.startDate)}`}>
            Sākas: {formatDateLabel(habit.startDate)}
          </span>
        ) : null}
      </div>
      <ScoreRow
        value={value}
        disabled={scoreDisabled}
        disabledTitle={notStartedYet && habit.startDate ? `Sākas: ${formatDateLabel(habit.startDate)}` : undefined}
        onChange={onChange}
      />
    </div>
  )
}
