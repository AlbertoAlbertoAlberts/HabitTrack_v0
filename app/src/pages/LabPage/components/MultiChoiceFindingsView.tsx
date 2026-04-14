import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import { runAnalysisForProject } from '../../../domain/lab/analysis/runner'
import { buildMultiChoiceDataset } from '../../../domain/lab/analysis/datasetBuilders'
import { buildChoiceGridData } from '../../../domain/lab/analysis/multiChoiceMethods'
import { buildMultiChoiceTagDotData } from '../../../domain/lab/analysis/tagOnlyMethods'
import type { LabFinding } from '../../../domain/lab/analysis/types'
import type { LabMultiChoiceOption } from '../../../domain/types'
import { formatTagNameDisplay } from '../../../domain/lab/utils/tagDisplay'
import { DataMaturityView } from './DataMaturityView'
import { DotTable } from './DotTable'
import styles from './MultiChoiceFindingsView.module.css'

type TabKey = 'overview' | 'dotTable' | 'tagDotTable'

interface MultiChoiceFindingsViewProps {
  projectId: string
}

export function MultiChoiceFindingsView({ projectId }: MultiChoiceFindingsViewProps) {
  const state = useAppState()
  const [activeTab, setActiveTab] = useState<TabKey>('dotTable')
  const [dotStartDate, setDotStartDate] = useState<string | undefined>(undefined)
  const [tagDotStartDate, setTagDotStartDate] = useState<string | undefined>(undefined)

  const project = state.lab?.projects[projectId]

  // Run analysis
  const result = runAnalysisForProject(state, projectId)

  // Persist cache
  useEffect(() => {
    if (result.updatedCache) {
      appStore.actions.updateFindingsCache(result.updatedCache)
    }
  }, [result.updatedCache])

  const options: LabMultiChoiceOption[] = useMemo(() => {
    if (!project || project.config.kind !== 'daily-multi-choice') return []
    return project.config.options.filter((o) => !o.archived)
  }, [project])

  const allOptions: LabMultiChoiceOption[] = useMemo(() => {
    if (!project || project.config.kind !== 'daily-multi-choice') return []
    return project.config.options
  }, [project])

  const frequencyFindings = useMemo(
    () =>
      result.findings
        .filter((f) => f.method === 'choice-frequency')
        .sort((a, b) => b.effect - a.effect),
    [result.findings],
  )

  const tagChoiceFindings = useMemo(
    () =>
      result.findings
        .filter((f) => f.method === 'tag-choice-correlation')
        .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)),
    [result.findings],
  )

  // Option ID → label lookup (includes archived for historical data)
  const optionLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const opt of allOptions) {
      map[opt.id] = opt.label
    }
    return map
  }, [allOptions])

  // Tag ID → name lookup
  const tags = state.lab?.tagsByProject[projectId] ?? {}
  const tagLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [id, tag] of Object.entries(tags)) {
      map[id] = tag.name
    }
    return map
  }, [tags])

  const tagsEnabled = project?.config.kind === 'daily-multi-choice' && project.config.tagsEnabled === true
  const hasProjectTags = Object.keys(tags).length > 0
  const showTagPresence = tagsEnabled && hasProjectTags

  // Build 30-day grid data
  const activeOptionIds = useMemo(() => options.map((o) => o.id), [options])

  const dotTableData = useMemo(() => {
    if (activeOptionIds.length === 0) return {}
    const dataset = buildMultiChoiceDataset(state, projectId)
    return buildChoiceGridData(dataset, activeOptionIds, dotStartDate)
  }, [state, projectId, activeOptionIds, dotStartDate])

  const dotTableLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const optId of activeOptionIds) {
      map[optId] = optionLabels[optId] || 'Unknown'
    }
    return map
  }, [activeOptionIds, optionLabels])

  // Build tag presence dot-table data (only when tags enabled)
  const tagDotTableData = useMemo(() => {
    if (!showTagPresence) return {}
    const tagIds = Object.keys(tags)
    if (tagIds.length === 0) return {}
    const dataset = buildMultiChoiceDataset(state, projectId)
    return buildMultiChoiceTagDotData(dataset, tagIds, tagDotStartDate)
  }, [showTagPresence, state, projectId, tags, tagDotStartDate])

  const tagDotTableLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [tagId, tag] of Object.entries(tags)) {
      map[tagId] = formatTagNameDisplay(tag.name)
    }
    return map
  }, [tags])

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
        {showTagPresence && (
          <button
            type="button"
            className={[styles.tab, activeTab === 'tagDotTable' && styles.tabActive].filter(Boolean).join(' ')}
            onClick={() => setActiveTab('tagDotTable')}
          >
            Tag Presence
          </button>
        )}
        <button
          type="button"
          className={[styles.tab, activeTab === 'overview' && styles.tabActive].filter(Boolean).join(' ')}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <DataMaturityView projectId={projectId} />
        </div>
      </div>

      {activeTab === 'dotTable' && (
        options.length === 0 ? (
          <div className={styles.emptyHint}>
            All options are archived. Add new options to see the 30-day table.
          </div>
        ) : (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>30-Day Choice Grid</h3>
            <DotTable
              data={dotTableData}
              labels={dotTableLabels}
              startDate={dotStartDate}
              onStartDateChange={setDotStartDate}
            />
          </section>
        )
      )}

      {activeTab === 'tagDotTable' && showTagPresence && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>30-Day Tag Presence</h3>
          <DotTable
            data={tagDotTableData}
            labels={tagDotTableLabels}
            startDate={tagDotStartDate}
            onStartDateChange={setTagDotStartDate}
          />
        </section>
      )}

      {activeTab === 'overview' && (
        notEnoughData ? (
          <div className={styles.emptyHint}>
            Start logging choices to see frequency analysis. At least 5 logged days are needed.
          </div>
        ) : (
          <OverviewTab findings={frequencyFindings} tagChoiceFindings={tagChoiceFindings} optionLabels={optionLabels} tagLabels={tagLabels} />
        )
      )}
    </div>
  )
}

