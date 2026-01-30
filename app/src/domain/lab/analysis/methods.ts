import type { DailyDataset, EventDataset } from './datasetBuilders'
import type { DailyCorrelationMethod, EventCorrelationMethod, LabCorrelationMethod, LabFinding } from './types'
import { buildHumanSummary } from './summaryBuilder'
import { toLocalDateString } from '../../utils/localDate'

type EpisodeAgg = {
  episodeId: string
  startTimestamp: string
  endTimestamp: string
  durationHours: number
  eventCount: number
  maxSeverity?: number
  tagsPresent: Set<string>
}

function buildEpisodeAggs(dataset: EventDataset): EpisodeAgg[] {
  const { rows } = dataset
  if (rows.length === 0) return []

  const episodesInOrder: { id: string; rows: EventDataset['rows'] }[] = []
  const indexById = new Map<string, number>()

  for (const row of rows) {
    const id = row.episodeId || row.timestamp
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

  return episodesInOrder.map((ep) => {
    const epRows = ep.rows
    const startTimestamp = epRows[0].timestamp
    const endTimestamp = epRows[epRows.length - 1].timestamp
    const startMs = getMs(startTimestamp)
    const endMs = getMs(endTimestamp)
    const durationHours = Number(((endMs - startMs) / (60 * 60 * 1000)).toFixed(2))

    const tagsPresent = new Set<string>()
    let maxSeverity: number | undefined

    for (const r of epRows) {
      for (const [tagId, meta] of Object.entries(r.tags)) {
        if (meta?.present) tagsPresent.add(tagId)
      }

      const sev = r.severity
      if (typeof sev === 'number' && Number.isFinite(sev)) {
        maxSeverity = maxSeverity === undefined ? sev : Math.max(maxSeverity, sev)
      }
    }

    return {
      episodeId: ep.id,
      startTimestamp,
      endTimestamp,
      durationHours,
      eventCount: epRows.length,
      maxSeverity,
      tagsPresent,
    }
  })
}

type OccurrenceDailyRow = {
  date: string
  outcome: 0 | 1
  tags: Record<string, { present: boolean }>
}

function buildOccurrenceDailyRowsFromEvents(dataset: EventDataset): OccurrenceDailyRow[] {
  const eventRows = dataset.rows
  if (eventRows.length === 0) return []

  const allTagIds = Object.keys(eventRows[0].tags)

  const dayTagPresence = new Map<string, Record<string, boolean>>()
  const dayEventCount = new Map<string, number>()

  const parsedMs = eventRows
    .map((r) => Date.parse(r.timestamp))
    .filter((ms) => Number.isFinite(ms))
  if (parsedMs.length === 0) return []

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

  const minMs = Math.min(...parsedMs)
  const maxMs = Math.max(...parsedMs)

  const start = new Date(minMs)
  const end = new Date(maxMs)
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  const rows: OccurrenceDailyRow[] = []
  while (cursor.getTime() <= endDay.getTime()) {
    const date = toLocalDateString(cursor)
    const presentMap = dayTagPresence.get(date) || {}

    const tags: Record<string, { present: boolean }> = {}
    for (const tagId of allTagIds) {
      tags[tagId] = { present: !!presentMap[tagId] }
    }

    const outcome: 0 | 1 = (dayEventCount.get(date) || 0) > 0 ? 1 : 0
    rows.push({ date, outcome, tags })

    cursor.setDate(cursor.getDate() + 1)
  }

  return rows
}

/**
 * Method E9: Occurrence effect (tags, inferred baseline)
 * Treats each day as outcome=1 if any event happened, else 0.
 * WARNING: exposures are only observed on event days.
 */
export const eventTagOccurrenceEffect: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-tag-occurrence-effect',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const rows = buildOccurrenceDailyRowsFromEvents(dataset)
    if (rows.length < 14) return []

    const hasEventDays = rows.some((r) => r.outcome === 1)
    const hasNonEventDays = rows.some((r) => r.outcome === 0)
    // If every day is an event-day (or none are), occurrence probability can't vary by tag.
    if (!hasEventDays || !hasNonEventDays) return []

    const tagIds = new Set<string>()
    for (const tagId of Object.keys(rows[0].tags)) {
      if (!tagId.startsWith('group:')) tagIds.add(tagId)
    }

    const findings: LabFinding[] = []
    for (const tagId of tagIds) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const r of rows) {
        if (r.tags[tagId]?.present) withTag.push(r.outcome)
        else withoutTag.push(r.outcome)
      }

      if (withTag.length < 3 || withoutTag.length < 7) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length
      const effect = avgWith - avgWithout

      // Avoid rendering a wall of 0.00 / 0% insights.
      if (Math.abs(effect) < 0.01) continue

      const sampleSize = rows.length
      const confidence: LabFinding['confidence'] =
        sampleSize >= 60 && withTag.length >= 10 ? 'high' : sampleSize >= 28 && withTag.length >= 6 ? 'medium' : 'low'

      const pctWith = Math.round(avgWith * 100)
      const pctWithout = Math.round(avgWithout * 100)

      findings.push({
        projectId,
        tagId,
        method: 'event-tag-occurrence-effect',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: `[TAG] is associated with a ${effect >= 0 ? 'higher' : 'lower'} chance of an event-day by ${Math.abs(effect * 100).toFixed(0)}% (baseline inferred).`,
        rawData: { avgWith, avgWithout, withN: withTag.length, withoutN: withoutTag.length, pctWith, pctWithout },
      })
    }

    return findings
  },
}

