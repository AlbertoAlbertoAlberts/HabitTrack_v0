/**
 * Multi-outcome analysis methods (MO1, MO2)
 * For daily projects with additionalOutcomes: cross-outcome correlation
 * and per-outcome tag correlation.
 */

import type { LabFinding } from './types'
import type { DailyDataset } from './datasetBuilders'
import { v1Methods } from './methods'

// ── MO1: Cross-outcome Pearson correlation ──────────────────

/**
 * Pearson correlation coefficient between two numeric arrays.
 * Returns NaN if arrays have length < 2 or zero variance.
 */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return NaN

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
    sumXY += xs[i] * ys[i]
    sumX2 += xs[i] * xs[i]
    sumY2 += ys[i] * ys[i]
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (denom === 0) return NaN

  return (n * sumXY - sumX * sumY) / denom
}

/**
 * MO1: Cross-outcome correlation.
 * For each pair of outcomes (primary + additional), compute Pearson correlation.
 * Requires ≥10 days with both outcomes logged.
 *
 * @param dataset     The standard daily dataset (rows include outcome as primary value)
 * @param projectId   The project ID
 * @param outcomeIds  Array of additional outcome IDs
 * @param outcomeDatasets Map from outcome ID → DailyDataset (built with that outcome as row.outcome)
 */
export function crossOutcomeCorrelation(
  projectId: string,
  outcomeIds: string[],
  outcomeDatasets: Record<string, DailyDataset>,
  primaryDataset: DailyDataset,
): LabFinding[] {
  // Combine primary (key: 'primary') + additional outcomes
  const allIds = ['primary', ...outcomeIds]
  const allDatasets: Record<string, DailyDataset> = { primary: primaryDataset, ...outcomeDatasets }

  // Index each dataset by date for efficient pairing
  const dateIndexed: Record<string, Record<string, number>> = {}
  for (const id of allIds) {
    const ds = allDatasets[id]
    if (!ds) continue
    const byDate: Record<string, number> = {}
    for (const row of ds.rows) {
      if (row.outcome !== undefined) {
        byDate[row.date] = row.outcome
      }
    }
    dateIndexed[id] = byDate
  }

  const findings: LabFinding[] = []

  for (let i = 0; i < allIds.length; i++) {
    for (let j = i + 1; j < allIds.length; j++) {
      const idA = allIds[i]
      const idB = allIds[j]

      const indexA = dateIndexed[idA] || {}
      const indexB = dateIndexed[idB] || {}

      // Find dates where both have values
      const xs: number[] = []
      const ys: number[] = []
      for (const date of Object.keys(indexA)) {
        if (date in indexB) {
          xs.push(indexA[date])
          ys.push(indexB[date])
        }
      }

      if (xs.length < 10) continue

      const r = pearson(xs, ys)
      if (isNaN(r)) continue

      const confidence: LabFinding['confidence'] =
        xs.length >= 30 ? 'high' : xs.length >= 15 ? 'medium' : 'low'

      const direction = r >= 0 ? 'positive' : 'negative'
      const strength =
        Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.4 ? 'moderate' : 'weak'

      findings.push({
        projectId,
        tagId: `outcome:${idA}_vs_${idB}`,
        method: 'cross-outcome-correlation',
        effect: Number(r.toFixed(3)),
        confidence,
        sampleSize: xs.length,
        summary: `${strength} ${direction} correlation (r=${r.toFixed(2)}) between outcomes over ${xs.length} days.`,
        rawData: { outcomeIdA: idA, outcomeIdB: idB, r, n: xs.length },
      })
    }
  }

  return findings
}

// ── MO2: Per-outcome tag correlation ────────────────────────

/**
 * MO2: Run existing daily methods (presence-effect, lag, rolling, dose-response, regime)
 * parameterized by a specific outcome.
 *
 * Strategy: build a separate DailyDataset per outcome (approach (a) from the plan),
 * where `row.outcome` is set to the specified outcome's value. Then run all existing
 * daily methods on each dataset. Tag findings with which outcome they belong to via
 * a prefixed method name.
 *
 * @param outcomeId       The outcome ID being analyzed (e.g., 'outcome_2')
 * @param outcomeDataset  DailyDataset built with the specified outcome as row.outcome
 * @param projectId       The project ID
 */
export function perOutcomeTagCorrelation(
  outcomeId: string,
  outcomeDataset: DailyDataset,
  projectId: string,
): LabFinding[] {
  if (outcomeDataset.rows.length < 5) return []

  const findings: LabFinding[] = []

  for (const method of v1Methods) {
    const methodFindings = method.run(outcomeDataset, projectId)

    // Prefix the method name with the outcome ID so findings can be filtered per outcome
    for (const finding of methodFindings) {
      findings.push({
        ...finding,
        method: `${outcomeId}::${finding.method}`,
        rawData: {
          ...(typeof finding.rawData === 'object' && finding.rawData !== null ? finding.rawData : {}),
          outcomeId,
        },
      })
    }
  }

  return findings
}
