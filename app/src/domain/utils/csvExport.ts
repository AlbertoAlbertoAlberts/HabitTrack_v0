import type { AppStateV1 } from '../types'

// ── helpers ────────────────────────────────────────────────

/** RFC 4180: quote a field if it contains comma, quote, or newline. */
function csvField(value: string | number | undefined | null): string {
  if (value == null || value === '') return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Sanitise a name for use as a CSV column header. */
function colName(raw: string): string {
  return raw.replace(/[,"\r\n]+/g, ' ').trim()
}

function dateFromTimestamp(ts: string): string {
  return ts.slice(0, 10) // "YYYY-MM-DD"
}

/** Monday of the ISO week containing `dateStr`. */
function weekStartFor(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun…6=Sat
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function inRange(date: string, start?: string, end?: string): boolean {
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── public types ───────────────────────────────────────────

export interface CsvExportOptions {
  projectIds: string[]
  includeDailyHabits: boolean
  includeWeeklyTasks: boolean
  startDate?: string
  endDate?: string
}

// ── date-indexed CSV (daily lab, habits, weekly) ───────────

export function buildDateIndexedCsv(state: AppStateV1, opts: CsvExportOptions): string {
  const lab = state.lab
  const dailyProjectIds = opts.projectIds.filter(
    (id) => lab?.projects[id]?.mode === 'daily',
  )
  const tagOnlyProjectIds = opts.projectIds.filter(
    (id) => lab?.projects[id]?.mode === 'daily-tag-only',
  )
  const multiChoiceProjectIds = opts.projectIds.filter(
    (id) => lab?.projects[id]?.mode === 'daily-multi-choice',
  )

  // ── collect all dates ────────────────────────────────────
  const dateSet = new Set<string>()

  // lab daily logs (daily + tag-only share dailyLogsByProject)
  for (const pid of [...dailyProjectIds, ...tagOnlyProjectIds]) {
    const logs = lab?.dailyLogsByProject[pid]
    if (logs) Object.keys(logs).forEach((d) => dateSet.add(d))
  }

  // lab multi-choice logs
  for (const pid of multiChoiceProjectIds) {
    const logs = lab?.multiChoiceLogsByProject[pid]
    if (logs) Object.keys(logs).forEach((d) => dateSet.add(d))
  }

  // daily habit scores
  if (opts.includeDailyHabits) {
    Object.keys(state.dailyScores).forEach((d) => dateSet.add(d))
  }

  // weekly tasks – expand completion days
  if (opts.includeWeeklyTasks) {
    const cd = state.weeklyCompletionDays
    for (const weekStart of Object.keys(cd)) {
      for (const taskId of Object.keys(cd[weekStart])) {
        const days = cd[weekStart][taskId]
        if (days) days.forEach((d) => dateSet.add(d))
      }
    }
    // also include dates implied by weeklyProgress keys
    Object.keys(state.weeklyProgress).forEach((ws) => dateSet.add(ws))
  }

  // filter & sort
  const dates = Array.from(dateSet)
    .filter((d) => inRange(d, opts.startDate, opts.endDate))
    .sort()

  if (dates.length === 0) return ''

  // ── build columns ────────────────────────────────────────
  const headers: string[] = ['date']
  type RowGetter = (date: string) => string | number | undefined

  const getters: RowGetter[] = []

  // lab daily projects
  for (const pid of dailyProjectIds) {
    const project = lab!.projects[pid]
    const pName = colName(project.name)
    const tags = lab!.tagsByProject[pid] ?? {}
    const tagOrder = lab!.tagOrderByProject[pid] ?? Object.keys(tags)
    const logs = lab!.dailyLogsByProject[pid] ?? {}

    headers.push(`${pName}_outcome`)
    getters.push((d) => logs[d]?.outcome)

    // additional outcomes (multi-outcome daily projects)
    const config = project.config
    if (config.kind === 'daily' && config.additionalOutcomes) {
      for (const ao of config.additionalOutcomes) {
        headers.push(`${pName}_${colName(ao.name)}`)
        getters.push((d) => logs[d]?.additionalOutcomes?.[ao.id])
      }
    }

    for (const tid of tagOrder) {
      const tag = tags[tid]
      if (!tag) continue
      const tName = colName(tag.name)
      headers.push(`${pName}_${tName}`)
      getters.push((d) => {
        const log = logs[d]
        if (!log) return undefined
        return log.tags.some((t) => t.tagId === tid) ? 1 : 0
      })
      if (tag.intensity?.enabled) {
        headers.push(`${pName}_${tName}_intensity`)
        getters.push((d) => {
          const log = logs[d]
          if (!log) return undefined
          const use = log.tags.find((t) => t.tagId === tid)
          return use?.intensity
        })
      }
    }

    headers.push(`${pName}_note`)
    getters.push((d) => logs[d]?.note)
  }

  // lab tag-only projects (date + tags, no outcome)
  for (const pid of tagOnlyProjectIds) {
    const project = lab!.projects[pid]
    const pName = colName(project.name)
    const tags = lab!.tagsByProject[pid] ?? {}
    const tagOrder = lab!.tagOrderByProject[pid] ?? Object.keys(tags)
    const logs = lab!.dailyLogsByProject[pid] ?? {}

    for (const tid of tagOrder) {
      const tag = tags[tid]
      if (!tag) continue
      const tName = colName(tag.name)
      headers.push(`${pName}_${tName}`)
      getters.push((d) => {
        const log = logs[d]
        if (!log) return undefined
        return log.tags.some((t) => t.tagId === tid) ? 1 : 0
      })
      if (tag.intensity?.enabled) {
        headers.push(`${pName}_${tName}_intensity`)
        getters.push((d) => {
          const log = logs[d]
          if (!log) return undefined
          const use = log.tags.find((t) => t.tagId === tid)
          return use?.intensity
        })
      }
    }

    headers.push(`${pName}_note`)
    getters.push((d) => logs[d]?.note)
  }

  // lab multi-choice projects (date + each option as 0/1)
  for (const pid of multiChoiceProjectIds) {
    const project = lab!.projects[pid]
    const pName = colName(project.name)
    const config = project.config
    if (config.kind !== 'daily-multi-choice') continue

    const mcLogs = lab!.multiChoiceLogsByProject[pid] ?? {}

    for (const option of config.options) {
      if (option.archived) continue
      headers.push(`${pName}_${colName(option.label)}`)
      getters.push((d) => {
        const log = mcLogs[d]
        if (!log) return undefined
        return log.selectedOptionIds.includes(option.id) ? 1 : 0
      })
    }

    headers.push(`${pName}_note`)
    getters.push((d) => mcLogs[d]?.note)
  }

  // daily habits
  if (opts.includeDailyHabits) {
    const habitList = Object.values(state.habits).sort((a, b) => a.sortIndex - b.sortIndex)
    for (const h of habitList) {
      headers.push(`habit_${colName(h.name)}`)
      getters.push((d) => state.dailyScores[d]?.[h.id])
    }
  }

  // weekly tasks
  if (opts.includeWeeklyTasks) {
    const taskList = Object.values(state.weeklyTasks).sort((a, b) => a.sortIndex - b.sortIndex)
    for (const t of taskList) {
      headers.push(`weekly_${colName(t.name)}_completions`)
      getters.push((d) => {
        const ws = weekStartFor(d)
        return state.weeklyProgress[ws]?.[t.id]
      })
      headers.push(`weekly_${colName(t.name)}_target`)
      getters.push((d) => {
        const ws = weekStartFor(d)
        // Simple approach: use the task's current target
        // (targetHistory lookup isn't needed for raw export)
        if (state.weeklyProgress[ws] === undefined) return undefined
        return t.targetPerWeek
      })
    }
  }

  // ── assemble CSV ─────────────────────────────────────────
  const lines: string[] = [headers.map(csvField).join(',')]
  for (const d of dates) {
    const row = [d, ...getters.map((fn) => csvField(fn(d)))]
    lines.push(row.join(','))
  }

  return lines.join('\r\n') + '\r\n'
}

// ── event CSV ──────────────────────────────────────────────

export function buildEventCsv(
  state: AppStateV1,
  projectId: string,
  startDate?: string,
  endDate?: string,
): string {
  const lab = state.lab
  if (!lab) return ''
  const project = lab.projects[projectId]
  if (!project || project.mode !== 'event') return ''

  const tags = lab.tagsByProject[projectId] ?? {}
  const tagOrder = lab.tagOrderByProject[projectId] ?? Object.keys(tags)
  const logsMap = lab.eventLogsByProject[projectId] ?? {}

  const severityEnabled = project.config.kind === 'event' && project.config.event.severity?.enabled

  // sort by timestamp
  const logs = Object.values(logsMap)
    .filter((l) => {
      const d = dateFromTimestamp(l.timestamp)
      return inRange(d, startDate, endDate)
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  if (logs.length === 0) return ''

  // columns
  const headers: string[] = ['timestamp']
  if (severityEnabled) headers.push('severity')

  for (const tid of tagOrder) {
    const tag = tags[tid]
    if (!tag) continue
    headers.push(colName(tag.name))
    if (tag.intensity?.enabled) headers.push(`${colName(tag.name)}_intensity`)
  }
  headers.push('note')

  // rows
  const lines: string[] = [headers.map(csvField).join(',')]
  for (const log of logs) {
    const row: (string | number | undefined)[] = [log.timestamp]
    if (severityEnabled) row.push(log.severity)

    for (const tid of tagOrder) {
      const tag = tags[tid]
      if (!tag) continue
      const use = log.tags.find((t) => t.tagId === tid)
      row.push(use ? 1 : 0)
      if (tag.intensity?.enabled) row.push(use?.intensity)
    }
    row.push(log.note)

    lines.push(row.map(csvField).join(','))
  }

  return lines.join('\r\n') + '\r\n'
}

// ── trigger download ───────────────────────────────────────

export function triggerCsvDownload(filename: string, csvContent: string): void {
  // BOM for Excel UTF-8 recognition
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── convenience: build filename with today's date ──────────

export function exportFilename(label: string): string {
  return `habittrack-${label}-${todayISO()}.csv`
}