/**
 * Method E10: Occurrence effect (groups, inferred baseline)
 */
export const eventGroupOccurrenceEffect: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-group-occurrence-effect',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const rows = buildOccurrenceDailyRowsFromEvents(dataset)
    if (rows.length < 14) return []

    const hasEventDays = rows.some((r) => r.outcome === 1)
    const hasNonEventDays = rows.some((r) => r.outcome === 0)
    if (!hasEventDays || !hasNonEventDays) return []

    const groupKeys = new Set<string>()
    for (const tagId of Object.keys(rows[0].tags)) {
      if (tagId.startsWith('group:')) groupKeys.add(tagId)
    }

    const findings: LabFinding[] = []
    for (const tagId of groupKeys) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const r of rows) {
        if (r.tags[tagId]?.present) withTag.push(r.outcome)
        else withoutTag.push(r.outcome)
      }

      if (withTag.length < 3 || withoutTag.length < 7) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length
      const effect = avgWith - avgWithout

      if (Math.abs(effect) < 0.01) continue

      const sampleSize = rows.length
      const confidence: LabFinding['confidence'] =
        sampleSize >= 60 && withTag.length >= 10 ? 'high' : sampleSize >= 28 && withTag.length >= 6 ? 'medium' : 'low'

      const pctWith = Math.round(avgWith * 100)
      const pctWithout = Math.round(avgWithout * 100)

      findings.push({
        projectId,
        tagId,
        method: 'event-group-occurrence-effect',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: `[TAG] is associated with a ${effect >= 0 ? 'higher' : 'lower'} chance of an event-day by ${Math.abs(effect * 100).toFixed(0)}% (baseline inferred).`,
        rawData: { avgWith, avgWithout, withN: withTag.length, withoutN: withoutTag.length, pctWith, pctWithout },
      })
    }

    return findings
  },
}

/**
 * Method E1: Event tag frequency
 * How often does each tag appear across events?
 */
export const eventTagFrequency: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-tag-frequency',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const findings: LabFinding[] = []
    const { rows } = dataset
    if (rows.length === 0) return findings

    const totalEvents = rows.length

    // Collect tag IDs across rows (be defensive: tag keys could differ between rows)
    const tagIds = new Set<string>()
    for (const row of rows) {
      for (const tagId of Object.keys(row.tags)) {
        tagIds.add(tagId)
      }
    }

    for (const tagId of tagIds) {
      let presentCount = 0
      for (const row of rows) {
        if (row.tags[tagId]?.present) presentCount++
      }

      const rate = totalEvents > 0 ? presentCount / totalEvents : 0
      const effect = Number(rate.toFixed(2))
      const percent = Math.round(rate * 100)

      const confidence: LabFinding['confidence'] =
        totalEvents >= 30 && presentCount >= 10 ? 'high' : totalEvents >= 10 && presentCount >= 3 ? 'medium' : 'low'

      findings.push({
        projectId,
        tagId,
        method: 'event-tag-frequency',
        effect,
        confidence,
        sampleSize: totalEvents,
        summary: `[TAG] appears in ${presentCount}/${totalEvents} events (${percent}%).`,
        rawData: { presentCount, totalEvents, percent },
      })
    }

    return findings
  },
}

