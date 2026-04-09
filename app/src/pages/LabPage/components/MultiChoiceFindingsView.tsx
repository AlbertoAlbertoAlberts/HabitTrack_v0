import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import { runAnalysisForProject } from '../../../domain/lab/analysis/runner'
import { buildMultiChoiceDataset } from '../../../domain/lab/analysis/datasetBuilders'
import { buildChoiceGridData } from '../../../domain/lab/analysis/multiChoiceMethods'
import type { LabFinding } from '../../../domain/lab/analysis/types'
import type { LabMultiChoiceOption } from '../../../domain/types'
import { DataMaturityView } from './DataMaturityView'
import { DotTable } from './DotTable'
import styles from './MultiChoiceFindingsView.module.css'

type TabKey = 'overview' | 'dotTable'

interface MultiChoiceFindingsViewProps {
  projectId: string
}

export function MultiChoiceFindingsView({ projectId }: MultiChoiceFindingsViewProps) {
  const state = useAppState()
  const [activeTab, setActiveTab] = useState<TabKey>('dotTable')
  const [dotStartDate, setDotStartDate] = useState<string | undefined>(undefined)

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

  // Option ID → label lookup (includes archived for historical data)
  const optionLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const opt of allOptions) {
      map[opt.id] = opt.label
    }
    return map
  }, [allOptions])

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

      {activeTab === 'overview' && (
        notEnoughData ? (
          <div className={styles.emptyHint}>
            Start logging choices to see frequency analysis. At least 5 logged days are needed.
          </div>
        ) : (
          <OverviewTab findings={frequencyFindings} optionLabels={optionLabels} />
        )
      )}
    </div>
  )
}

// ── Overview Tab ────────────────────────────────────────────

function OverviewTab({
  findings,
  optionLabels,
}: {
  findings: LabFinding[]
  optionLabels: Record<string, string>
}) {
  if (findings.length === 0) {
    return <div className={styles.emptyHint}>No frequency data yet.</div>
  }

  return (
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
  )
}
