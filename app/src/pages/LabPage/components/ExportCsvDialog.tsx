import { useState } from 'react'
import { Dialog, DialogBody, DialogFooter, dialogStyles } from '../../../components/ui/Dialog'
import { useAppState } from '../../../domain/store/useAppStore'
import {
  buildDateIndexedCsv,
  buildEventCsv,
  triggerCsvDownload,
  exportFilename,
} from '../../../domain/utils/csvExport'
import type { CsvExportOptions } from '../../../domain/utils/csvExport'
import styles from './ExportCsvDialog.module.css'

interface Props {
  open: boolean
  onClose: () => void
}

export function ExportCsvDialog({ open, onClose }: Props) {
  const state = useAppState()
  const lab = state.lab

  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [includeDailyHabits, setIncludeDailyHabits] = useState(false)
  const [includeWeeklyTasks, setIncludeWeeklyTasks] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const projects = lab
    ? lab.projectOrder
        .map((id) => lab.projects[id])
        .filter((p) => p && !p.archived)
    : []

  const hasHabits = Object.keys(state.habits).length > 0
  const hasWeeklyTasks = Object.keys(state.weeklyTasks).length > 0

  const nothingSelected =
    selectedProjectIds.size === 0 && !includeDailyHabits && !includeWeeklyTasks

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDownload = () => {
    const ids = Array.from(selectedProjectIds)
    const dateIndexedProjectIds = ids.filter((id) => {
      const mode = lab?.projects[id]?.mode
      return mode === 'daily' || mode === 'daily-tag-only' || mode === 'daily-multi-choice'
    })
    const eventProjectIds = ids.filter((id) => lab?.projects[id]?.mode === 'event')
    const sd = startDate || undefined
    const ed = endDate || undefined

    // date-indexed CSV (daily lab projects + habits + weekly)
    if (dateIndexedProjectIds.length > 0 || includeDailyHabits || includeWeeklyTasks) {
      const opts: CsvExportOptions = {
        projectIds: dateIndexedProjectIds,
        includeDailyHabits,
        includeWeeklyTasks,
        startDate: sd,
        endDate: ed,
      }
      const csv = buildDateIndexedCsv(state, opts)
      if (csv) triggerCsvDownload(exportFilename('export'), csv)
    }

    // one event CSV per event project
    for (const pid of eventProjectIds) {
      const name = lab?.projects[pid]?.name ?? 'events'
      const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
      const csv = buildEventCsv(state, pid, sd, ed)
      if (csv) triggerCsvDownload(exportFilename(`${safe}-events`), csv)
    }

    onClose()
  }

  return (
    <Dialog open={open} title="Export CSV" onClose={onClose}>
      <DialogBody>
        {/* Lab Projects */}
        {projects.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Lab Projects</div>
            {projects.map((p) => (
              <label key={p.id} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={selectedProjectIds.has(p.id)}
                  onChange={() => toggleProject(p.id)}
                />
                <span className={styles.checkLabel}>{p.name}</span>
                <span className={styles.badge}>{p.mode}</span>
              </label>
            ))}
          </div>
        )}

        {/* Daily Habits */}
        {hasHabits && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Daily Habits</div>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={includeDailyHabits}
                onChange={() => setIncludeDailyHabits(!includeDailyHabits)}
              />
              <span className={styles.checkLabel}>Daily Habit Scores</span>
            </label>
          </div>
        )}

        {/* Weekly Tasks */}
        {hasWeeklyTasks && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Weekly Tasks</div>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={includeWeeklyTasks}
                onChange={() => setIncludeWeeklyTasks(!includeWeeklyTasks)}
              />
              <span className={styles.checkLabel}>Weekly Task Completions</span>
            </label>
          </div>
        )}

        {/* Date Range */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Date Range</div>
          <div className={styles.dateRow}>
            <label className={styles.dateLabel}>
              From
              <input
                type="date"
                className={styles.dateInput}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className={styles.dateLabel}>
              To
              <input
                type="date"
                className={styles.dateInput}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>
          <div className={styles.hint}>Leave blank to export all data.</div>
        </div>
      </DialogBody>

      <DialogFooter>
        <button type="button" className={dialogStyles.btn} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
          disabled={nothingSelected}
          onClick={handleDownload}
        >
          Download CSV
        </button>
      </DialogFooter>
    </Dialog>
  )
}
