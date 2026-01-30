import type { AppStateV1, LabDailyLog, LabEventLog } from '../../types'
import { toLocalDateString } from '../../utils/localDate'

// Episode segmentation: events within this gap are considered part of the same episode.
export const DEFAULT_EVENT_EPISODE_GAP_HOURS = 12

/**
 * Daily dataset row: one entry per date
 */
export interface DailyDatasetRow {
  date: string // ISO date
  outcome?: number
  tags: Record<string, { present: boolean; intensity?: number }>
}

/**
 * Event dataset row: one entry per event
 */
export interface EventDatasetRow {
  timestamp: string // ISO timestamp
  severity?: number
  tags: Record<string, { present: boolean; intensity?: number }>
  note?: string

  // Derived episode/streak fields (optional, analysis-oriented)
  episodeId?: string
  episodeIndexWithinStreak?: number
  streakLength?: number
}

/**
 * Coverage statistics for a dataset
 */
export interface DatasetCoverage {
  totalLogs: number
  validRows: number
  skippedRows: number
}

/**
 * Dataset with coverage stats
 */
export interface DailyDataset {
  rows: DailyDatasetRow[]
  coverage: DatasetCoverage
}

export interface EventDataset {
  rows: EventDatasetRow[]
  coverage: DatasetCoverage
}

/**
 * Event daily frequency row: one entry per local date.
 * Useful for simple “how often did events happen?” visuals.
 */
export interface EventDailyFrequencyRow {
  date: string // LocalDateString
  count: number
}

export interface EventDailySummaryRow {
  date: string // LocalDateString
  count: number
  maxSeverity?: number
  avgSeverity?: number
  severityCount: number
}

export interface EventEpisodeSummaryRow {
  episodeId: string
  startTimestamp: string // ISO timestamp
  endTimestamp: string // ISO timestamp
  eventCount: number
  durationHours: number
  gapSincePrevEpisodeHours?: number
  severityCount: number
  maxSeverity?: number
  avgSeverity?: number
}

export interface EventGroupDataset {
  rows: EventDatasetRow[]
  coverage: DatasetCoverage
  groupKeyToName: Record<string, string>
}

/**
 * Build a day-level dataset for an event project where:
 * - each day in the observed range is a row
 * - outcome is 1 if any event occurred that day, else 0
 * - tag presence is derived from tags used on events that day (any-event OR)
 *
 * This is an inferred baseline: days with no events have no explicit exposure logs.
 */
