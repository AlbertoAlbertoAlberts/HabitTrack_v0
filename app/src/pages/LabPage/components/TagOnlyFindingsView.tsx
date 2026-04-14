import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import { runAnalysisForProject } from '../../../domain/lab/analysis/runner'
import { buildTagOnlyDataset } from '../../../domain/lab/analysis/datasetBuilders'
import { buildTagDotTableData } from '../../../domain/lab/analysis/tagOnlyMethods'
import { formatTagNameDisplay } from '../../../domain/lab/utils/tagDisplay'
import type { LabFinding } from '../../../domain/lab/analysis/types'
import type { LabTagDef } from '../../../domain/types'
import { DataMaturityView } from './DataMaturityView'
import { DotTable } from './DotTable'
import styles from './TagOnlyFindingsView.module.css'

type TabKey = 'frequency' | 'cooccurrence' | 'dotTable'

interface TagOnlyFindingsViewProps {
  projectId: string
}

export function TagOnlyFindingsView({ projectId }: TagOnlyFindingsViewProps) {
  const state = useAppState()
  const [activeTab, setActiveTab] = useState<TabKey>('dotTable')
  const [dotStartDate, setDotStartDate] = useState<string | undefined>(undefined)

  const project = state.lab?.projects[projectId]
  const tags: Record<string, LabTagDef> = state.lab?.tagsByProject[projectId] || {}

  // Run analysis
  const result = runAnalysisForProject(state, projectId)

  // Persist cache
  useEffect(() => {
    if (result.updatedCache) {
      appStore.actions.updateFindingsCache(result.updatedCache)
    }
  }, [result.updatedCache])

  const frequencyFindings = useMemo(
    () =>
      result.findings
        .filter((f) => f.method === 'tag-frequency')
        .sort((a, b) => b.effect - a.effect),
    [result.findings],
  )

  const coOccurrenceFindings = useMemo(
    () =>
      result.findings
        .filter((f) => f.method === 'tag-co-occurrence')
        .sort((a, b) => b.effect - a.effect),
    [result.findings],
  )

  // Build dot table data for all tags
  const dotTableData = useMemo(() => {
    const allIds = Object.keys(tags)
    if (allIds.length === 0) return {}
    const dataset = buildTagOnlyDataset(state, projectId)
    return buildTagDotTableData(dataset, allIds, dotStartDate)
  }, [state, projectId, tags, dotStartDate])

  const dotTableLabels = useMemo(() => {
    const tagIds = Object.keys(tags)
    // Sort by presence count descending (most frequent tags on top)
    tagIds.sort((a, b) => {
      const aCount = Object.values(dotTableData[a] ?? {}).filter(Boolean).length
      const bCount = Object.values(dotTableData[b] ?? {}).filter(Boolean).length
      return bCount - aCount
    })
    const map: Record<string, string> = {}
    for (const tagId of tagIds) {
      map[tagId] = formatTagNameDisplay(tags[tagId]?.name || 'Unknown')
    }
    return map
  }, [tags, dotTableData])

  // All tag IDs sorted by frequency (most frequent first)
  const sortedTagIds = useMemo(() => {
    const freqMap = new Map<string, number>()
    for (const f of frequencyFindings) {
      freqMap.set(f.tagId, f.effect)
    }
    return Object.keys(tags).sort((a, b) => (freqMap.get(b) ?? 0) - (freqMap.get(a) ?? 0))
  }, [tags, frequencyFindings])

  if (!project) return null

  const notEnoughData = result.findings.length === 0

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={[styles.tab, activeTab === 'dotTable' && styles.tabActive].filter(Boolean).join(' ')}
          onClick={() => setActiveTab('dotTable')}
        >
          30-Day Table
        </button>
        <button
          type="button"
          className={[styles.tab, activeTab === 'frequency' && styles.tabActive].filter(Boolean).join(' ')}
          onClick={() => setActiveTab('frequency')}
        >
          Frequency
        </button>
        <button
          type="button"
          className={[styles.tab, activeTab === 'cooccurrence' && styles.tabActive].filter(Boolean).join(' ')}
          onClick={() => setActiveTab('cooccurrence')}
        >
          Co-occurrence
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <DataMaturityView projectId={projectId} />
        </div>
      </div>

      {activeTab === 'frequency' && (
        notEnoughData ? (
          <div className={styles.emptyHint}>
            Start logging tags to see frequency analysis. At least 5 logged days are needed.
          </div>
        ) : (
          <FrequencyTab findings={frequencyFindings} tags={tags} />
        )
      )}
      {activeTab === 'cooccurrence' && (
        notEnoughData ? (
          <div className={styles.emptyHint}>
            Start logging tags to see co-occurrence patterns. At least 5 logged days are needed.
          </div>
        ) : (
          <CoOccurrenceTab findings={coOccurrenceFindings} tags={tags} />
        )
      )}
      {activeTab === 'dotTable' && (
        <DotTableTab
          sortedTagIds={sortedTagIds}
          data={dotTableData}
          labels={dotTableLabels}
          startDate={dotStartDate}
          onStartDateChange={setDotStartDate}
        />
      )}
    </div>
  )
}