/**
 * Method E2: Event group frequency
 * Works on a group-projected event dataset (tags keyed like group:<groupName>).
 */
export const eventGroupFrequency: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-group-frequency',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const findings: LabFinding[] = []
    const { rows } = dataset
    if (rows.length === 0) return findings

    const totalEvents = rows.length
    const groupKeys = new Set<string>()
    for (const row of rows) {
      for (const tagId of Object.keys(row.tags)) {
        if (tagId.startsWith('group:')) groupKeys.add(tagId)
      }
    }

    for (const tagId of groupKeys) {
      let presentCount = 0
      for (const row of rows) {
        if (row.tags[tagId]?.present) presentCount++
      }

      const rate = totalEvents > 0 ? presentCount / totalEvents : 0
      const effect = Number(rate.toFixed(2))
      const percent = Math.round(rate * 100)

      const confidence: LabFinding['confidence'] =
        totalEvents >= 30 && presentCount >= 10 ? 'high' : totalEvents >= 10 && presentCount >= 3 ? 'medium' : 'low'

      findings.push({
        projectId,
        tagId,
        method: 'event-group-frequency',
        effect,
        confidence,
        sampleSize: totalEvents,
        summary: `[TAG] appears in ${presentCount}/${totalEvents} events (${percent}%).`,
        rawData: { presentCount, totalEvents, percent },
      })
    }

    return findings
  },
}

/**
 * Method E3: Event tag severity effect
 * Compare mean severity when tag present vs absent (among events with severity).
 */
export const eventTagSeverityEffect: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-tag-severity-effect',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const findings: LabFinding[] = []
    const severityRows = dataset.rows.filter(
      (r) => typeof r.severity === 'number' && Number.isFinite(r.severity)
    )

    if (severityRows.length < 6) return findings

    const tagIds = new Set<string>()
    for (const row of severityRows) {
      for (const tagId of Object.keys(row.tags)) {
        if (!tagId.startsWith('group:')) tagIds.add(tagId)
      }
    }

    for (const tagId of tagIds) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const row of severityRows) {
        const sev = row.severity as number
        if (row.tags[tagId]?.present) withTag.push(sev)
        else withoutTag.push(sev)
      }

      if (withTag.length < 3 || withoutTag.length < 3) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length
      const effect = avgWith - avgWithout

      const sampleSize = withTag.length + withoutTag.length
      const confidence: LabFinding['confidence'] = sampleSize >= 20 ? 'high' : sampleSize >= 10 ? 'medium' : 'low'

      findings.push({
        projectId,
        tagId,
        method: 'event-tag-severity-effect',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: `[TAG] is associated with ${effect >= 0 ? 'higher' : 'lower'} severity by ${Math.abs(effect).toFixed(2)} on average (present vs absent).`,
        rawData: { avgWith, avgWithout, withN: withTag.length, withoutN: withoutTag.length },
      })
    }

    return findings
  },
}

/**
 * Method E4: Event group severity effect
 * Same as tag severity effect, but for group-projected datasets (group:<name> keys).
 */
export const eventGroupSeverityEffect: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-group-severity-effect',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const findings: LabFinding[] = []
    const severityRows = dataset.rows.filter(
      (r) => typeof r.severity === 'number' && Number.isFinite(r.severity)
    )

    if (severityRows.length < 6) return findings

    const groupKeys = new Set<string>()
    for (const row of severityRows) {
      for (const tagId of Object.keys(row.tags)) {
        if (tagId.startsWith('group:')) groupKeys.add(tagId)
      }
    }

    for (const tagId of groupKeys) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const row of severityRows) {
        const sev = row.severity as number
        if (row.tags[tagId]?.present) withTag.push(sev)
        else withoutTag.push(sev)
      }

      if (withTag.length < 3 || withoutTag.length < 3) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length
      const effect = avgWith - avgWithout

      const sampleSize = withTag.length + withoutTag.length
      const confidence: LabFinding['confidence'] = sampleSize >= 20 ? 'high' : sampleSize >= 10 ? 'medium' : 'low'

      findings.push({
        projectId,
        tagId,
        method: 'event-group-severity-effect',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: `[TAG] is associated with ${effect >= 0 ? 'higher' : 'lower'} severity by ${Math.abs(effect).toFixed(2)} on average (present vs absent).`,
        rawData: { avgWith, avgWithout, withN: withTag.length, withoutN: withoutTag.length },
      })
    }

    return findings
  },
}

