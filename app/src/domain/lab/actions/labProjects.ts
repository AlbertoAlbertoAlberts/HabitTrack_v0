import type { AppStateV1, LabProject, LabProjectId, LabProjectConfig, LabProjectMode } from '../../types'
import { generateId } from '../../utils/generateId'

/**
 * Add a new LAB project
 */
export function addLabProject(
  state: AppStateV1,
  name: string,
  mode: LabProjectMode,
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

  const lab = state.lab!

  return {
    ...state,
    lab: {
      ...lab,
      projects: {
        ...lab.projects,
        [id]: project,
      },
      projectOrder: [...lab.projectOrder, id],
      tagsByProject: {
        ...lab.tagsByProject,
        [id]: {},
      },
      tagOrderByProject: {
        ...lab.tagOrderByProject,
        [id]: [],
      },
      dailyLogsByProject: {
        ...lab.dailyLogsByProject,
        [id]: {},
      },
      eventLogsByProject: {
        ...lab.eventLogsByProject,
        [id]: {},
      },
      // Initialize multi-choice log store for multi-choice projects
      multiChoiceLogsByProject: {
        ...lab.multiChoiceLogsByProject,
        ...(mode === 'daily-multi-choice' ? { [id]: {} } : {}),
      },
    },
  }
}

/**
 * Update an existing LAB project.
 * For multi-choice projects: archiving options (setting archived: true) is preferred
 * over deletion when data has been logged with that option.
 * Option labels must be non-empty and unique (case-insensitive).
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

  // Validate multi-choice options if updating config
  if (updates.config && updates.config.kind === 'daily-multi-choice') {
    const opts = updates.config.options
    const activeOpts = opts.filter(o => !o.archived)
    // Labels must be non-empty
    if (activeOpts.some(o => !o.label.trim())) {
      console.warn('Multi-choice option labels must be non-empty')
      return state
    }
    // Labels must be unique (case-insensitive) among active options
    const labels = new Set<string>()
    for (const o of activeOpts) {
      const norm = o.label.trim().toLowerCase()
      if (labels.has(norm)) {
        console.warn(`Duplicate multi-choice option label: "${o.label}"`)
        return state
      }
      labels.add(norm)
    }
  }

  // Validate additional outcomes if updating a daily config
  if (updates.config && updates.config.kind === 'daily' && updates.config.additionalOutcomes) {
    const outcomes = updates.config.additionalOutcomes
    // Names must be non-empty
    if (outcomes.some(o => !o.name.trim())) {
      console.warn('Additional outcome names must be non-empty')
      return state
    }
    // Names must be unique (case-insensitive)
    const names = new Set<string>()
    for (const o of outcomes) {
      const norm = o.name.trim().toLowerCase()
      if (names.has(norm)) {
        console.warn(`Duplicate additional outcome name: "${o.name}"`)
        return state
      }
      names.add(norm)
    }
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
 * WARNING: This removes all associated data (tags, logs, findings, categories, absence markers)
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
  const { [projectId]: _removedMultiChoiceLogs, ...remainingMultiChoiceLogs } = state.lab!.multiChoiceLogsByProject
  void _removed
  void _removedTags
  void _removedTagOrder
  void _removedDailyLogs
  void _removedEventLogs
  void _removedMultiChoiceLogs

  const remainingFindings = state.lab!.findingsCache
    ? (() => {
        const { [projectId]: _removedFindings, ...rest } = state.lab!.findingsCache
        void _removedFindings
        return rest
      })()
    : undefined

  // Clean up absence markers
  const remainingAbsenceMarkers = state.lab!.absenceMarkersByProject
    ? (() => {
        const { [projectId]: _removedAbsence, ...rest } = state.lab!.absenceMarkersByProject!
        void _removedAbsence
        return rest
      })()
    : undefined

  // Clean up tag categories
  const remainingTagCategories = state.lab!.tagCategoriesByProject
    ? (() => {
        const { [projectId]: _removedCats, ...rest } = state.lab!.tagCategoriesByProject!
        void _removedCats
        return rest
      })()
    : undefined

  // Clean up tag category order
  const remainingTagCategoryOrder = state.lab!.tagCategoryOrderByProject
    ? (() => {
        const { [projectId]: _removedCatOrder, ...rest } = state.lab!.tagCategoryOrderByProject!
        void _removedCatOrder
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
      multiChoiceLogsByProject: remainingMultiChoiceLogs,
      findingsCache: remainingFindings,
      absenceMarkersByProject: remainingAbsenceMarkers,
      tagCategoriesByProject: remainingTagCategories,
      tagCategoryOrderByProject: remainingTagCategoryOrder,
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
