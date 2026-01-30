import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import {
  buildDailyDataset,
  buildEventDataset,
  type DailyDataset,
  type DailyDatasetRow,
  type EventDataset,
  type EventDatasetRow,
} from '../../../domain/lab/analysis/datasetBuilders'
import { runAnalysisForProject } from '../../../domain/lab/analysis/runner'
import type { LabFinding } from '../../../domain/lab/analysis/types'
import { formatTagNameDisplay } from '../../../domain/lab/utils/tagDisplay'
import styles from './TagStatsView.module.css'
import { useEffect, useMemo } from 'react'
import type { LabTagDef } from '../../../domain/types'

interface TagStatsViewProps {
  projectId: string
  selectedTagId?: string | null
  onSelectTag?: (tagId: string) => void
}

type TagSummary = {
  tagId: string
  name: string
  presentCount: number
  absentCount: number
  totalCount: number
  presenceRate: number
  maturityScore: number
  maturityLabel: 'Early' | 'Growing' | 'Mature'
}

function getMaturityLabel(score: number): TagSummary['maturityLabel'] {
  if (score >= 0.67) return 'Mature'
  if (score >= 0.34) return 'Growing'
  return 'Early'
}

function buildDailyTagSummaries(tags: Record<string, LabTagDef>, dataset: DailyDataset): TagSummary[] {
  const tagIds = Object.keys(tags)
  if (tagIds.length === 0) return []

  const counts: Record<string, { present: number; absent: number }> = {}
  for (const tagId of tagIds) counts[tagId] = { present: 0, absent: 0 }

  for (const row of dataset.rows) {
    if (row.outcome === undefined) continue
    for (const tagId of tagIds) {
      if (row.tags[tagId]?.present) counts[tagId].present++
      else counts[tagId].absent++
    }
  }

  const THRESHOLD_EXPOSED = 10

  return tagIds
    .map((tagId) => {
      const presentCount = counts[tagId]?.present ?? 0
      const absentCount = counts[tagId]?.absent ?? 0
      const totalCount = presentCount + absentCount
      const presenceRate = totalCount > 0 ? presentCount / totalCount : 0
      const maturityScore = Math.min(1, presentCount / THRESHOLD_EXPOSED)
      const maturityLabel = getMaturityLabel(maturityScore)

      return {
        tagId,
        name: tags[tagId]?.name || 'Unknown',
        presentCount,
        absentCount,
        totalCount,
        presenceRate,
        maturityScore,
        maturityLabel,
      }
    })
    .sort((a, b) => {
      if (b.presentCount !== a.presentCount) return b.presentCount - a.presentCount
      return a.name.localeCompare(b.name)
    })
}

function buildEventTagSummaries(tags: Record<string, LabTagDef>, dataset: EventDataset): TagSummary[] {
  const tagIds = Object.keys(tags)
  if (tagIds.length === 0) return []

  const counts: Record<string, number> = {}
  for (const tagId of tagIds) counts[tagId] = 0

  for (const row of dataset.rows) {
    for (const tagId of tagIds) {
      if (row.tags[tagId]?.present) counts[tagId]++
    }
  }

  const totalCount = dataset.rows.length
  const THRESHOLD_EXPOSED = 10

  return tagIds
    .map((tagId) => {
      const presentCount = counts[tagId] ?? 0
      const absentCount = Math.max(0, totalCount - presentCount)
      const presenceRate = totalCount > 0 ? presentCount / totalCount : 0
      const maturityScore = Math.min(1, presentCount / THRESHOLD_EXPOSED)
      const maturityLabel = getMaturityLabel(maturityScore)

      return {
        tagId,
        name: tags[tagId]?.name || 'Unknown',
        presentCount,
        absentCount,
        totalCount,
        presenceRate,
        maturityScore,
        maturityLabel,
      }
    })
    .sort((a, b) => {
      if (b.presentCount !== a.presentCount) return b.presentCount - a.presentCount
      return a.name.localeCompare(b.name)
    })
}