/**
 * Method E5: Episode duration effect (tags)
 * Compare mean episode duration (hours) when tag appears in the episode vs not.
 */
export const eventTagEpisodeDurationEffect: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-tag-episode-duration-effect',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const episodes = buildEpisodeAggs(dataset)
    if (episodes.length < 6) return []

    const tagIds = new Set<string>()
    for (const row of dataset.rows) {
      for (const tagId of Object.keys(row.tags)) {
        if (!tagId.startsWith('group:')) tagIds.add(tagId)
      }
    }

    const findings: LabFinding[] = []
    for (const tagId of tagIds) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const ep of episodes) {
        if (ep.tagsPresent.has(tagId)) withTag.push(ep.durationHours)
        else withoutTag.push(ep.durationHours)
      }

      if (withTag.length < 3 || withoutTag.length < 3) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length
      const effect = avgWith - avgWithout

      const sampleSize = withTag.length + withoutTag.length
      const confidence: LabFinding['confidence'] = sampleSize >= 20 ? 'high' : sampleSize >= 10 ? 'medium' : 'low'

      findings.push({
        projectId,
        tagId,
        method: 'event-tag-episode-duration-effect',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: `[TAG] is associated with ${effect >= 0 ? 'longer' : 'shorter'} episodes by ${Math.abs(effect).toFixed(1)}h on average.`,
        rawData: { avgWith, avgWithout, withN: withTag.length, withoutN: withoutTag.length },
      })
    }

    return findings
  },
}

/**
 * Method E6: Episode max severity effect (tags)
 * Compare mean max-episode severity when tag appears in the episode vs not.
 */
export const eventTagEpisodeMaxSeverityEffect: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-tag-episode-max-severity-effect',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const episodes = buildEpisodeAggs(dataset).filter(
      (e) => typeof e.maxSeverity === 'number' && Number.isFinite(e.maxSeverity)
    )
    if (episodes.length < 6) return []

    const tagIds = new Set<string>()
    for (const row of dataset.rows) {
      for (const tagId of Object.keys(row.tags)) {
        if (!tagId.startsWith('group:')) tagIds.add(tagId)
      }
    }

    const findings: LabFinding[] = []
    for (const tagId of tagIds) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const ep of episodes) {
        const outcome = ep.maxSeverity as number
        if (ep.tagsPresent.has(tagId)) withTag.push(outcome)
        else withoutTag.push(outcome)
      }

      if (withTag.length < 3 || withoutTag.length < 3) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length
      const effect = avgWith - avgWithout

      const sampleSize = withTag.length + withoutTag.length
      const confidence: LabFinding['confidence'] = sampleSize >= 20 ? 'high' : sampleSize >= 10 ? 'medium' : 'low'

      findings.push({
        projectId,
        tagId,
        method: 'event-tag-episode-max-severity-effect',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: `[TAG] is associated with ${effect >= 0 ? 'higher' : 'lower'} max episode severity by ${Math.abs(effect).toFixed(2)} on average.`,
        rawData: { avgWith, avgWithout, withN: withTag.length, withoutN: withoutTag.length },
      })
    }

    return findings
  },
}

/**
 * Method E7: Episode duration effect (groups)
 */
