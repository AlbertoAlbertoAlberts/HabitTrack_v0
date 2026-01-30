import type { AppStateV1, LabProject, LabProjectId, LabProjectConfig } from '../../types'
import { generateId } from '../../utils/generateId'

/**
 * Add a new LAB project
 */
export function addLabProject(
  state: AppStateV1,
  name: string,
  mode: 'daily' | 'event',
  config: LabProjectConfig
): AppStateV1 {
  const now = new Date().toISOString()
  const id: LabProjectId = generateId()

  const project: LabProject = {
    id,
    name,
    mode,
    createdAt: now,
    updatedAt: now,
    config,
  }

  return {
    ...state,
    lab: {
      ...state.lab!,
      projects: {
        ...state.lab!.projects,
        [id]: project,
      },
      projectOrder: [...state.lab!.projectOrder, id],
      tagsByProject: {
        ...state.lab!.tagsByProject,
        [id]: {},
      },
      tagOrderByProject: {
        ...state.lab!.tagOrderByProject,
        [id]: [],
      },
      dailyLogsByProject: {
        ...state.lab!.dailyLogsByProject,
        [id]: {},
      },
      eventLogsByProject: {
        ...state.lab!.eventLogsByProject,
        [id]: {},
      },
    },
  }
}

/**
 * Update an existing LAB project
 */
export function updateLabProject(
  state: AppStateV1,
  projectId: LabProjectId,
  updates: Partial<Pick<LabProject, 'name' | 'config'>>
): AppStateV1 {
  const project = state.lab!.projects[projectId]
  if (!project) {
    return state
  }

  const now = new Date().toISOString()

  return {
    ...state,
    lab: {
      ...state.lab!,
      projects: {
        ...state.lab!.projects,
        [projectId]: {
          ...project,
          ...updates,
          updatedAt: now,
        },
      },
    },
  }
}

/**
 * Archive a LAB project (soft delete)
 */
export function archiveLabProject(state: AppStateV1, projectId: LabProjectId): AppStateV1 {
  const project = state.lab!.projects[projectId]
  if (!project) {
    return state
  }

  const now = new Date().toISOString()

  return {
    ...state,
    lab: {
      ...state.lab!,
      projects: {
        ...state.lab!.projects,
        [projectId]: {
          ...project,
          archived: true,
          updatedAt: now,
        },
      },
    },
  }
}

/**
 * Unarchive a LAB project
 */
export function unarchiveLabProject(state: AppStateV1, projectId: LabProjectId): AppStateV1 {
  const project = state.lab!.projects[projectId]
  if (!project) {
    return state
  }

  const now = new Date().toISOString()

  return {
    ...state,
    lab: {
      ...state.lab!,
      projects: {
        ...state.lab!.projects,
        [projectId]: {
          ...project,
          archived: false,
          updatedAt: now,
        },
      },
    },
  }
}

/**
 * Delete a LAB project permanently (hard delete)
 * WARNING: This removes all associated data (tags, logs, findings)
 */
export function deleteLabProject(state: AppStateV1, projectId: LabProjectId): AppStateV1 {
  const project = state.lab!.projects[projectId]
  if (!project) {
    return state
  }

  const { [projectId]: _removed, ...remainingProjects } = state.lab!.projects
  const { [projectId]: _removedTags, ...remainingTags } = state.lab!.tagsByProject
  const { [projectId]: _removedTagOrder, ...remainingTagOrder } = state.lab!.tagOrderByProject
  const { [projectId]: _removedDailyLogs, ...remainingDailyLogs } = state.lab!.dailyLogsByProject
  const { [projectId]: _removedEventLogs, ...remainingEventLogs } = state.lab!.eventLogsByProject
  void _removed
  void _removedTags
  void _removedTagOrder
  void _removedDailyLogs
  void _removedEventLogs

  const remainingFindings = state.lab!.findingsCache
    ? (() => {
        const { [projectId]: _removedFindings, ...rest } = state.lab!.findingsCache
        void _removedFindings
        return rest
      })()
    : undefined

  return {
    ...state,
    lab: {
      ...state.lab!,
      projects: remainingProjects,
      projectOrder: state.lab!.projectOrder.filter((id) => id !== projectId),
      tagsByProject: remainingTags,
      tagOrderByProject: remainingTagOrder,
      dailyLogsByProject: remainingDailyLogs,
      eventLogsByProject: remainingEventLogs,
      findingsCache: remainingFindings,
    },
  }
}

/**
 * Reorder LAB projects
 */
export function reorderLabProjects(state: AppStateV1, orderedIds: LabProjectId[]): AppStateV1 {
  // Validate that all IDs exist
  const validIds = orderedIds.filter((id) => state.lab!.projects[id])

  // Include any projects not in the ordered list at the end
  const existingIds = new Set(Object.keys(state.lab!.projects))
  const orderedSet = new Set(validIds)
  const missingIds = Array.from(existingIds).filter((id) => !orderedSet.has(id))

  return {
    ...state,
    lab: {
      ...state.lab!,
      projectOrder: [...validIds, ...missingIds],
    },
  }
}

/**
 * Set the active project in UI state
 */
export function setActiveLabProject(
  state: AppStateV1,
  projectId: LabProjectId | null
): AppStateV1 {
  return {
    ...state,
    lab: {
      ...state.lab!,
      ui: {
        ...state.lab!.ui,
        activeProjectId: projectId ?? undefined,
      },
    },
  }
}