// ── Overview Tab ────────────────────────────────────────────

function OverviewTab({
  findings,
  tagChoiceFindings,
  optionLabels,
  tagLabels,
}: {
  findings: LabFinding[]
  tagChoiceFindings: LabFinding[]
  optionLabels: Record<string, string>
  tagLabels: Record<string, string>
}) {
  if (findings.length === 0 && tagChoiceFindings.length === 0) {
    return <div className={styles.emptyHint}>No frequency data yet.</div>
  }

  return (
    <>
      {findings.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Choice frequency</h3>
          <div className={styles.frequencyList}>
            {findings.map((f, i) => {
              // tagId has format "option:<optionId>"
              const optionId = f.tagId.replace(/^option:/, '')
              const label = optionLabels[optionId] || 'Unknown'
              const raw = f.rawData as { selectedCount: number; totalDays: number; percent: number } | undefined
              const percent = raw?.percent ?? Math.round(f.effect * 100)

              return (
                <div key={f.tagId} className={styles.frequencyRow}>
                  <span className={styles.frequencyRank}>{i + 1}.</span>
                  <span className={styles.frequencyName}>{label}</span>
                  <div className={styles.frequencyBar}>
                    <div className={styles.frequencyBarFill} style={{ width: `${percent}%` }} />
                  </div>
                  <span className={styles.frequencyPercent}>{percent}%</span>
                  {raw && <span className={styles.frequencySample}>{raw.selectedCount}/{raw.totalDays}</span>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {tagChoiceFindings.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Tag → Choice correlations</h3>
          <div className={styles.frequencyList}>
            {tagChoiceFindings.map((f, i) => {
              const raw = f.rawData as { optionId: string; rateWith: number; rateWithout: number; withTagTotal: number; withoutTagTotal: number } | undefined
              const tagName = tagLabels[f.tagId] || f.tagId
              const optionName = raw ? (optionLabels[raw.optionId] || 'Unknown') : 'Unknown'
              const percentDiff = Math.round(f.effect * 100)
              const sign = percentDiff > 0 ? '+' : ''

              return (
                <div key={`${f.tagId}-${raw?.optionId}-${i}`} className={styles.frequencyRow}>
                  <span className={styles.frequencyName} style={{ flex: 2 }}>
                    {tagName} → {optionName}
                  </span>
                  <span className={styles.frequencyPercent} style={{ color: percentDiff > 0 ? 'var(--color-positive, #4ade80)' : 'var(--color-negative, #f87171)' }}>
                    {sign}{percentDiff}%
                  </span>
                  <span className={styles.frequencySample}>
                    n={f.sampleSize}
                    {f.confidence === 'low' && ' ⚠'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}
