import { useMemo } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { buildEventEpisodeSummary, type EventEpisodeSummaryRow } from '../../../domain/lab/analysis/datasetBuilders'
import styles from './EventEpisodesView.module.css'

interface EventEpisodesViewProps {
  projectId: string
  maxRows?: number
}

function formatNumber(value: number, digits = 1) {
  if (!Number.isFinite(value)) return '-'
  return value.toFixed(digits)
}

function median(values: number[]): number | undefined {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (v.length === 0) return undefined
  const mid = Math.floor(v.length / 2)
  return v.length % 2 === 0 ? (v[mid - 1] + v[mid]) / 2 : v[mid]
}

function formatDateTime(ts: string): string {
  const ms = Date.parse(ts)
  if (!Number.isFinite(ms)) return ts
  return new Date(ms).toLocaleString(undefined, {
    year: '2-digit',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getSeverityLabel(ep: EventEpisodeSummaryRow): string {
  if (ep.severityCount <= 0) return '-'
  const avg = ep.avgSeverity
  const max = ep.maxSeverity
  const avgTxt = typeof avg === 'number' ? formatNumber(avg, 1) : '-'
  const maxTxt = typeof max === 'number' ? formatNumber(max, 0) : '-'
  return `avg ${avgTxt} / max ${maxTxt}`
}

export function EventEpisodesView({ projectId, maxRows = 8 }: EventEpisodesViewProps) {
  const state = useAppState()
  const project = state.lab?.projects[projectId]

  const episodes = useMemo(() => {
    if (!project || project.mode !== 'event') return []
    return buildEventEpisodeSummary(state, projectId)
  }, [project, projectId, state])

  if (!project || project.mode !== 'event') return null

  if (episodes.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Episodes</div>
            <div className={styles.subtitle}>Clusters of events separated by ≥ 12 hours</div>
          </div>
        </div>
        <div className={styles.empty}>No episodes yet. Log a few events to see episode patterns.</div>
      </div>
    )
  }

  const totalEpisodes = episodes.length
  const totalEvents = episodes.reduce((sum, ep) => sum + ep.eventCount, 0)
  const avgEventsPerEpisode = totalEpisodes > 0 ? totalEvents / totalEpisodes : 0

  const durations = episodes.map((ep) => ep.durationHours)
  const gaps = episodes.map((ep) => ep.gapSincePrevEpisodeHours).filter((x): x is number => typeof x === 'number')

  const medGap = median(gaps)
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

  const anySeverity = episodes.some((e) => e.severityCount > 0)

  const rowsToShow = [...episodes].slice(Math.max(0, episodes.length - maxRows)).reverse()

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Episodes</div>
          <div className={styles.subtitle}>Last {Math.min(maxRows, episodes.length)} episodes</div>
        </div>
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <div className={styles.kpiValue}>{totalEpisodes}</div>
            <div className={styles.kpiLabel}>episodes</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiValue}>{formatNumber(avgEventsPerEpisode, 1)}</div>
            <div className={styles.kpiLabel}>events/episode</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiValue}>{formatNumber(avgDuration, 1)}h</div>
            <div className={styles.kpiLabel}>avg duration</div>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiValue}>{medGap === undefined ? '-' : `${formatNumber(medGap, 1)}h`}</div>
            <div className={styles.kpiLabel}>median gap</div>
          </div>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Start</th>
              <th className={styles.th}>Duration</th>
              <th className={styles.th}>Events</th>
              <th className={styles.th}>Gap</th>
              {anySeverity && <th className={styles.th}>Severity</th>}
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map((ep) => {
              const title = `${ep.episodeId}: ${ep.eventCount} events, ${formatNumber(ep.durationHours, 1)}h duration`
              return (
                <tr key={ep.episodeId} className={styles.tr} title={title}>
                  <td className={styles.td}>{formatDateTime(ep.startTimestamp)}</td>
                  <td className={styles.td}>{formatNumber(ep.durationHours, 1)}h</td>
                  <td className={styles.td}>{ep.eventCount}</td>
                  <td className={styles.td}>
                    {typeof ep.gapSincePrevEpisodeHours === 'number' ? `${formatNumber(ep.gapSincePrevEpisodeHours, 1)}h` : '-'}
                  </td>
                  {anySeverity && <td className={styles.td}>{getSeverityLabel(ep)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!anySeverity && (
        <div className={styles.hint}>
          Tip: add severity to events to see per-episode intensity.
        </div>
      )}
    </div>
  )
}
