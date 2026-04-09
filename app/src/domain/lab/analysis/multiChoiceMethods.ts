/**
 * Multi-choice analysis methods (MC1, MC2)
 * For daily-multi-choice projects: choice frequency and 30-day grid data.
 */

import type { LabFinding } from './types'
import type { MultiChoiceDataset } from './datasetBuilders'

// ── MC1: Choice Frequency ───────────────────────────────────

/**
 * MC1: Per-option frequency — count of days selected / total logged days.
 * Returns LabFinding[] compatible with the analysis pipeline.
 */
export function choiceFrequency(dataset: MultiChoiceDataset, projectId: string): LabFinding[] {
  const { rows } = dataset
  if (rows.length === 0) return []

  const totalDays = rows.length

  // Collect all option IDs seen across rows
  const optionIds = new Set<string>()
  for (const row of rows) {
    for (const optionId of row.selectedOptionIds) {
      optionIds.add(optionId)
    }
  }

  const findings: LabFinding[] = []

  for (const optionId of optionIds) {
    let selectedCount = 0
    for (const row of rows) {
      if (row.selectedOptionIds.includes(optionId)) selectedCount++
    }

    const rate = selectedCount / totalDays
    const percent = Math.round(rate * 100)

    const confidence: LabFinding['confidence'] =
      totalDays >= 30 && selectedCount >= 10
        ? 'high'
        : totalDays >= 10 && selectedCount >= 3
          ? 'medium'
          : 'low'

    findings.push({
      projectId,
      tagId: `option:${optionId}`,
      method: 'choice-frequency',
      effect: Number(rate.toFixed(2)),
      confidence,
      sampleSize: totalDays,
      summary: `[TAG] selected on ${selectedCount}/${totalDays} days (${percent}%).`,
      rawData: { selectedCount, totalDays, percent },
    })
  }

  return findings
}

// ── MC2: 30-Day Grid Data ───────────────────────────────────

/**
 * MC2: Build grid data for all options over a date range.
 * Not a finding — returns raw presence data for UI rendering.
 *
 * @param dataset    The multi-choice dataset
 * @param optionIds  Option IDs to include (pass all active options)
 * @param startDate  First date to include (YYYY-MM-DD); defaults to 30 days before last log
 * @param days       Number of days to include (default 30)
 */
export function buildChoiceGridData(
  dataset: MultiChoiceDataset,
  optionIds: string[],
  startDate?: string,
  days: number = 30,
): Record<string, Record<string, boolean>> {
  if (optionIds.length === 0 || dataset.rows.length === 0) return {}

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

  // Build set of dates in window (use local timezone to match DotTable)
  const dateSet = new Set<string>()
  const cursor = new Date(start)
  for (let i = 0; i < days; i++) {
    const yyyy = cursor.getFullYear()
    const mm = String(cursor.getMonth() + 1).padStart(2, '0')
    const dd = String(cursor.getDate()).padStart(2, '0')
    dateSet.add(`${yyyy}-${mm}-${dd}`)
    cursor.setDate(cursor.getDate() + 1)
  }

  // Index logs by date for fast lookup
  const logsByDate: Record<string, Set<string>> = {}
  for (const row of dataset.rows) {
    if (!dateSet.has(row.date)) continue
    logsByDate[row.date] = new Set(row.selectedOptionIds)
  }

  // Build result: optionId → { date → selected }
  const result: Record<string, Record<string, boolean>> = {}
  for (const optionId of optionIds) {
    const optionData: Record<string, boolean> = {}
    for (const date of dateSet) {
      optionData[date] = logsByDate[date]?.has(optionId) ?? false
    }
    result[optionId] = optionData
  }

  return result
}
