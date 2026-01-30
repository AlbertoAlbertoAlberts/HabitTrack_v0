import type { AppStateV1, LabProjectId, LabLogId, LabTagUse } from '../../types'
import { generateId } from '../../utils/generateId'

/**
 * Add a new event log entry for a project.
 * Append-only behavior: creates a new log with unique ID.
 */
export function addLabEventLog(
  state: AppStateV1,
  projectId: LabProjectId,
  data: {
    timestamp: string
    severity?: number
    tags: LabTagUse[]
    note?: string
  }
): AppStateV1 {
  if (!state.lab) return state

  const project = state.lab.projects[projectId]
  if (!project || project.mode !== 'event') return state

  const logId = generateId()
  const now = new Date().toISOString()

  const projectLogs = state.lab.eventLogsByProject[projectId] || {}

  return {
    ...state,
    lab: {
      ...state.lab,
      eventLogsByProject: {
        ...state.lab.eventLogsByProject,
        [projectId]: {
          ...projectLogs,
          [logId]: {
            id: logId,
            timestamp: data.timestamp,
            createdAt: now,
            updatedAt: now,
            severity: data.severity,
            tags: data.tags,
            note: data.note,
          },
        },
      },
    },
  }
}

/**
 * Update an existing event log entry.
 * Allows editing timestamp, tags, and note.
 */
export function updateLabEventLog(
  state: AppStateV1,
  projectId: LabProjectId,
  logId: LabLogId,
  data: {
    timestamp?: string
    severity?: number
    tags?: LabTagUse[]
    note?: string
  }
): AppStateV1 {
  if (!state.lab) return state

  const projectLogs = state.lab.eventLogsByProject[projectId]
  const existingLog = projectLogs?.[logId]
  if (!existingLog) return state

  return {
    ...state,
    lab: {
      ...state.lab,
      eventLogsByProject: {
        ...state.lab.eventLogsByProject,
        [projectId]: {
          ...projectLogs,
          [logId]: {
            ...existingLog,
            timestamp: data.timestamp ?? existingLog.timestamp,
            severity: data.severity !== undefined ? data.severity : existingLog.severity,
            tags: data.tags ?? existingLog.tags,
            note: data.note !== undefined ? data.note : existingLog.note,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    },
  }
}

/**
 * Delete an event log entry.
 */
export function deleteLabEventLog(
  state: AppStateV1,
  projectId: LabProjectId,
  logId: LabLogId
): AppStateV1 {
  if (!state.lab) return state

  const projectLogs = state.lab.eventLogsByProject[projectId]
  if (!projectLogs || !projectLogs[logId]) return state

  const { [logId]: _removed, ...remainingLogs } = projectLogs
  void _removed

  return {
    ...state,
    lab: {
      ...state.lab,
      eventLogsByProject: {
        ...state.lab.eventLogsByProject,
        [projectId]: remainingLogs,
      },
    },
  }
}

/**
 * Set daily absence marker for an event project (user reports "no event today").
 */
export function setLabEventAbsenceMarker(
  state: AppStateV1,
  projectId: LabProjectId,
  date: string
): AppStateV1 {
  if (!state.lab) return state

  const project = state.lab.projects[projectId]
  if (!project || project.mode !== 'event') return state

  const projectMarkers = state.lab.absenceMarkersByProject?.[projectId] || {}

  return {
    ...state,
    lab: {
      ...state.lab,
      absenceMarkersByProject: {
        ...state.lab.absenceMarkersByProject,
        [projectId]: {
          ...projectMarkers,
          [date]: {
            date,
            updatedAt: new Date().toISOString(),
            noEvent: true,
          },
        },
      },
    },
  }
}

/**
 * Remove daily absence marker for an event project.
 */
export function removeLabEventAbsenceMarker(
  state: AppStateV1,
  projectId: LabProjectId,
  date: string
): AppStateV1 {
  if (!state.lab) return state

  const projectMarkers = state.lab.absenceMarkersByProject?.[projectId]
  if (!projectMarkers || !projectMarkers[date]) return state

  const { [date]: _removed, ...remainingMarkers } = projectMarkers
  void _removed

  return {
    ...state,
    lab: {
      ...state.lab,
      absenceMarkersByProject: {
        ...state.lab.absenceMarkersByProject,
        [projectId]: remainingMarkers,
      },
    },
  }
}
