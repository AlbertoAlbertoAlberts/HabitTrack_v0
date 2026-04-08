import type { LabDailyLog, LabMultiChoiceLog, LabProject } from '../types'

/**
 * Validates if a daily log entry meets the project's completion requirements.
 * Supports both 'daily' (track outcome) and 'daily-tag-only' modes.
 */
export function isLabDailyLogComplete(log: LabDailyLog, project: LabProject): boolean {
  if (project.config.kind === 'daily') {
    const { requireOutcome, requireAtLeastOneTag } = project.config.completion

    if (requireOutcome && log.outcome === undefined) {
      return false
    }

    if (project.config.tagsEnabled === false) {
      return true
    }

    if (requireAtLeastOneTag && log.tags.length === 0 && !log.noTags) {
      return false
    }

    return true
  }

  if (project.config.kind === 'daily-tag-only') {
    const { requireAtLeastOneTag } = project.config.completion

    if (requireAtLeastOneTag && log.tags.length === 0 && !log.noTags) {
      return false
    }

    return true
  }

  return false
}

/**
 * Validates if a multi-choice log entry meets the project's completion requirements.
 */
export function isLabMultiChoiceLogComplete(log: LabMultiChoiceLog, project: LabProject): boolean {
  if (project.config.kind !== 'daily-multi-choice') {
    return false
  }

  if (project.config.completion.requireAtLeastOneChoice && log.selectedOptionIds.length === 0) {
    return false
  }

  return true
}
