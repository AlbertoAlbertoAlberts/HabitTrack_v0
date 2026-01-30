import type { AppStateV1, LabProjectId, LabTagId, LabTagDef } from '../../types'
import { generateId } from '../../utils/generateId'

/**
 * Add a new tag to a project's tag library
 */
export function addLabTag(
  state: AppStateV1,
  projectId: LabProjectId,
  tagDef: Omit<LabTagDef, 'id' | 'createdAt' | 'updatedAt'>
): AppStateV1 {
  const project = state.lab!.projects[projectId]
  if (!project) {
    return state
  }

  // Validate: tag name must be unique within project (case-insensitive)
  const existingTags = state.lab!.tagsByProject[projectId] || {}
  const normalizedName = tagDef.name.trim().toLowerCase()
  
  const nameExists = Object.values(existingTags).some(
    (tag) => tag.name.toLowerCase() === normalizedName
  )
  
  if (nameExists) {
    // Silently fail or could throw error - for now return unchanged state
    console.warn(`Tag name "${tagDef.name}" already exists in project ${projectId}`)
    return state
  }

  const now = new Date().toISOString()
  const id: LabTagId = generateId()

  const newTag: LabTagDef = {
    id,
    name: tagDef.name.trim(),
    createdAt: now,
    updatedAt: now,
    intensity: tagDef.intensity,
    group: tagDef.group,
  }

  return {
    ...state,
    lab: {
      ...state.lab!,
      tagsByProject: {
        ...state.lab!.tagsByProject,
        [projectId]: {
          ...existingTags,
          [id]: newTag,
        },
      },
      tagOrderByProject: {
        ...state.lab!.tagOrderByProject,
        [projectId]: [...(state.lab!.tagOrderByProject[projectId] || []), id],
      },
    },
  }
}

/**
 * Update an existing tag
 */
export function updateLabTag(
  state: AppStateV1,
  projectId: LabProjectId,
  tagId: LabTagId,
  updates: Partial<Omit<LabTagDef, 'id' | 'createdAt' | 'updatedAt'>>
): AppStateV1 {
  const existingTags = state.lab!.tagsByProject[projectId]
  const tag = existingTags?.[tagId]
  
  if (!tag) {
    return state
  }

  // If updating name, validate uniqueness
  if (updates.name !== undefined) {
    const normalizedName = updates.name.trim().toLowerCase()
    const nameExists = Object.entries(existingTags).some(
      ([id, t]) => id !== tagId && t.name.toLowerCase() === normalizedName
    )
    
    if (nameExists) {
      console.warn(`Tag name "${updates.name}" already exists in project ${projectId}`)
      return state
    }
  }

  const now = new Date().toISOString()

  return {
    ...state,
    lab: {
      ...state.lab!,
      tagsByProject: {
        ...state.lab!.tagsByProject,
        [projectId]: {
          ...existingTags,
          [tagId]: {
            ...tag,
            ...updates,
            name: updates.name ? updates.name.trim() : tag.name,
            updatedAt: now,
          },
        },
      },
    },
  }
}

/**
 * Check if a tag is in use (appears in any logs)
 */
export function isLabTagInUse(state: AppStateV1, projectId: LabProjectId, tagId: LabTagId): boolean {
  // Check daily logs
  const dailyLogs = state.lab!.dailyLogsByProject[projectId] || {}
  for (const log of Object.values(dailyLogs)) {
    if (log.tags.some((tagUse) => tagUse.tagId === tagId)) {
      return true
    }
  }

  // Check event logs
  const eventLogs = state.lab!.eventLogsByProject[projectId] || {}
  for (const log of Object.values(eventLogs)) {
    if (log.tags.some((tagUse) => tagUse.tagId === tagId)) {
      return true
    }
  }

  return false
}

/**
 * Delete a tag (soft-delete by marking or hard delete if not in use)
 * Returns the updated state if successful, or null if blocked
 */
export function deleteLabTag(
  state: AppStateV1,
  projectId: LabProjectId,
  tagId: LabTagId,
  force: boolean = false
): AppStateV1 | null {
  const existingTags = state.lab!.tagsByProject[projectId]
  const tag = existingTags?.[tagId]
  
  if (!tag) {
    return state
  }

  // Check if tag is in use
  if (!force && isLabTagInUse(state, projectId, tagId)) {
    console.warn(`Cannot delete tag "${tag.name}" - it is in use in logs`)
    return null // Blocked
  }

  // Hard delete: remove from tags and tag order
  const { [tagId]: _removed, ...remainingTags } = existingTags
  void _removed

  return {
    ...state,
    lab: {
      ...state.lab!,
      tagsByProject: {
        ...state.lab!.tagsByProject,
        [projectId]: remainingTags,
      },
      tagOrderByProject: {
        ...state.lab!.tagOrderByProject,
        [projectId]: (state.lab!.tagOrderByProject[projectId] || []).filter((id) => id !== tagId),
      },
    },
  }
}

/**
 * Reorder tags within a project
 */
export function reorderLabTags(
  state: AppStateV1,
  projectId: LabProjectId,
  orderedIds: LabTagId[]
): AppStateV1 {
  const existingTags = state.lab!.tagsByProject[projectId] || {}
  
  // Validate that all IDs exist
  const validIds = orderedIds.filter((id) => existingTags[id])
  
  // Include any tags not in the ordered list at the end
  const existingIds = new Set(Object.keys(existingTags))
  const orderedSet = new Set(validIds)
  const missingIds = Array.from(existingIds).filter((id) => !orderedSet.has(id))

  return {
    ...state,
    lab: {
      ...state.lab!,
      tagOrderByProject: {
        ...state.lab!.tagOrderByProject,
        [projectId]: [...validIds, ...missingIds],
      },
    },
  }
}

/**
 * Validate tag intensity rules
 * Returns true if the intensity value is valid for the tag
 */
export function validateLabTagIntensity(
  tagDef: LabTagDef,
  intensity: number | undefined
): { valid: boolean; error?: string } {
  // If intensity is not enabled, it should not be provided
  if (!tagDef.intensity?.enabled) {
    if (intensity !== undefined) {
      return { valid: false, error: 'Tag does not use intensity' }
    }
    return { valid: true }
  }

  // If intensity is enabled, it must be provided
  if (intensity === undefined) {
    return { valid: false, error: 'Tag requires intensity value' }
  }

  // Check range
  const { min, max, step } = tagDef.intensity
  
  if (intensity < min || intensity > max) {
    return { valid: false, error: `Intensity must be between ${min} and ${max}` }
  }

  // Check step if defined
  if (step !== undefined && step > 0) {
    const steps = Math.round((intensity - min) / step)
    const expectedValue = min + steps * step
    
    if (Math.abs(intensity - expectedValue) > 0.0001) {
      return { valid: false, error: `Intensity must be in steps of ${step}` }
    }
  }

  return { valid: true }
}
