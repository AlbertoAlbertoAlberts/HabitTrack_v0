import type { LabDailyLog, LabProject } from '../types'

/**
 * Validates if a daily log entry meets the project's completion requirements.
 */
export function isLabDailyLogComplete(log: LabDailyLog, project: LabProject): boolean {
  if (project.mode !== 'daily' || project.config.kind !== 'daily') {
    return false
  }

  const { requireOutcome, requireAtLeastOneTag } = project.config.completion

  // Check outcome requirement
  if (requireOutcome && log.outcome === undefined) {
    return false
  }

  // Check tag requirement
  if (requireAtLeastOneTag && log.tags.length === 0 && !log.noTags) {
    return false
  }

  return true
}