export function buildEventOccurrenceDailyDataset(state: AppStateV1, projectId: string): DailyDataset {
  const project = state.lab?.projects[projectId]
  if (!project || project.mode !== 'event') {
    return { rows: [], coverage: { totalLogs: 0, validRows: 0, skippedRows: 0 } }
  }

  const eventDataset = buildEventDataset(state, projectId)
  const { rows: eventRows } = eventDataset
  if (eventRows.length === 0) {
    return { rows: [], coverage: { totalLogs: 0, validRows: 0, skippedRows: 0 } }
  }

  // Build a per-day tag presence map from event rows.
  const dayTagPresence = new Map<string, Record<string, boolean>>()
  const dayEventCount = new Map<string, number>()

  for (const row of eventRows) {
    const day = toLocalDateString(new Date(row.timestamp))
    dayEventCount.set(day, (dayEventCount.get(day) || 0) + 1)

    const prev = dayTagPresence.get(day) || {}
    const next = { ...prev }
    for (const [tagId, meta] of Object.entries(row.tags)) {
      if (meta?.present) next[tagId] = true
    }
    dayTagPresence.set(day, next)
  }

  // Determine local-date range from earliest to latest event.
  const minMs = Math.min(...eventRows.map((r) => Date.parse(r.timestamp)).filter((ms) => Number.isFinite(ms)))
  const maxMs = Math.max(...eventRows.map((r) => Date.parse(r.timestamp)).filter((ms) => Number.isFinite(ms)))

  const start = new Date(minMs)
  const end = new Date(maxMs)
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  // Use all tag keys from the first row (event dataset initializes all project tags)
  const allTagIds = Object.keys(eventRows[0].tags)

  const rows: DailyDatasetRow[] = []
  while (cursor.getTime() <= endDay.getTime()) {
    const date = toLocalDateString(cursor)
    const presentMap = dayTagPresence.get(date) || {}
    const tags: Record<string, { present: boolean }> = {}
    for (const tagId of allTagIds) {
      tags[tagId] = { present: !!presentMap[tagId] }
    }

    rows.push({
      date,
      outcome: (dayEventCount.get(date) || 0) > 0 ? 1 : 0,
      tags,
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return {
    rows,
    coverage: {
      totalLogs: rows.length,
      validRows: rows.length,
      skippedRows: 0,
    },
  }
}

/**
 * Build an episode-level summary for an event project.
 * Episodes are defined by DEFAULT_EVENT_EPISODE_GAP_HOURS in buildEventDataset().
 */
export function buildEventEpisodeSummary(state: AppStateV1, projectId: string): EventEpisodeSummaryRow[] {
  const project = state.lab?.projects[projectId]
  if (!project || project.mode !== 'event') return []

  const dataset = buildEventDataset(state, projectId)
  const { rows } = dataset
  if (rows.length === 0) return []

  const episodesInOrder: { id: string; rows: EventDatasetRow[] }[] = []
  const indexById = new Map<string, number>()

  for (const row of rows) {
    const id = row.episodeId || 'ep-1'
    const idx = indexById.get(id)
    if (idx === undefined) {
      indexById.set(id, episodesInOrder.length)
      episodesInOrder.push({ id, rows: [row] })
    } else {
      episodesInOrder[idx].rows.push(row)
    }
  }

  const getMs = (ts: string): number => {
    const ms = Date.parse(ts)
    return Number.isFinite(ms) ? ms : 0
  }

  const summaries: EventEpisodeSummaryRow[] = []
  let prevEndMs: number | undefined

  for (const ep of episodesInOrder) {
    const epRows = ep.rows
    const startTimestamp = epRows[0].timestamp
    const endTimestamp = epRows[epRows.length - 1].timestamp

    const startMs = getMs(startTimestamp)
    const endMs = getMs(endTimestamp)
    const durationHours = Number(((endMs - startMs) / (60 * 60 * 1000)).toFixed(2))

    let gapSincePrevEpisodeHours: number | undefined
    if (prevEndMs !== undefined) {
      gapSincePrevEpisodeHours = Number(((startMs - prevEndMs) / (60 * 60 * 1000)).toFixed(2))
    }
    prevEndMs = endMs

    let severityCount = 0
    let severitySum = 0
    let maxSeverity: number | undefined

    for (const r of epRows) {
      const sev = r.severity
      if (typeof sev === 'number' && Number.isFinite(sev)) {
        severityCount++
        severitySum += sev
        maxSeverity = maxSeverity === undefined ? sev : Math.max(maxSeverity, sev)
      }
    }

    const avgSeverity = severityCount > 0 ? severitySum / severityCount : undefined

    summaries.push({
      episodeId: ep.id,
      startTimestamp,
      endTimestamp,
      eventCount: epRows.length,
      durationHours,
      gapSincePrevEpisodeHours,
      severityCount,
      maxSeverity,
      avgSeverity,
    })
  }

  return summaries
}

/**
 * Build normalized dataset for a daily project
 * Pure function: takes state + projectId, returns dataset with coverage stats
 */
export function buildDailyDataset(state: AppStateV1, projectId: string): DailyDataset {
  const project = state.lab?.projects[projectId]
  if (!project || project.mode !== 'daily' || project.config.kind !== 'daily') {
    return { rows: [], coverage: { totalLogs: 0, validRows: 0, skippedRows: 0 } }
  }

  const logs = state.lab?.dailyLogsByProject[projectId] || {}
  const projectTags = state.lab?.tagsByProject[projectId] || {}
  const { requireOutcome } = project.config.completion

  const rows: DailyDatasetRow[] = []
  let skippedRows = 0

  for (const [date, log] of Object.entries(logs) as [string, LabDailyLog][]) {
    // Skip incomplete rows
    if (requireOutcome && log.outcome === undefined) {
      skippedRows++
      continue
    }

    // Build tag map
    const tags: Record<string, { present: boolean; intensity?: number }> = {}
    
    // Initialize all project tags as absent
    for (const tagId of Object.keys(projectTags)) {
      tags[tagId] = { present: false }
    }

    // Mark present tags
    for (const tagUse of log.tags) {
      tags[tagUse.tagId] = {
        present: true,
        intensity: tagUse.intensity,
      }
    }

    rows.push({
      date,
      outcome: log.outcome,
      tags,
    })
  }

  // Sort by date ascending
  rows.sort((a, b) => a.date.localeCompare(b.date))

  return {
    rows,
    coverage: {
      totalLogs: Object.keys(logs).length,
      validRows: rows.length,
      skippedRows,
    },
  }
}

/**
 * Build normalized dataset for an event project
 * Pure function: takes state + projectId, returns dataset with coverage stats
 */
export function buildEventDataset(state: AppStateV1, projectId: string): EventDataset {
  const project = state.lab?.projects[projectId]
  if (!project || project.mode !== 'event') {
    return { rows: [], coverage: { totalLogs: 0, validRows: 0, skippedRows: 0 } }
  }

  const logs = state.lab?.eventLogsByProject[projectId] || {}
  const projectTags = state.lab?.tagsByProject[projectId] || {}

  const rows: EventDatasetRow[] = []

  for (const log of Object.values(logs) as LabEventLog[]) {
    // Build tag map
    const tags: Record<string, { present: boolean; intensity?: number }> = {}

    // Initialize all project tags as absent
    for (const tagId of Object.keys(projectTags)) {
      tags[tagId] = { present: false }
    }

    // Mark present tags
    for (const tagUse of log.tags) {
      tags[tagUse.tagId] = {
        present: true,
        intensity: tagUse.intensity,
      }
    }

    rows.push({
      timestamp: log.timestamp,
      severity: log.severity,
      tags,
      note: log.note,
    })
  }

  // Sort by timestamp ascending
  rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // Derive simple episode/streak fields (default threshold: 12 hours)
  const rowsWithEpisodes = addEventEpisodeFields(rows, DEFAULT_EVENT_EPISODE_GAP_HOURS)

  return {
    rows: rowsWithEpisodes,
    coverage: {
      totalLogs: Object.keys(logs).length,
      validRows: rowsWithEpisodes.length,
      skippedRows: 0, // Event logs don't skip (no required fields)
    },
  }
}

function addEventEpisodeFields(rows: EventDatasetRow[], thresholdHours: number): EventDatasetRow[] {
  if (rows.length === 0) return rows

  const thresholdMs = thresholdHours * 60 * 60 * 1000

  type Episode = {
    id: string
    startIndex: number
    endIndex: number
  }

  const episodes: Episode[] = []
  let episodeStartIndex = 0
  let episodeNumber = 1

  const getTsMs = (row: EventDatasetRow): number => {
    const ms = Date.parse(row.timestamp)
    return Number.isFinite(ms) ? ms : 0
  }

  for (let i = 1; i < rows.length; i++) {
    const prevMs = getTsMs(rows[i - 1])
    const currMs = getTsMs(rows[i])
    const gap = currMs - prevMs

    if (gap > thresholdMs) {
      episodes.push({ id: `ep-${episodeNumber}`, startIndex: episodeStartIndex, endIndex: i - 1 })
      episodeNumber++
      episodeStartIndex = i
    }
  }

  episodes.push({ id: `ep-${episodeNumber}`, startIndex: episodeStartIndex, endIndex: rows.length - 1 })

  const next = rows.map((r) => ({ ...r }))
  for (const ep of episodes) {
    const length = ep.endIndex - ep.startIndex + 1
    for (let idx = ep.startIndex; idx <= ep.endIndex; idx++) {
      next[idx].episodeId = ep.id
      next[idx].episodeIndexWithinStreak = idx - ep.startIndex + 1
      next[idx].streakLength = length
    }
  }

  return next
}

/**
 * Build a day-bucketed frequency summary for an event project.
 * Pure function: returns one row per local date with count of events.
 */
export function buildEventDailyFrequency(
  state: AppStateV1,
  projectId: string,
): EventDailyFrequencyRow[] {
  const project = state.lab?.projects[projectId]
  if (!project || project.mode !== 'event') return []

  const logs = state.lab?.eventLogsByProject[projectId] || {}

  const byDate = new Map<string, number>()
  for (const log of Object.values(logs) as LabEventLog[]) {
    const date = toLocalDateString(new Date(log.timestamp))
    byDate.set(date, (byDate.get(date) || 0) + 1)
  }

  return Array.from(byDate.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Build a day-bucketed summary for an event project.
 * Includes event count and basic severity aggregates (if severity exists).
 */
export function buildEventDailySummary(
  state: AppStateV1,
  projectId: string,
): EventDailySummaryRow[] {
  const project = state.lab?.projects[projectId]
  if (!project || project.mode !== 'event') return []

  const logs = state.lab?.eventLogsByProject[projectId] || {}

  type Bucket = {
    count: number
    severityCount: number
    severitySum: number
    maxSeverity?: number
  }

  const byDate = new Map<string, Bucket>()

  for (const log of Object.values(logs) as LabEventLog[]) {
    const date = toLocalDateString(new Date(log.timestamp))
    const bucket = byDate.get(date) || {
      count: 0,
      severityCount: 0,
      severitySum: 0,
      maxSeverity: undefined,
    }

    bucket.count++

    if (typeof log.severity === 'number' && Number.isFinite(log.severity)) {
      bucket.severityCount++
      bucket.severitySum += log.severity
      bucket.maxSeverity =
        bucket.maxSeverity === undefined ? log.severity : Math.max(bucket.maxSeverity, log.severity)
    }

    byDate.set(date, bucket)
  }

  return Array.from(byDate.entries())
    .map(([date, b]) => {
      const avgSeverity = b.severityCount > 0 ? b.severitySum / b.severityCount : undefined
      return {
        date,
        count: b.count,
        severityCount: b.severityCount,
        maxSeverity: b.maxSeverity,
        avgSeverity,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Build a group-projected dataset for an event project.
 * Each group becomes a “virtual tag” key: `group:<groupName>`.
 * A group is present on a row if any tag in that group is present.
 */
export function buildEventGroupDataset(state: AppStateV1, projectId: string): EventGroupDataset {
  const base = buildEventDataset(state, projectId)
  const project = state.lab?.projects[projectId]
  if (!project || project.mode !== 'event') {
    return { rows: [], coverage: base.coverage, groupKeyToName: {} }
  }

  const tagDefs = state.lab?.tagsByProject[projectId] || {}

  const groupKeyToName: Record<string, string> = {}
  const tagIdToGroupKey: Record<string, string> = {}
  for (const [tagId, def] of Object.entries(tagDefs)) {
    const groupName = typeof def.group === 'string' ? def.group.trim() : ''
    if (!groupName) continue
    const groupKey = `group:${groupName}`
    groupKeyToName[groupKey] = groupName
    tagIdToGroupKey[tagId] = groupKey
  }

  const allGroupKeys = Object.keys(groupKeyToName)

  const rows = base.rows.map((row) => {
    const tags: Record<string, { present: boolean }> = {}
    for (const groupKey of allGroupKeys) tags[groupKey] = { present: false }

    for (const [tagId, val] of Object.entries(row.tags)) {
      if (!val.present) continue
      const groupKey = tagIdToGroupKey[tagId]
      if (!groupKey) continue
      tags[groupKey] = { present: true }
    }

    return {
      ...row,
      // override tag map with group-presence map
      tags,
    }
  })

  return {
    rows,
    coverage: base.coverage,
    groupKeyToName,
  }
}
