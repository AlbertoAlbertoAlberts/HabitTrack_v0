import type { AppStateV1, LabProjectId, LabTagCategory } from '../../types'
import { generateId } from '../../utils/generateId'

/**
 * Add a new tag category to a project.
 * Category names must be unique within a project (case-insensitive).
 */
export function addLabTagCategory(
  state: AppStateV1,
  projectId: LabProjectId,
  name: string
): AppStateV1 {
  if (!state.lab) return state

  const project = state.lab.projects[projectId]
  if (!project) return state

  const trimmedName = name.trim()
  if (!trimmedName) {
    console.warn('Tag category name must be non-empty')
    return state
  }

  // Validate uniqueness (case-insensitive)
  const existingCategories = state.lab.tagCategoriesByProject?.[projectId] || {}
  const normalizedName = trimmedName.toLowerCase()
  const nameExists = Object.values(existingCategories).some(
    cat => cat.name.toLowerCase() === normalizedName
  )
  if (nameExists) {
    console.warn(`Tag category name "${trimmedName}" already exists in project ${projectId}`)
    return state
  }

  const now = new Date().toISOString()
  const id = generateId()
  const existingOrder = state.lab.tagCategoryOrderByProject?.[projectId] || []

  const category: LabTagCategory = {
    id,
    name: trimmedName,
    sortIndex: existingOrder.length,
    createdAt: now,
    updatedAt: now,
  }

  return {
    ...state,
    lab: {
      ...state.lab,
      tagCategoriesByProject: {
        ...state.lab.tagCategoriesByProject,
        [projectId]: {
          ...existingCategories,
          [id]: category,
        },
      },
      tagCategoryOrderByProject: {
        ...state.lab.tagCategoryOrderByProject,
        [projectId]: [...existingOrder, id],
      },
    },
  }
}

/**
 * Update an existing tag category.
 * If updating name, validates uniqueness (case-insensitive).
 */
export function updateLabTagCategory(
  state: AppStateV1,
  projectId: LabProjectId,
  categoryId: string,
  updates: { name?: string; sortIndex?: number }
): AppStateV1 {
  if (!state.lab) return state

  const existingCategories = state.lab.tagCategoriesByProject?.[projectId]
  const category = existingCategories?.[categoryId]
  if (!category) return state

  // Validate name uniqueness if updating name
  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim()
    if (!trimmedName) {
      console.warn('Tag category name must be non-empty')
      return state
    }
    const normalizedName = trimmedName.toLowerCase()
    const nameExists = Object.entries(existingCategories).some(
      ([id, cat]) => id !== categoryId && cat.name.toLowerCase() === normalizedName
    )
    if (nameExists) {
      console.warn(`Tag category name "${trimmedName}" already exists in project ${projectId}`)
      return state
    }
  }

  const now = new Date().toISOString()

  return {
    ...state,
    lab: {
      ...state.lab,
      tagCategoriesByProject: {
        ...state.lab.tagCategoriesByProject,
        [projectId]: {
          ...existingCategories,
          [categoryId]: {
            ...category,
            ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
            ...(updates.sortIndex !== undefined ? { sortIndex: updates.sortIndex } : {}),
            updatedAt: now,
          },
        },
      },
    },
  }
}

/**
 * Delete a tag category.
 * Clears categoryId from all tags that reference this category (does NOT delete the tags).
 */
export function deleteLabTagCategory(
  state: AppStateV1,
  projectId: LabProjectId,
  categoryId: string
): AppStateV1 {
  if (!state.lab) return state

  const existingCategories = state.lab.tagCategoriesByProject?.[projectId]
  if (!existingCategories || !existingCategories[categoryId]) return state

  // Remove the category
  const { [categoryId]: _removed, ...remainingCategories } = existingCategories
  void _removed

  // Remove from order
  const existingOrder = state.lab.tagCategoryOrderByProject?.[projectId] || []
  const newOrder = existingOrder.filter(id => id !== categoryId)

  // Clear categoryId from all tags in this project that reference this category
  const existingTags = state.lab.tagsByProject[projectId] || {}
  const updatedTags: typeof existingTags = {}
  for (const [tagId, tag] of Object.entries(existingTags)) {
    if (tag.categoryId === categoryId) {
      updatedTags[tagId] = { ...tag, categoryId: undefined }
    } else {
      updatedTags[tagId] = tag
    }
  }

  return {
    ...state,
    lab: {
      ...state.lab,
      tagsByProject: {
        ...state.lab.tagsByProject,
        [projectId]: updatedTags,
      },
      tagCategoriesByProject: {
        ...state.lab.tagCategoriesByProject,
        [projectId]: remainingCategories,
      },
      tagCategoryOrderByProject: {
        ...state.lab.tagCategoryOrderByProject,
        [projectId]: newOrder,
      },
    },
  }
}

/**
 * Reorder tag categories for a project.
 */
export function reorderLabTagCategories(
  state: AppStateV1,
  projectId: LabProjectId,
  orderedIds: string[]
): AppStateV1 {
  if (!state.lab) return state

  const existingCategories = state.lab.tagCategoriesByProject?.[projectId]
  if (!existingCategories) return state

  // Validate that all IDs exist
  const validIds = orderedIds.filter(id => existingCategories[id])

  // Include any categories not in the ordered list at the end
  const existingIds = new Set(Object.keys(existingCategories))
  const orderedSet = new Set(validIds)
  const missingIds = Array.from(existingIds).filter(id => !orderedSet.has(id))

  const newOrder = [...validIds, ...missingIds]

  // Update sortIndex on each category
  const now = new Date().toISOString()
  const updatedCategories = { ...existingCategories }
  for (let i = 0; i < newOrder.length; i++) {
    const id = newOrder[i]
    updatedCategories[id] = {
      ...updatedCategories[id],
      sortIndex: i,
      updatedAt: now,
    }
  }

  return {
    ...state,
    lab: {
      ...state.lab,
      tagCategoriesByProject: {
        ...state.lab.tagCategoriesByProject,
        [projectId]: updatedCategories,
      },
      tagCategoryOrderByProject: {
        ...state.lab.tagCategoryOrderByProject,
        [projectId]: newOrder,
      },
    },
  }
}

/**
 * Check if a tag category is in use (has any tags assigned to it).
 */
export function isLabTagCategoryInUse(
  state: AppStateV1,
  projectId: LabProjectId,
  categoryId: string
): boolean {
  if (!state.lab) return false

  const tags = state.lab.tagsByProject[projectId]
  if (!tags) return false

  return Object.values(tags).some(tag => tag.categoryId === categoryId)
}
