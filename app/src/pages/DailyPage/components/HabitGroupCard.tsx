import type { Habit, HabitId, LocalDateString, Score } from '../../../domain/types'

import { HabitRow } from './HabitRow'

import styles from './HabitGroupCard.module.css'

interface HabitGroupCardProps {
  type: 'category' | 'priority'
  title: string
  habits: Habit[]
  selectedDate: LocalDateString
  scoresForSelectedDate: Record<HabitId, Score>
  locked: boolean
  onScoreChange: (habitId: HabitId, score: 0 | 1 | 2) => void
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="14"
      viewBox="0 0 18 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1.25 3.25C1.25 2.42157 1.92157 1.75 2.75 1.75H6.55C6.92 1.75 7.275 1.903 7.53 2.172L8.61 3.3H15.25C16.0784 3.3 16.75 3.97157 16.75 4.8V11.25C16.75 12.0784 16.0784 12.75 15.25 12.75H2.75C1.92157 12.75 1.25 12.0784 1.25 11.25V3.25Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  )
}

export function HabitGroupCard({
  type,
  title,
  habits,
  selectedDate,
  scoresForSelectedDate,
  locked,
  onScoreChange,
}: HabitGroupCardProps) {
  return (
    <div className={styles.scoreCard}>
      <div className={styles.scoreCardHeader}>
        {type === 'category' ? (
          <FolderIcon className={styles.catIcon} />
        ) : (
          <span className={styles.priorityBadge}>🎯</span>
        )}
        <h3 className={styles.categoryName}>{title}</h3>
      </div>
      {habits.map((h) => {
        const value = scoresForSelectedDate[h.id]
        return (
          <HabitRow
            key={h.id}
            habit={h}
            selectedDate={selectedDate}
            value={value}
            locked={locked}
            onChange={(score) => onScoreChange(h.id, score)}
          />
        )
      })}
    </div>
  )
}
