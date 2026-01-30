import { useMemo } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { buildEventDailySummary } from '../../../domain/lab/analysis/datasetBuilders'
import styles from './EventFrequencyView.module.css'

interface EventFrequencyViewProps {
  projectId: string
  days?: number
}

type Row = {
  date: string
  count: number
  severityCount: number
  avgSeverity?: number
  maxSeverity?: number
}

function takeLastWindow(rows: Row[], days: number): Row[] {
  if (rows.length === 0) return []
  const start = Math.max(0, rows.length - days)
  return rows.slice(start)
}

export function EventFrequencyView({ projectId, days = 30 }: EventFrequencyViewProps) {
  const state = useAppState()
  const project = state.lab?.projects[projectId]

  const rows = useMemo(() => {
    if (!project || project.mode !== 'event') return []
    const all = buildEventDailySummary(state, projectId)
    return takeLastWindow(all, days)
  }, [project, projectId, state, days])

  if (!project || project.mode !== 'event') return null

  if (rows.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.title}>Event Frequency</div>
          <div className={styles.subtitle}>Last {days} days</div>
        </div>
        <div className={styles.empty}>No events to chart yet.</div>
      </div>
    )
  }

  const maxCount = Math.max(1, ...rows.map((r) => r.count))
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const daysWithEvents = rows.filter((r) => r.count > 0).length
  const avgPerDay = rows.length > 0 ? total / rows.length : 0

  const anySeverity = rows.some((r) => (r.severityCount ?? 0) > 0)

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Event Frequency</div>
          <div className={styles.subtitle}>Last {rows.length} days</div>
        </div>
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <div className={styles.kpiValue}>{total}</div>
            <div className={styles.kpiLabel}>events</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiValue}>{avgPerDay.toFixed(1)}</div>
            <div className={styles.kpiLabel}>avg/day</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiValue}>{daysWithEvents}</div>
            <div className={styles.kpiLabel}>active days</div>
          </div>
        </div>
      </div>

      <div className={styles.chart} role="img" aria-label={`Event frequency over the last ${rows.length} days`}>
        {rows.map((r) => {
          const h = Math.round((r.count / maxCount) * 100)
          const sev = anySeverity && r.severityCount > 0 ? r.avgSeverity?.toFixed(1) : null
          const title = sev
            ? `${r.date}: ${r.count} events (avg severity ${sev}, max ${r.maxSeverity ?? '-'})`
            : `${r.date}: ${r.count} events`

          return (
            <div key={r.date} className={styles.barWrap} title={title} aria-label={title}>
              <div className={styles.bar} style={{ height: `${h}%` }} />
            </div>
          )
        })}
      </div>

      {anySeverity && (
        <div className={styles.hint}>Hover bars to see avg/max severity (when logged).</div>
      )}
    </div>
  )
}