// ── Frequency Tab ───────────────────────────────────────────

function FrequencyTab({ findings, tags }: { findings: LabFinding[]; tags: Record<string, LabTagDef> }) {
  if (findings.length === 0) {
    return <div className={styles.emptyHint}>No frequency data yet.</div>
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Tag frequency</h3>
      <div className={styles.frequencyList}>
        {findings.map((f, i) => {
          const tag = tags[f.tagId]
          const name = formatTagNameDisplay(tag?.name || 'Unknown')
          const raw = f.rawData as { presentCount: number; totalDays: number; percent: number } | undefined
          const percent = raw?.percent ?? Math.round(f.effect * 100)

          return (
            <div key={f.tagId} className={styles.frequencyRow}>
              <span className={styles.frequencyRank}>{i + 1}.</span>
              <span className={styles.frequencyName}>{name}</span>
              <div className={styles.frequencyBar}>
                <div className={styles.frequencyBarFill} style={{ width: `${percent}%` }} />
              </div>
              <span className={styles.frequencyPercent}>{percent}%</span>
              {raw && <span className={styles.frequencySample}>{raw.presentCount}/{raw.totalDays}</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Co-occurrence Tab ───────────────────────────────────────

function CoOccurrenceTab({ findings, tags }: { findings: LabFinding[]; tags: Record<string, LabTagDef> }) {
  if (findings.length === 0) {
    return (
      <div className={styles.emptyHint}>
        No co-occurrence patterns found yet. Tags need to appear on at least 5 days each.
      </div>
    )
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Tag co-occurrence</h3>
      <div className={styles.pairList}>
        {findings.map((f) => {
          const raw = f.rawData as {
            tagIdA: string
            tagIdB: string
            coOccurrenceDays: number
            totalDays: number
            rate: number
            jaccard: number
          } | undefined

          if (!raw) return null

          const nameA = formatTagNameDisplay(tags[raw.tagIdA]?.name || 'Unknown')
          const nameB = formatTagNameDisplay(tags[raw.tagIdB]?.name || 'Unknown')
          const pctTogether = Math.round(raw.rate * 100)
          const jaccardPct = Math.round(raw.jaccard * 100)

          return (
            <div key={f.tagId} className={styles.pairCard}>
              <div className={styles.pairNames}>
                {nameA}
                <span className={styles.pairConnector}>&</span>
                {nameB}
              </div>
              <div className={styles.pairStats}>
                <span className={styles.pairStat}>
                  Together: <span className={styles.pairStatValue}>{raw.coOccurrenceDays}/{raw.totalDays} days ({pctTogether}%)</span>
                </span>
                <span className={styles.pairStat}>
                  Jaccard: <span className={styles.pairStatValue}>{jaccardPct}%</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── 30-Day Dot Table Tab ────────────────────────────────────

function DotTableTab({
  sortedTagIds,
  data,
  labels,
  startDate,
  onStartDateChange,
}: {
  sortedTagIds: string[]
  data: Record<string, Record<string, boolean>>
  labels: Record<string, string>
  startDate?: string
  onStartDateChange: (date: string) => void
}) {
  if (sortedTagIds.length === 0) {
    return <div className={styles.emptyHint}>No tags defined for this project.</div>
  }

  // Build ordered labels so DotTable rows follow frequency order
  const orderedLabels: Record<string, string> = {}
  for (const tagId of sortedTagIds) {
    if (labels[tagId]) orderedLabels[tagId] = labels[tagId]
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>30-Day Tag Presence</h3>
      <DotTable
        data={data}
        labels={orderedLabels}
        startDate={startDate}
        onStartDateChange={onStartDateChange}
      />
    </section>
  )
}
