/**
 * Tag-only analysis methods (T1, T2, T3)
 * For daily-tag-only projects: tag frequency, co-occurrence, and 30-day dot table data.
 */

import type { LabFinding } from './types'
import type { TagOnlyDataset } from './datasetBuilders'

// ── T1: Tag Frequency ───────────────────────────────────────

export interface TagFrequencyResult {
  tagId: string
  presentDays: number
  totalDays: number
  rate: number
}

/**
 * T1: Per-tag frequency — count of days present / total logged days.
 * Returns LabFinding[] compatible with the analysis pipeline.
 */
export function tagFrequency(dataset: TagOnlyDataset, projectId: string): LabFinding[] {
  const { rows } = dataset
  if (rows.length === 0) return []

  const totalDays = rows.length
  const tagIds = new Set<string>()
  for (const row of rows) {
    for (const tagId of Object.keys(row.tags)) {
      tagIds.add(tagId)
    }
  }

  const findings: LabFinding[] = []

  for (const tagId of tagIds) {
    let presentCount = 0
    for (const row of rows) {
      if (row.tags[tagId]) presentCount++
    }

    const rate = presentCount / totalDays
    const percent = Math.round(rate * 100)

    const confidence: LabFinding['confidence'] =
      totalDays >= 30 && presentCount >= 10
        ? 'high'
        : totalDays >= 10 && presentCount >= 3
          ? 'medium'
          : 'low'

    findings.push({
      projectId,
      tagId,
      method: 'tag-frequency',
      effect: Number(rate.toFixed(2)),
      confidence,
      sampleSize: totalDays,
      summary: `[TAG] appears on ${presentCount}/${totalDays} days (${percent}%).`,
      rawData: { presentCount, totalDays, percent },
    })
  }

  return findings
}

// ── T2: Tag Co-occurrence ───────────────────────────────────

export interface TagCoOccurrenceResult {
  tagIdA: string
  tagIdB: string
  coOccurrenceDays: number
  totalDays: number
  rate: number
  jaccard: number
}

/**
 * T2: Tag co-occurrence — for every pair of tags (present in ≥5 logs each):
 *   percentage of days both appear together + Jaccard similarity.
 * Returns top N co-occurring pairs as findings.
 */
export function tagCoOccurrence(dataset: TagOnlyDataset, projectId: string): LabFinding[] {
  const { rows } = dataset
  if (rows.length < 5) return []

  // Count per-tag presence
  const tagIds = new Set<string>()
  for (const row of rows) {
    for (const tagId of Object.keys(row.tags)) {
      tagIds.add(tagId)
    }
  }

  const tagPresenceCounts: Record<string, number> = {}
  for (const tagId of tagIds) {
    let count = 0
    for (const row of rows) {
      if (row.tags[tagId]) count++
    }
    tagPresenceCounts[tagId] = count
  }

  // Filter to tags present in ≥5 logs
  const eligibleTags = Array.from(tagIds).filter((id) => tagPresenceCounts[id] >= 5)
  if (eligibleTags.length < 2) return []

  const totalDays = rows.length
  const pairs: TagCoOccurrenceResult[] = []

  for (let i = 0; i < eligibleTags.length; i++) {
    for (let j = i + 1; j < eligibleTags.length; j++) {
      const tagA = eligibleTags[i]
      const tagB = eligibleTags[j]

      let coCount = 0
      for (const row of rows) {
        if (row.tags[tagA] && row.tags[tagB]) coCount++
      }

      if (coCount === 0) continue

      const unionCount = tagPresenceCounts[tagA] + tagPresenceCounts[tagB] - coCount
      const jaccard = unionCount > 0 ? coCount / unionCount : 0
      const rate = coCount / totalDays

      pairs.push({
        tagIdA: tagA,
        tagIdB: tagB,
        coOccurrenceDays: coCount,
        totalDays,
        rate,
        jaccard,
      })
    }
  }

  // Sort by Jaccard descending, take top 20
  pairs.sort((a, b) => b.jaccard - a.jaccard)
  const topPairs = pairs.slice(0, 20)

  const findings: LabFinding[] = []
  for (const pair of topPairs) {
    const pctTogether = Math.round(pair.rate * 100)
    const jaccardPct = Math.round(pair.jaccard * 100)

    // Use composite tagId to identify the pair
    const compositeTagId = `pair:${pair.tagIdA}_${pair.tagIdB}`

    findings.push({
      projectId,
      tagId: compositeTagId,
      method: 'tag-co-occurrence',
      effect: Number(pair.jaccard.toFixed(2)),
      confidence:
        pair.coOccurrenceDays >= 15
          ? 'high'
          : pair.coOccurrenceDays >= 7
            ? 'medium'
            : 'low',
      sampleSize: pair.totalDays,
      summary: `[TAG] co-occur on ${pair.coOccurrenceDays}/${pair.totalDays} days (${pctTogether}%, Jaccard ${jaccardPct}%).`,
      rawData: {
        tagIdA: pair.tagIdA,
        tagIdB: pair.tagIdB,
        coOccurrenceDays: pair.coOccurrenceDays,
        totalDays: pair.totalDays,
        rate: pair.rate,
        jaccard: pair.jaccard,
      },
    })
  }

  return findings
}

// ── T3: Tag 30-Day Dot Table Data ───────────────────────────

/**
 * T3: Build dot-table data for up to 5 selected tags over a date range.
 * Not a finding — returns raw presence data for UI rendering.
 *
 * @param dataset   The tag-only dataset
 * @param tagIds    Up to 5 tag IDs to include
 * @param startDate First date to include (YYYY-MM-DD); defaults to 30 days before last log date
 * @param days      Number of days to include (default 30)
 */
export function buildTagDotTableData(
  dataset: TagOnlyDataset,
  tagIds: string[],
  startDate?: string,
  days: number = 30,
): Record<string, Record<string, boolean>> {
  const limited = tagIds.slice(0, 5)
  if (limited.length === 0 || dataset.rows.length === 0) return {}

  // Determine date window
  const sortedDates = dataset.rows.map((r) => r.date).sort()
  const lastDate = sortedDates[sortedDates.length - 1]

  let start: Date
  if (startDate) {
    start = new Date(startDate + 'T00:00:00')
  } else {
    start = new Date(lastDate + 'T00:00:00')
    start.setDate(start.getDate() - (days - 1))
  }

  // Build set of dates in window
  const dateSet = new Set<string>()
  const cursor = new Date(start)
  for (let i = 0; i < days; i++) {
    const d = cursor.toISOString().slice(0, 10)
    dateSet.add(d)
    cursor.setDate(cursor.getDate() + 1)
  }

  // Index logs by date for fast lookup
  const logsByDate: Record<string, Record<string, boolean>> = {}
  for (const row of dataset.rows) {
    if (!dateSet.has(row.date)) continue
    logsByDate[row.date] = row.tags
  }

  // Build result: tagId → { date → present }
  const result: Record<string, Record<string, boolean>> = {}
  for (const tagId of limited) {
    const tagData: Record<string, boolean> = {}
    for (const date of dateSet) {
      tagData[date] = logsByDate[date]?.[tagId] ?? false
    }
    result[tagId] = tagData
  }

  return result
}
