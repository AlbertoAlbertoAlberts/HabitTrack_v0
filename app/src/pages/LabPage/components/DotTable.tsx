import { Fragment, useMemo } from 'react'
import styles from './DotTable.module.css'

interface DotTableProps {
  /** rowKey → { date → present } */
  data: Record<string, Record<string, boolean>>
  /** rowKey → display label */
  labels: Record<string, string>
  /** Start of the date window (YYYY-MM-DD). Default: 30 days before today */
  startDate?: string
  /** Called when user navigates start date */
  onStartDateChange?: (date: string) => void
  /** Number of days to show (default 30) */
  days?: number
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatHeaderDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  // Show month abbreviation on the 1st, otherwise just the day number
  if (day === 1) return SHORT_MONTHS[d.getMonth()]
  return String(day)
}

export function DotTable({ data, labels, startDate, onStartDateChange, days = 30 }: DotTableProps) {
  const rowKeys = useMemo(() => Object.keys(labels), [labels])

  const defaultStart = useMemo(() => {
    return addDays(toISODate(new Date()), -(days - 1))
  }, [days])

  const effectiveStart = startDate ?? defaultStart

  const dates = useMemo(() => {
    const arr: string[] = []
    let cursor = effectiveStart
    for (let i = 0; i < days; i++) {
      arr.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return arr
  }, [effectiveStart, days])

  if (rowKeys.length === 0) {
    return <div className={styles.emptyState}>No data to display.</div>
  }

  return (
    <div className={styles.container}>
      {onStartDateChange && (
        <div className={styles.dateNav}>
          <button
            type="button"
            className={styles.dateNavBtn}
            onClick={() => onStartDateChange(addDays(effectiveStart, -7))}
            aria-label="Previous 7 days"
          >
            ◀
          </button>
          <span className={styles.dateNavLabel}>
            {effectiveStart} — {dates[dates.length - 1]}
          </span>
          <button
            type="button"
            className={styles.dateNavBtn}
            onClick={() => onStartDateChange(addDays(effectiveStart, 7))}
            aria-label="Next 7 days"
          >
            ▶
          </button>
        </div>
      )}

      <div className={styles.scrollWrap}>
        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: `auto repeat(${days}, 20px)`,
            gridTemplateRows: `auto repeat(${rowKeys.length}, 20px)`,
          }}
        >
          {/* Header row: empty corner + date headers */}
          <div /> {/* corner */}
          {dates.map((date) => (
            <div
              key={date}
              className={[styles.headerCell, isWeekend(date) && styles.headerCellWeekend]
                .filter(Boolean)
                .join(' ')}
            >
              {formatHeaderDate(date)}
            </div>
          ))}

          {/* Data rows */}
          {rowKeys.map((key) => (
            <Fragment key={key}>
              <div className={styles.rowLabel} title={labels[key]}>
                {labels[key]}
              </div>
              {dates.map((date) => {
                const present = data[key]?.[date] ?? false
                return (
                  <div key={`${key}-${date}`} className={styles.cell}>
                    <div className={present ? styles.dot : styles.dotEmpty} />
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