export const eventGroupEpisodeDurationEffect: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-group-episode-duration-effect',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const episodes = buildEpisodeAggs(dataset)
    if (episodes.length < 6) return []

    const groupKeys = new Set<string>()
    for (const row of dataset.rows) {
      for (const tagId of Object.keys(row.tags)) {
        if (tagId.startsWith('group:')) groupKeys.add(tagId)
      }
    }

    const findings: LabFinding[] = []
    for (const tagId of groupKeys) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const ep of episodes) {
        if (ep.tagsPresent.has(tagId)) withTag.push(ep.durationHours)
        else withoutTag.push(ep.durationHours)
      }

      if (withTag.length < 3 || withoutTag.length < 3) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length
      const effect = avgWith - avgWithout

      const sampleSize = withTag.length + withoutTag.length
      const confidence: LabFinding['confidence'] = sampleSize >= 20 ? 'high' : sampleSize >= 10 ? 'medium' : 'low'

      findings.push({
        projectId,
        tagId,
        method: 'event-group-episode-duration-effect',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: `[TAG] is associated with ${effect >= 0 ? 'longer' : 'shorter'} episodes by ${Math.abs(effect).toFixed(1)}h on average.`,
        rawData: { avgWith, avgWithout, withN: withTag.length, withoutN: withoutTag.length },
      })
    }

    return findings
  },
}

/**
 * Method E8: Episode max severity effect (groups)
 */
export const eventGroupEpisodeMaxSeverityEffect: EventCorrelationMethod = {
  kind: 'event',
  name: 'event-group-episode-max-severity-effect',
  run: (dataset: EventDataset, projectId: string): LabFinding[] => {
    const episodes = buildEpisodeAggs(dataset).filter(
      (e) => typeof e.maxSeverity === 'number' && Number.isFinite(e.maxSeverity)
    )
    if (episodes.length < 6) return []

    const groupKeys = new Set<string>()
    for (const row of dataset.rows) {
      for (const tagId of Object.keys(row.tags)) {
        if (tagId.startsWith('group:')) groupKeys.add(tagId)
      }
    }

    const findings: LabFinding[] = []
    for (const tagId of groupKeys) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const ep of episodes) {
        const outcome = ep.maxSeverity as number
        if (ep.tagsPresent.has(tagId)) withTag.push(outcome)
        else withoutTag.push(outcome)
      }

      if (withTag.length < 3 || withoutTag.length < 3) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length
      const effect = avgWith - avgWithout

      const sampleSize = withTag.length + withoutTag.length
      const confidence: LabFinding['confidence'] = sampleSize >= 20 ? 'high' : sampleSize >= 10 ? 'medium' : 'low'

      findings.push({
        projectId,
        tagId,
        method: 'event-group-episode-max-severity-effect',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: `[TAG] is associated with ${effect >= 0 ? 'higher' : 'lower'} max episode severity by ${Math.abs(effect).toFixed(2)} on average.`,
        rawData: { avgWith, avgWithout, withN: withTag.length, withoutN: withoutTag.length },
      })
    }

    return findings
  },
}

/**
 * Method 1: Presence Effect
 * Compare outcome when tag present vs absent
 */
export const presenceEffect: DailyCorrelationMethod = {
  kind: 'daily',
  name: 'presence-effect',
  run: (dataset: DailyDataset, projectId: string): LabFinding[] => {
    const findings: LabFinding[] = []
    const { rows } = dataset

    if (rows.length === 0) return findings

    // Get all tag IDs
    const tagIds = Object.keys(rows[0].tags)

    for (const tagId of tagIds) {
      const withTag: number[] = []
      const withoutTag: number[] = []

      for (const row of rows) {
        if (row.outcome === undefined) continue
        if (row.tags[tagId]?.present) {
          withTag.push(row.outcome)
        } else {
          withoutTag.push(row.outcome)
        }
      }

      // Need minimum occurrences
      if (withTag.length < 3 || withoutTag.length < 3) continue

      const avgWith = withTag.reduce((a, b) => a + b, 0) / withTag.length
      const avgWithout = withoutTag.reduce((a, b) => a + b, 0) / withoutTag.length
      const effect = avgWith - avgWithout

      const confidence = withTag.length + withoutTag.length >= 20 ? 'high' : 'medium'
      const sampleSize = withTag.length + withoutTag.length

      findings.push({
        projectId,
        tagId,
        method: 'presence-effect',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: buildHumanSummary({
          tagName: '[TAG]',
          effect: Number(effect.toFixed(2)),
          method: 'presence-effect',
          sampleSize,
          confidence,
          avgWith,
          avgWithout,
        }),
        rawData: { avgWith, avgWithout },
      })
    }

    return findings
  },
}

/**
 * Method 2: Lag Effects (lag-1, lag-2, lag-3)
 * Check if tag yesterday/2d/3d ago affects today's outcome
 */
