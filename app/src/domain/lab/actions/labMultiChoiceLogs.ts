import type { AppStateV1, ISODate, LabProjectId } from '../../types'

/**
 * Set or update a multi-choice log entry for a project.
 * Overwrites existing entry for the same date.
 */
export function setLabMultiChoiceLog(
  state: AppStateV1,
  projectId: LabProjectId,
  date: ISODate,
  data: { selectedOptionIds: string[]; note?: string }
): AppStateV1 {
  if (!state.lab) return state

  const project = state.lab.projects[projectId]
  if (!project || project.mode !== 'daily-multi-choice') return state
  if (project.config.kind !== 'daily-multi-choice') return state

  const config = project.config

  // Validate selectedOptionIds reference non-archived options
  const activeOptionIds = new Set(
    config.options.filter(o => !o.archived).map(o => o.id)
  )
  const invalidIds = data.selectedOptionIds.filter(id => !activeOptionIds.has(id))
  if (invalidIds.length > 0) {
    console.warn(`Invalid or archived option IDs: ${invalidIds.join(', ')}`)
    return state
  }

  // If single-select mode, max 1 selected
  if (config.selectionMode === 'single' && data.selectedOptionIds.length > 1) {
    console.warn('Single-select mode allows at most 1 selected option')
    return state
  }

  const projectLogs = state.lab.multiChoiceLogsByProject[projectId] || {}

  return {
    ...state,
    lab: {
      ...state.lab,
      multiChoiceLogsByProject: {
        ...state.lab.multiChoiceLogsByProject,
        [projectId]: {
          ...projectLogs,
          [date]: {
            date,
            updatedAt: new Date().toISOString(),
            selectedOptionIds: data.selectedOptionIds,
            note: data.note,
          },
        },
      },
    },
  }
}

/**
 * Delete a multi-choice log entry for a specific date.
 */
export function deleteLabMultiChoiceLog(
  state: AppStateV1,
  projectId: LabProjectId,
  date: ISODate
): AppStateV1 {
  if (!state.lab) return state

  const projectLogs = state.lab.multiChoiceLogsByProject[projectId]
  if (!projectLogs || !projectLogs[date]) return state

  const { [date]: _removed, ...remainingLogs } = projectLogs
  void _removed

  return {
    ...state,
    lab: {
      ...state.lab,
      multiChoiceLogsByProject: {
        ...state.lab.multiChoiceLogsByProject,
        [projectId]: remainingLogs,
      },
    },
  }
}
