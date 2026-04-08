import type { AppStateV1, ISODate, LabProjectId, LabTagUse } from '../../types'

/**
 * Set or update a daily log entry for a project.
 * Works for both 'daily' (track outcome) and 'daily-tag-only' projects.
 * Overwrites existing entry for the same date.
 */
export function setLabDailyLog(
  state: AppStateV1,
  projectId: LabProjectId,
  date: ISODate,
  data: {
    outcome?: number
    additionalOutcomes?: Record<string, number>
    tags: LabTagUse[]
    noTags?: boolean
    note?: string
  }
): AppStateV1 {
  if (!state.lab) return state

  const project = state.lab.projects[projectId]
  if (!project) return state

  // Only allow daily and daily-tag-only projects
  if (project.mode !== 'daily' && project.mode !== 'daily-tag-only') return state

  // Validate additionalOutcomes only for 'daily' projects with additionalOutcomes defined
  if (data.additionalOutcomes && Object.keys(data.additionalOutcomes).length > 0) {
    if (project.config.kind !== 'daily') return state

    const config = project.config
    const validOutcomeIds = new Set(
      (config.additionalOutcomes || []).map(o => o.id)
    )
    const scale = config.outcome.scale

    for (const [outcomeId, value] of Object.entries(data.additionalOutcomes)) {
      if (!validOutcomeIds.has(outcomeId)) {
        console.warn(`Invalid additional outcome ID: ${outcomeId}`)
        return state
      }
      if (value < scale.min || value > scale.max) {
        console.warn(`Additional outcome value ${value} out of range [${scale.min}, ${scale.max}]`)
        return state
      }
    }
  }

  const projectLogs = state.lab.dailyLogsByProject[projectId] || {}

  return {
    ...state,
    lab: {
      ...state.lab,
      dailyLogsByProject: {
        ...state.lab.dailyLogsByProject,
        [projectId]: {
          ...projectLogs,
          [date]: {
            date,
            updatedAt: new Date().toISOString(),
            outcome: data.outcome,
            additionalOutcomes: data.additionalOutcomes,
            tags: data.tags,
            noTags: data.noTags,
            note: data.note,
          },
        },
      },
    },
  }
}

/**
 * Delete a daily log entry for a specific date.
 */
export function deleteLabDailyLog(
  state: AppStateV1,
  projectId: LabProjectId,
  date: ISODate
): AppStateV1 {
  if (!state.lab) return state

  const projectLogs = state.lab.dailyLogsByProject[projectId]
  if (!projectLogs || !projectLogs[date]) return state

  const { [date]: _removed, ...remainingLogs } = projectLogs
  void _removed

  return {
    ...state,
    lab: {
      ...state.lab,
      dailyLogsByProject: {
        ...state.lab.dailyLogsByProject,
        [projectId]: remainingLogs,
      },
    },
  }
}