export const lagEffects: DailyCorrelationMethod = {
  kind: 'daily',
  name: 'lag-effects',
  run: (dataset: DailyDataset, projectId: string): LabFinding[] => {
    const findings: LabFinding[] = []
    const { rows } = dataset

    if (rows.length < 5) return findings

    const tagIds = Object.keys(rows[0].tags)

    for (const tagId of tagIds) {
      for (const lag of [1, 2, 3]) {
        const withLagTag: number[] = []
        const withoutLagTag: number[] = []

        for (let i = lag; i < rows.length; i++) {
          if (rows[i].outcome === undefined) continue

          const lagRow = rows[i - lag]
          if (lagRow.tags[tagId]?.present) {
            withLagTag.push(rows[i].outcome!)
          } else {
            withoutLagTag.push(rows[i].outcome!)
          }
        }

        if (withLagTag.length < 3 || withoutLagTag.length < 3) continue

        const avgWith = withLagTag.reduce((a, b) => a + b, 0) / withLagTag.length
        const avgWithout = withoutLagTag.reduce((a, b) => a + b, 0) / withoutLagTag.length
        const effect = avgWith - avgWithout

        const confidence = withLagTag.length + withoutLagTag.length >= 15 ? 'medium' : 'low'
        const sampleSize = withLagTag.length + withoutLagTag.length

        findings.push({
          projectId,
          tagId,
          method: `lag-${lag}`,
          effect: Number(effect.toFixed(2)),
          confidence,
          sampleSize,
          summary: buildHumanSummary({
            tagName: '[TAG]',
            effect: Number(effect.toFixed(2)),
            method: `lag-${lag}`,
            sampleSize,
            confidence,
            avgWith,
            avgWithout,
            lag,
          }),
          rawData: { avgWith, avgWithout, lag },
        })
      }
    }

    return findings
  },
}

/**
 * Method 3: Rolling Accumulation (3-day and 7-day)
 * Check if accumulated exposure affects outcome
 */
export const rollingAccumulation: DailyCorrelationMethod = {
  kind: 'daily',
  name: 'rolling-accumulation',
  run: (dataset: DailyDataset, projectId: string): LabFinding[] => {
    const findings: LabFinding[] = []
    const { rows } = dataset

    if (rows.length < 8) return findings

    const tagIds = Object.keys(rows[0].tags)

    for (const tagId of tagIds) {
      for (const window of [3, 7]) {
        const dataPoints: Array<{ rolling: number; outcome: number }> = []

        for (let i = window; i < rows.length; i++) {
          if (rows[i].outcome === undefined) continue

          // Count presence in rolling window
          let rollingCount = 0
          for (let j = i - window; j < i; j++) {
            if (rows[j].tags[tagId]?.present) rollingCount++
          }

          dataPoints.push({ rolling: rollingCount, outcome: rows[i].outcome! })
        }

        if (dataPoints.length < 10) continue

        // Compare high vs low exposure
        const sorted = dataPoints.sort((a, b) => a.rolling - b.rolling)
        const lowHalf = sorted.slice(0, Math.floor(sorted.length / 2))
        const highHalf = sorted.slice(Math.ceil(sorted.length / 2))

        const avgLow = lowHalf.reduce((a, b) => a + b.outcome, 0) / lowHalf.length
        const avgHigh = highHalf.reduce((a, b) => a + b.outcome, 0) / highHalf.length
        const effect = avgHigh - avgLow

        const confidence = dataPoints.length >= 20 ? 'medium' : 'low'
        const sampleSize = dataPoints.length

        findings.push({
          projectId,
          tagId,
          method: `rolling-${window}d`,
          effect: Number(effect.toFixed(2)),
          confidence,
          sampleSize,
          summary: buildHumanSummary({
            tagName: '[TAG]',
            effect: Number(effect.toFixed(2)),
            method: `rolling-${window}d`,
            sampleSize,
            confidence,
            avgLow,
            avgHigh,
            window,
          }),
          rawData: { avgLow, avgHigh, window },
        })
      }
    }

    return findings
  },
}

/**
 * Method 4: Dose Response
 * Compare intensity bins (if intensity enabled)
 */
