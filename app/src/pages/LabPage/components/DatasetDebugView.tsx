import { useState } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import type { DailyDataset, EventDataset } from '../../../domain/lab/analysis/datasetBuilders'
import { buildDailyDataset, buildEventDailyFrequency, buildEventDataset } from '../../../domain/lab/analysis/datasetBuilders'
import { importMorningDummyMoreTagsIfNeeded } from '../../../domain/lab/seed/morningDummyMoreTagsSeed'
import { importBloatingDummyIfNeeded } from '../../../domain/lab/seed/bloatingDummySeed'
import sharedStyles from '../../../components/ui/shared.module.css'
import styles from './DatasetDebugView.module.css'

export function DatasetDebugView() {
  const state = useAppState()
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  const canImportSeeds =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))

  const projects = Object.values(state.lab?.projects || {}).filter((p) => !p.archived)

  if (projects.length === 0) {
    return (
      <div className={styles.empty}>
        No projects available. Create a project to see debug data.
      </div>
    )
  }

  const selectedProject = selectedProjectId ? state.lab?.projects[selectedProjectId] : null
  
  let dataset: DailyDataset | EventDataset | null = null
  let eventFrequencyStats: { distinctDays: number; maxEventsPerDay: number } | null = null
  if (selectedProject) {
    if (selectedProject.mode === 'daily') {
      dataset = buildDailyDataset(state, selectedProjectId)
    } else {
      dataset = buildEventDataset(state, selectedProjectId)

      const daily = buildEventDailyFrequency(state, selectedProjectId)
      const maxEventsPerDay = daily.reduce((max, r) => Math.max(max, r.count), 0)
      eventFrequencyStats = {
        distinctDays: daily.length,
        maxEventsPerDay,
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Dataset Debug View</h3>
        <div className={styles.controls}>
          {canImportSeeds && (
            <>
              <button
                type="button"
                className={[sharedStyles.smallBtn, styles.controlBtn].join(' ')}
                onClick={() => {
                  importMorningDummyMoreTagsIfNeeded()
                  const next = appStore.getState()
                  const project = Object.values(next.lab?.projects || {}).find((p) => p.name === 'morning_dummy_more_tags')
                  if (project) setSelectedProjectId(project.id)
                }}
              >
                Import morning_dummy_more_tags
              </button>

              <button
                type="button"
                className={[sharedStyles.smallBtn, styles.controlBtn].join(' ')}
                onClick={() => {
                  importBloatingDummyIfNeeded()
                  const next = appStore.getState()
                  const project = Object.values(next.lab?.projects || {}).find((p) => p.name === 'bloating_dummy')
                  if (project) setSelectedProjectId(project.id)
                }}
              >
                Import bloating_dummy
              </button>
            </>
          )}

          <select
            className={styles.select}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">Select a project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.mode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {dataset && (
        <div className={styles.content}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Total Logs:</span>
              <span className={styles.statValue}>{dataset.coverage.totalLogs}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Valid Rows:</span>
              <span className={styles.statValue}>{dataset.coverage.validRows}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Skipped:</span>
              <span className={styles.statValue}>{dataset.coverage.skippedRows}</span>
            </div>

            {eventFrequencyStats && (
              <>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Days With Events:</span>
                  <span className={styles.statValue}>{eventFrequencyStats.distinctDays}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Max Events/Day:</span>
                  <span className={styles.statValue}>{eventFrequencyStats.maxEventsPerDay}</span>
                </div>
              </>
            )}
          </div>

          <div className={styles.jsonContainer}>
            <pre className={styles.json}>{JSON.stringify(dataset, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
