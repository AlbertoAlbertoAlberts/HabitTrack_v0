import type { AppStateV1, ISODate, LabProjectId, LabTagUse } from '../../types'

/**
 * Set or update a daily log entry for a project.
 * Overwrites existing entry for the same date.
 */
export function setLabDailyLog(
  state: AppStateV1,
  projectId: LabProjectId,
  date: ISODate,
  data: {
    outcome?: number
    tags: LabTagUse[]
    noTags?: boolean
    note?: string
  }
): AppStateV1 {
  if (!state.lab) return state

  const project = state.lab.projects[projectId]
  if (!project || project.mode !== 'daily') return state

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