export const doseResponse: DailyCorrelationMethod = {
  kind: 'daily',
  name: 'dose-response',
  run: (dataset: DailyDataset, projectId: string): LabFinding[] => {
    const findings: LabFinding[] = []
    const { rows } = dataset

    if (rows.length === 0) return findings

    const tagIds = Object.keys(rows[0].tags)

    for (const tagId of tagIds) {
      const withIntensity: Array<{ intensity: number; outcome: number }> = []

      for (const row of rows) {
        if (row.outcome === undefined) continue
        if (row.tags[tagId]?.present && row.tags[tagId].intensity !== undefined) {
          withIntensity.push({ intensity: row.tags[tagId].intensity!, outcome: row.outcome })
        }
      }

      if (withIntensity.length < 6) continue

      // Split into low/medium/high bins
      const sorted = withIntensity.sort((a, b) => a.intensity - b.intensity)
      const third = Math.floor(sorted.length / 3)
      
      const low = sorted.slice(0, third)
      const high = sorted.slice(-third)

      if (low.length < 2 || high.length < 2) continue

      const avgLow = low.reduce((a, b) => a + b.outcome, 0) / low.length
      const avgHigh = high.reduce((a, b) => a + b.outcome, 0) / high.length
      const effect = avgHigh - avgLow

      const confidence = withIntensity.length >= 12 ? 'medium' : 'low'
      const sampleSize = withIntensity.length

      findings.push({
        projectId,
        tagId,
        method: 'dose-response',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: buildHumanSummary({
          tagName: '[TAG]',
          effect: Number(effect.toFixed(2)),
          method: 'dose-response',
          sampleSize,
          confidence,
          avgLow,
          avgHigh,
        }),
        rawData: { avgLow, avgHigh },
      })
    }

    return findings
  },
}

/**
 * Method 5: Regime Summary
 * Which tags are common on high vs low outcome days
 */
export const regimeSummary: DailyCorrelationMethod = {
  kind: 'daily',
  name: 'regime-summary',
  run: (dataset: DailyDataset, projectId: string): LabFinding[] => {
    const findings: LabFinding[] = []
    const { rows } = dataset

    if (rows.length < 10) return findings

    // Sort by outcome
    const sorted = rows.filter((r) => r.outcome !== undefined).sort((a, b) => a.outcome! - b.outcome!)
    if (sorted.length < 10) return findings

    const quarter = Math.floor(sorted.length / 4)
    const lowDays = sorted.slice(0, quarter)
    const highDays = sorted.slice(-quarter)

    const tagIds = Object.keys(rows[0].tags)

    for (const tagId of tagIds) {
      const lowPresence = lowDays.filter((d) => d.tags[tagId]?.present).length / lowDays.length
      const highPresence = highDays.filter((d) => d.tags[tagId]?.present).length / highDays.length
      const effect = highPresence - lowPresence

      // Only report if meaningful difference
      if (Math.abs(effect) < 0.15) continue

      const confidence = sorted.length >= 20 ? 'medium' : 'low'
      const sampleSize = sorted.length

      findings.push({
        projectId,
        tagId,
        method: 'regime-summary',
        effect: Number(effect.toFixed(2)),
        confidence,
        sampleSize,
        summary: buildHumanSummary({
          tagName: '[TAG]',
          effect: Number(effect.toFixed(2)),
          method: 'regime-summary',
          sampleSize,
          confidence,
          lowPresencePercent: lowPresence * 100,
          highPresencePercent: highPresence * 100,
        }),
        rawData: { lowPresence, highPresence },
      })
    }

    return findings
  },
}

/**
 * All v1 methods
 */
export const v1Methods: DailyCorrelationMethod[] = [
  presenceEffect,
  lagEffects,
  rollingAccumulation,
  doseResponse,
  regimeSummary,
]

export const v1AllMethods: LabCorrelationMethod[] = [
  ...v1Methods,
  eventTagFrequency,
  eventGroupFrequency,
  eventTagSeverityEffect,
  eventGroupSeverityEffect,
  eventTagEpisodeDurationEffect,
  eventTagEpisodeMaxSeverityEffect,
  eventGroupEpisodeDurationEffect,
  eventGroupEpisodeMaxSeverityEffect,
  eventTagOccurrenceEffect,
  eventGroupOccurrenceEffect,
]