export function TagStatsView({ projectId, selectedTagId, onSelectTag }: TagStatsViewProps) {
  const state = useAppState()
  const project = state.lab?.projects[projectId]
  const rawTags = state.lab?.tagsByProject[projectId]
  const tags: Record<string, LabTagDef> = useMemo(() => rawTags || {}, [rawTags])

  const dailyDataset = buildDailyDataset(state, projectId)
  const eventDataset = buildEventDataset(state, projectId)
  const result = runAnalysisForProject(state, projectId)
  const findings = result.findings

  const tagSummaries = useMemo(() => {
    if (!project) return []
    return project.mode === 'event'
      ? buildEventTagSummaries(tags, eventDataset)
      : buildDailyTagSummaries(tags, dailyDataset)
  }, [tags, dailyDataset, eventDataset, project])

  const selected =
    (selectedTagId && tagSummaries.find((t) => t.tagId === selectedTagId)?.tagId) ||
    tagSummaries[0]?.tagId ||
    null

  const selectedSummary = selected ? tagSummaries.find((t) => t.tagId === selected) : null
  const selectedFindings = selected ? findings.filter((f) => f.tagId === selected) : []

  // Persist cache updates
  useEffect(() => {
    if (result.updatedCache) {
      appStore.actions.updateFindingsCache(result.updatedCache)
    }
  }, [result.updatedCache])

  if (!project) return null

  if (project.mode === 'daily' && dailyDataset.rows.length === 0) {
    return <div className={styles.empty}>No data to analyze yet. Start logging to see tag statistics.</div>
  }

  if (project.mode === 'event' && eventDataset.rows.length === 0) {
    return <div className={styles.empty}>No events to analyze yet. Log events to see tag statistics.</div>
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Tag Statistics</h3>
      <div className={styles.split}>
        <nav className={styles.menu} aria-label="Tags">
          {tagSummaries.map((t) => (
            <button
              key={t.tagId}
              type="button"
              className={[styles.menuItem, selected === t.tagId && styles.menuItemActive].filter(Boolean).join(' ')}
              onClick={() => onSelectTag?.(t.tagId)}
            >
              <span className={styles.menuItemName}>{formatTagNameDisplay(t.name)}</span>
              <span className={styles.menuItemMeta}>
                <span className={styles.maturityBadge} data-maturity={t.maturityLabel}>
                  {t.maturityLabel}
                </span>
                <span className={styles.menuItemPct}>{(t.presenceRate * 100).toFixed(0)}%</span>
              </span>
            </button>
          ))}
        </nav>

        <div className={styles.detail}>
          {selected && selectedSummary ? (
            project.mode === 'event' ? (
              <EventTagStatsCard
                tagId={selected}
                tagName={selectedSummary.name}
                dataset={eventDataset}
                findings={selectedFindings}
              />
            ) : (
              <DailyTagStatsCard
                tagId={selected}
                tagName={selectedSummary.name}
                dataset={dailyDataset}
                findings={selectedFindings}
              />
            )
          ) : (
            <div className={styles.empty}>No tags yet. Add a tag to begin.</div>
          )}
        </div>
      </div>
    </div>
  )
}

interface TagStatsCardProps {
  tagId: string
  tagName: string
  findings: LabFinding[]
}

interface DailyTagStatsCardProps extends TagStatsCardProps {
  dataset: DailyDataset
}

function DailyTagStatsCard({ tagId, tagName, dataset, findings }: DailyTagStatsCardProps) {
  const { rows } = dataset

  // Calculate raw stats
  let presentCount = 0
  let absentCount = 0
  const outcomeWhenPresent: number[] = []
  const outcomeWhenAbsent: number[] = []

  for (const row of rows as DailyDatasetRow[]) {
    if (row.outcome === undefined) continue

    if (row.tags[tagId]?.present) {
      presentCount++
      outcomeWhenPresent.push(row.outcome)
    } else {
      absentCount++
      outcomeWhenAbsent.push(row.outcome)
    }
  }

  const avgPresent =
    outcomeWhenPresent.length > 0
      ? outcomeWhenPresent.reduce((a, b) => a + b, 0) / outcomeWhenPresent.length
      : null

  const avgAbsent =
    outcomeWhenAbsent.length > 0
      ? outcomeWhenAbsent.reduce((a, b) => a + b, 0) / outcomeWhenAbsent.length
      : null

  const presenceRate = presentCount / (presentCount + absentCount)

  const findingsByMethod = useMemo(() => {
    const groups = new Map<string, LabFinding[]>()
    for (const f of findings) {
      const key = f.method || 'unknown'
      const arr = groups.get(key)
      if (arr) arr.push(f)
      else groups.set(key, [f])
    }
    return Array.from(groups.entries())
      .map(([method, items]) => ({ method, items }))
      .sort((a, b) => a.method.localeCompare(b.method))
  }, [findings])

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.tagName}>{formatTagNameDisplay(tagName)}</span>
        <span className={styles.presenceRate}>{(presenceRate * 100).toFixed(0)}% of days</span>
      </div>

      <div className={styles.stats}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Present:</span>
          <span className={styles.statValue}>
            {presentCount} days
            {avgPresent !== null && ` • avg ${avgPresent.toFixed(1)}`}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Absent:</span>
          <span className={styles.statValue}>
            {absentCount} days
            {avgAbsent !== null && ` • avg ${avgAbsent.toFixed(1)}`}
          </span>
        </div>
      </div>

      <div className={styles.findings}>
        {findings.length > 0 ? (
          <>
            <div className={styles.findingsTitle}>Findings ({findings.length})</div>
            {findingsByMethod.map(({ method, items }) => (
              <div key={method} className={styles.findingsGroup}>
                <div className={styles.findingsGroupTitle}>
                  {method} ({items.length})
                </div>
                {items.map((finding, i) => (
                  <div key={i} className={styles.findingRow}>
                    <span
                      className={[
                        styles.findingEffect,
                        finding.effect > 0 ? styles.positive : styles.negative,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {finding.effect > 0 ? '+' : ''}
                      {finding.effect.toFixed(2)}
                    </span>
                    <span className={styles.findingSample}>n={finding.sampleSize}</span>
                  </div>
                ))}
              </div>
            ))}
          </>
        ) : (
          <div className={styles.noFindings}>
            Not enough data yet to compute findings for this tag.
          </div>
        )}
      </div>
    </div>
  )
}

