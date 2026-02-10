import type {Habit} from '../../../domain/types'
import {appStore} from '../../../domain/store/appStore'

export type RenameKind = 'category' | 'habit' | 'weeklyTask' | 'todo'

export type RenameTarget =
  | null
  | {
      kind: RenameKind
      id: string
      name: string
    }

export function applyRename(args: {
  renameTarget: RenameTarget
  renameValue: string
  renameHabitCategoryId: string
  renameHabitPriority: 1 | 2 | 3
  renameHabitScoreDay: 'same' | 'previous'
  renameWeeklyTarget: number
  habitsById: Record<string, Habit>
}): boolean {
  const {renameTarget, renameValue, renameHabitCategoryId, renameHabitPriority, renameHabitScoreDay, renameWeeklyTarget, habitsById} = args

  if (!renameTarget) return false
  const next = renameValue.trim()
  if (!next) return false

  if (renameTarget.kind === 'category') {
    appStore.actions.renameCategory(renameTarget.id, next)
    return true
  }

  if (renameTarget.kind === 'habit') {
    appStore.actions.renameHabit(renameTarget.id, next)

    const current = habitsById[renameTarget.id]
    if (current && renameHabitCategoryId && renameHabitCategoryId !== current.categoryId) {
      appStore.actions.moveHabit(renameTarget.id, renameHabitCategoryId)
    }

    if (current && renameHabitPriority !== current.priority) {
      appStore.actions.setHabitPriority(renameTarget.id, renameHabitPriority)
    }

    if (current && (renameHabitScoreDay ?? 'same') !== (current.scoreDay ?? 'same')) {
      appStore.actions.setHabitScoreDay(renameTarget.id, renameHabitScoreDay)
    }

    return true
  }

  if (renameTarget.kind === 'todo') {
    appStore.actions.renameTodo(renameTarget.id, next)
    return true
  }

  appStore.actions.renameWeeklyTask(renameTarget.id, next)
  appStore.actions.setWeeklyTaskTargetPerWeek(renameTarget.id, renameWeeklyTarget)
  return true
}