interface EventTagStatsCardProps extends TagStatsCardProps {
  dataset: EventDataset
}

function EventTagStatsCard({ tagId, tagName, dataset, findings }: EventTagStatsCardProps) {
  const { rows } = dataset

  let presentCount = 0
  let absentCount = 0
  const severityWhenPresent: number[] = []
  const severityWhenAbsent: number[] = []

  for (const row of rows as EventDatasetRow[]) {
    const present = !!row.tags[tagId]?.present
    const sev = row.severity

    if (present) {
      presentCount++
      if (typeof sev === 'number' && Number.isFinite(sev)) severityWhenPresent.push(sev)
    } else {
      absentCount++
      if (typeof sev === 'number' && Number.isFinite(sev)) severityWhenAbsent.push(sev)
    }
  }

  const presenceRate = rows.length > 0 ? presentCount / rows.length : 0

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  const avgPresent = avg(severityWhenPresent)
  const avgAbsent = avg(severityWhenAbsent)

  const findingsByMethod = useMemo(() => {
    const groups = new Map<string, LabFinding[]>()
    for (const f of findings) {
      const key = f.method || 'unknown'
      const arr = groups.get(key)
      if (arr) arr.push(f)
      else groups.set(key, [f])
    }
    return Array.from(groups.entries())
      .map(([method, items]) => ({ method, items }))
      .sort((a, b) => a.method.localeCompare(b.method))
  }, [findings])

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.tagName}>{formatTagNameDisplay(tagName)}</span>
        <span className={styles.presenceRate}>{(presenceRate * 100).toFixed(0)}% of events</span>
      </div>

      <div className={styles.stats}>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Present:</span>
          <span className={styles.statValue}>
            {presentCount} events
            {avgPresent !== null && ` • avg severity ${avgPresent.toFixed(1)}`}
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Absent:</span>
          <span className={styles.statValue}>
            {absentCount} events
            {avgAbsent !== null && ` • avg severity ${avgAbsent.toFixed(1)}`}
          </span>
        </div>
      </div>

      <div className={styles.findings}>
        {findings.length > 0 ? (
          <>
            <div className={styles.findingsTitle}>Findings ({findings.length})</div>
            {findingsByMethod.map(({ method, items }) => (
              <div key={method} className={styles.findingsGroup}>
                <div className={styles.findingsGroupTitle}>
                  {method} ({items.length})
                </div>
                {items.map((finding, i) => (
                  <div key={i} className={styles.findingRow}>
                    <span
                      className={[
                        styles.findingEffect,
                        finding.effect > 0 ? styles.positive : styles.negative,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {finding.effect > 0 ? '+' : ''}
                      {finding.effect.toFixed(2)}
                    </span>
                    <span className={styles.findingSample}>n={finding.sampleSize}</span>
                  </div>
                ))}
              </div>
            ))}
          </>
        ) : (
          <div className={styles.noFindings}>No findings yet for this tag.</div>
        )}
      </div>
    </div>
  )
}
