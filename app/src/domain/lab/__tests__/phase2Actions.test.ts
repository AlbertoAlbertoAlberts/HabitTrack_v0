import { describe, it, expect } from 'vitest'
import { createTestState } from './testHelpers'
import { addLabProject, updateLabProject, deleteLabProject } from '../actions/labProjects'
import { setLabDailyLog } from '../actions/labDailyLogs'
import { setLabMultiChoiceLog, deleteLabMultiChoiceLog } from '../actions/labMultiChoiceLogs'
import {
  addLabTagCategory,
  updateLabTagCategory,
  deleteLabTagCategory,
  reorderLabTagCategories,
  isLabTagCategoryInUse,
} from '../actions/labTagCategories'
import type {
  LabDailyProjectConfig,
  LabDailyMultiChoiceProjectConfig,
  LabDailyTagOnlyProjectConfig,
  LabProject,
} from '../../types'

// ─── Helpers ────────────────────────────────────────────────────────

const dailyConfig: LabDailyProjectConfig = {
  kind: 'daily',
  outcome: {
    id: 'outcome',
    name: 'Quality',
    scale: { min: 1, max: 10 },
    required: true,
  },
  additionalOutcomes: [
    { id: 'outcome_2', name: 'Energy', scale: { min: 1, max: 10 } },
    { id: 'outcome_3', name: 'Mood', scale: { min: 1, max: 10 } },
  ],
  alignment: { exposureWindow: 'sameDay' },
  completion: { requireOutcome: true, requireAtLeastOneTag: false },
}

const multiChoiceConfig: LabDailyMultiChoiceProjectConfig = {
  kind: 'daily-multi-choice',
  selectionMode: 'multiple',
  options: [
    { id: 'opt1', label: 'VEF', createdAt: '2025-01-01T00:00:00Z' },
    { id: 'opt2', label: 'Coding', createdAt: '2025-01-01T00:00:00Z' },
    { id: 'opt3', label: 'Rest', createdAt: '2025-01-01T00:00:00Z' },
    { id: 'opt4', label: 'Archived', createdAt: '2025-01-01T00:00:00Z', archived: true },
  ],
  completion: { requireAtLeastOneChoice: true },
}

const singleSelectConfig: LabDailyMultiChoiceProjectConfig = {
  ...multiChoiceConfig,
  selectionMode: 'single',
}

const tagOnlyConfig: LabDailyTagOnlyProjectConfig = {
  kind: 'daily-tag-only',
  tagsEnabled: true,
  completion: { requireAtLeastOneTag: true },
}

function stateWithProject(project: LabProject) {
  return createTestState({
    projects: { [project.id]: project },
    projectOrder: [project.id],
    tagsByProject: { [project.id]: {} },
    tagOrderByProject: { [project.id]: [] },
    dailyLogsByProject: { [project.id]: {} },
    eventLogsByProject: { [project.id]: {} },
    multiChoiceLogsByProject: { [project.id]: {} },
  })
}

function makeProject(id: string, mode: LabProject['mode'], config: LabProject['config']): LabProject {
  return {
    id,
    name: `Test ${mode}`,
    mode,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    config,
  }
}

// ─── setLabMultiChoiceLog ───────────────────────────────────────────

describe('setLabMultiChoiceLog', () => {
  const proj = makeProject('mc1', 'daily-multi-choice', multiChoiceConfig)

  it('logs valid multi-select choices', () => {
    const state = stateWithProject(proj)
    const next = setLabMultiChoiceLog(state, 'mc1', '2025-01-15', {
      selectedOptionIds: ['opt1', 'opt2'],
      note: 'Good day',
    })
    const log = next.lab!.multiChoiceLogsByProject['mc1']['2025-01-15']
    expect(log.selectedOptionIds).toEqual(['opt1', 'opt2'])
    expect(log.note).toBe('Good day')
    expect(log.date).toBe('2025-01-15')
  })

  it('logs valid single-select choice', () => {
    const proj2 = makeProject('mc2', 'daily-multi-choice', singleSelectConfig)
    const state = stateWithProject(proj2)
    const next = setLabMultiChoiceLog(state, 'mc2', '2025-01-15', {
      selectedOptionIds: ['opt1'],
    })
    const log = next.lab!.multiChoiceLogsByProject['mc2']['2025-01-15']
    expect(log.selectedOptionIds).toEqual(['opt1'])
  })

  it('rejects single-select with multiple choices', () => {
    const proj2 = makeProject('mc2', 'daily-multi-choice', singleSelectConfig)
    const state = stateWithProject(proj2)
    const next = setLabMultiChoiceLog(state, 'mc2', '2025-01-15', {
      selectedOptionIds: ['opt1', 'opt2'],
    })
    // Should return unchanged state
    expect(next.lab!.multiChoiceLogsByProject['mc2']).toEqual({})
  })

  it('rejects invalid option IDs', () => {
    const state = stateWithProject(proj)
    const next = setLabMultiChoiceLog(state, 'mc1', '2025-01-15', {
      selectedOptionIds: ['opt1', 'nonexistent'],
    })
    expect(next.lab!.multiChoiceLogsByProject['mc1']).toEqual({})
  })

  it('rejects archived option IDs', () => {
    const state = stateWithProject(proj)
    const next = setLabMultiChoiceLog(state, 'mc1', '2025-01-15', {
      selectedOptionIds: ['opt1', 'opt4'], // opt4 is archived
    })
    expect(next.lab!.multiChoiceLogsByProject['mc1']).toEqual({})
  })

  it('rejects logging on non-multi-choice project', () => {
    const dailyProj = makeProject('d1', 'daily', dailyConfig)
    const state = stateWithProject(dailyProj)
    const next = setLabMultiChoiceLog(state, 'd1', '2025-01-15', {
      selectedOptionIds: ['opt1'],
    })
    expect(next).toBe(state) // unchanged
  })

  it('allows empty selectedOptionIds', () => {
    const state = stateWithProject(proj)
    const next = setLabMultiChoiceLog(state, 'mc1', '2025-01-15', {
      selectedOptionIds: [],
    })
    const log = next.lab!.multiChoiceLogsByProject['mc1']['2025-01-15']
    expect(log.selectedOptionIds).toEqual([])
  })
})

describe('deleteLabMultiChoiceLog', () => {
  it('deletes an existing log', () => {
    const proj = makeProject('mc1', 'daily-multi-choice', multiChoiceConfig)
    let state = stateWithProject(proj)
    state = setLabMultiChoiceLog(state, 'mc1', '2025-01-15', {
      selectedOptionIds: ['opt1'],
    })
    expect(state.lab!.multiChoiceLogsByProject['mc1']['2025-01-15']).toBeDefined()

    const next = deleteLabMultiChoiceLog(state, 'mc1', '2025-01-15')
    expect(next.lab!.multiChoiceLogsByProject['mc1']['2025-01-15']).toBeUndefined()
  })
})

// ─── setLabDailyLog with additionalOutcomes ─────────────────────────

describe('setLabDailyLog with additionalOutcomes', () => {
  const proj = makeProject('d1', 'daily', dailyConfig)

  it('saves additional outcomes alongside primary outcome', () => {
    const state = stateWithProject(proj)
    const next = setLabDailyLog(state, 'd1', '2025-01-15', {
      outcome: 7,
      additionalOutcomes: { outcome_2: 5, outcome_3: 8 },
      tags: [],
    })
    const log = next.lab!.dailyLogsByProject['d1']['2025-01-15']
    expect(log.outcome).toBe(7)
    expect(log.additionalOutcomes).toEqual({ outcome_2: 5, outcome_3: 8 })
  })

  it('rejects out-of-range additional outcome values', () => {
    const state = stateWithProject(proj)
    const next = setLabDailyLog(state, 'd1', '2025-01-15', {
      outcome: 7,
      additionalOutcomes: { outcome_2: 99 }, // max is 10
      tags: [],
    })
    // Should return unchanged state
    expect(next.lab!.dailyLogsByProject['d1']).toEqual({})
  })

  it('rejects invalid additional outcome IDs', () => {
    const state = stateWithProject(proj)
    const next = setLabDailyLog(state, 'd1', '2025-01-15', {
      outcome: 7,
      additionalOutcomes: { nonexistent: 5 },
      tags: [],
    })
    expect(next.lab!.dailyLogsByProject['d1']).toEqual({})
  })

  it('validates each additional outcome against its own scale', () => {
    const mixedScaleConfig: LabDailyProjectConfig = {
      ...dailyConfig,
      additionalOutcomes: [
        { id: 'outcome_2', name: 'Sleep', scale: { min: 1, max: 5 } },
        { id: 'outcome_3', name: 'Energy', scale: { min: 1, max: 20 } },
      ],
    }
    const proj3 = makeProject('d3', 'daily', mixedScaleConfig)
    const state = stateWithProject(proj3)

    // Value 15 is out of range for outcome_2 (max 5) — should reject
    const rejected = setLabDailyLog(state, 'd3', '2025-01-15', {
      outcome: 7,
      additionalOutcomes: { outcome_2: 15 },
      tags: [],
    })
    expect(rejected.lab!.dailyLogsByProject['d3']).toEqual({})

    // Value 15 is within range for outcome_3 (max 20) — should accept
    const accepted = setLabDailyLog(state, 'd3', '2025-01-15', {
      outcome: 7,
      additionalOutcomes: { outcome_3: 15 },
      tags: [],
    })
    expect(accepted.lab!.dailyLogsByProject['d3']['2025-01-15'].additionalOutcomes).toEqual({ outcome_3: 15 })
  })

  it('works for single-outcome daily projects (no additionalOutcomes)', () => {
    const simpleConfig: LabDailyProjectConfig = {
      ...dailyConfig,
      additionalOutcomes: undefined,
    }
    const proj2 = makeProject('d2', 'daily', simpleConfig)
    const state = stateWithProject(proj2)
    const next = setLabDailyLog(state, 'd2', '2025-01-15', {
      outcome: 8,
      tags: [{ tagId: 't1' }],
    })
    const log = next.lab!.dailyLogsByProject['d2']['2025-01-15']
    expect(log.outcome).toBe(8)
    expect(log.additionalOutcomes).toBeUndefined()
  })
})

// ─── setLabDailyLog for daily-tag-only ──────────────────────────────

describe('setLabDailyLog for daily-tag-only', () => {
  const proj = makeProject('to1', 'daily-tag-only', tagOnlyConfig)

  it('accepts tags without outcome', () => {
    const state = stateWithProject(proj)
    const next = setLabDailyLog(state, 'to1', '2025-01-15', {
      tags: [{ tagId: 't1' }, { tagId: 't2' }],
    })
    const log = next.lab!.dailyLogsByProject['to1']['2025-01-15']
    expect(log.tags).toHaveLength(2)
    expect(log.outcome).toBeUndefined()
  })

  it('rejects additionalOutcomes on tag-only projects', () => {
    const state = stateWithProject(proj)
    const next = setLabDailyLog(state, 'to1', '2025-01-15', {
      tags: [],
      additionalOutcomes: { outcome_2: 5 },
    })
    // Should be rejected because kind is not 'daily'
    expect(next.lab!.dailyLogsByProject['to1']).toEqual({})
  })
})

// ─── addLabTagCategory / deleteLabTagCategory ───────────────────────

describe('Tag category actions', () => {
  const proj = makeProject('p1', 'daily', dailyConfig)

  it('adds a category', () => {
    const state = stateWithProject(proj)
    const next = addLabTagCategory(state, 'p1', 'Sleep')
    const cats = next.lab!.tagCategoriesByProject!['p1']
    const catEntries = Object.values(cats)
    expect(catEntries).toHaveLength(1)
    expect(catEntries[0].name).toBe('Sleep')
    expect(next.lab!.tagCategoryOrderByProject!['p1']).toHaveLength(1)
  })

  it('rejects duplicate category names (case-insensitive)', () => {
    let state = stateWithProject(proj)
    state = addLabTagCategory(state, 'p1', 'Sleep')
    const next = addLabTagCategory(state, 'p1', 'SLEEP')
    // Should have only 1 category still
    expect(Object.values(next.lab!.tagCategoriesByProject!['p1'])).toHaveLength(1)
  })

  it('rejects empty category name', () => {
    const state = stateWithProject(proj)
    const next = addLabTagCategory(state, 'p1', '   ')
    expect(next.lab!.tagCategoriesByProject?.['p1']).toBeUndefined()
  })

  it('deletion clears categoryId from tags', () => {
    let state = stateWithProject(proj)
    state = addLabTagCategory(state, 'p1', 'Sleep')
    const catId = Object.keys(state.lab!.tagCategoriesByProject!['p1'])[0]

    // Manually add a tag with this categoryId
    state = {
      ...state,
      lab: {
        ...state.lab!,
        tagsByProject: {
          ...state.lab!.tagsByProject,
          p1: {
            tag1: {
              id: 'tag1',
              name: 'Caffeine',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
              categoryId: catId,
            },
            tag2: {
              id: 'tag2',
              name: 'Exercise',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
              categoryId: 'other-cat', // different category
            },
          },
        },
      },
    }

    const next = deleteLabTagCategory(state, 'p1', catId)

    // Category should be gone
    expect(next.lab!.tagCategoriesByProject!['p1'][catId]).toBeUndefined()
    // tag1 should have categoryId cleared
    expect(next.lab!.tagsByProject['p1']['tag1'].categoryId).toBeUndefined()
    // tag2 should be unaffected
    expect(next.lab!.tagsByProject['p1']['tag2'].categoryId).toBe('other-cat')
  })

  it('isLabTagCategoryInUse detects tags with categoryId', () => {
    let state = stateWithProject(proj)
    state = addLabTagCategory(state, 'p1', 'Sleep')
    const catId = Object.keys(state.lab!.tagCategoriesByProject!['p1'])[0]

    // No tags yet — not in use
    expect(isLabTagCategoryInUse(state, 'p1', catId)).toBe(false)

    // Add a tag with this category
    state = {
      ...state,
      lab: {
        ...state.lab!,
        tagsByProject: {
          ...state.lab!.tagsByProject,
          p1: {
            tag1: {
              id: 'tag1',
              name: 'Test',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
              categoryId: catId,
            },
          },
        },
      },
    }
    expect(isLabTagCategoryInUse(state, 'p1', catId)).toBe(true)
  })
})

describe('updateLabTagCategory', () => {
  const proj = makeProject('p1', 'daily', dailyConfig)

  it('updates category name', () => {
    let state = stateWithProject(proj)
    state = addLabTagCategory(state, 'p1', 'Sleep')
    const catId = Object.keys(state.lab!.tagCategoriesByProject!['p1'])[0]

    const next = updateLabTagCategory(state, 'p1', catId, { name: 'Rest' })
    expect(next.lab!.tagCategoriesByProject!['p1'][catId].name).toBe('Rest')
  })

  it('rejects duplicate name on update', () => {
    let state = stateWithProject(proj)
    state = addLabTagCategory(state, 'p1', 'Sleep')
    state = addLabTagCategory(state, 'p1', 'Exercise')
    const catIds = Object.keys(state.lab!.tagCategoriesByProject!['p1'])
    const sleepId = catIds.find(id => state.lab!.tagCategoriesByProject!['p1'][id].name === 'Sleep')!

    const next = updateLabTagCategory(state, 'p1', sleepId, { name: 'Exercise' })
    // Should be unchanged — name already taken
    expect(next.lab!.tagCategoriesByProject!['p1'][sleepId].name).toBe('Sleep')
  })
})

describe('reorderLabTagCategories', () => {
  const proj = makeProject('p1', 'daily', dailyConfig)

  it('reorders categories and updates sortIndex', () => {
    let state = stateWithProject(proj)
    state = addLabTagCategory(state, 'p1', 'A')
    state = addLabTagCategory(state, 'p1', 'B')
    state = addLabTagCategory(state, 'p1', 'C')

    const order = state.lab!.tagCategoryOrderByProject!['p1']
    expect(order).toHaveLength(3)

    // Reverse order
    const reversed = [...order].reverse()
    const next = reorderLabTagCategories(state, 'p1', reversed)

    expect(next.lab!.tagCategoryOrderByProject!['p1']).toEqual(reversed)
    // sortIndex should match new position
    const cats = next.lab!.tagCategoriesByProject!['p1']
    for (let i = 0; i < reversed.length; i++) {
      expect(cats[reversed[i]].sortIndex).toBe(i)
    }
  })
})

// ─── updateLabProject validations ───────────────────────────────────

describe('updateLabProject validations', () => {
  it('rejects multi-choice config with empty option labels', () => {
    const proj = makeProject('mc1', 'daily-multi-choice', multiChoiceConfig)
    const state = stateWithProject(proj)

    const badConfig: LabDailyMultiChoiceProjectConfig = {
      ...multiChoiceConfig,
      options: [
        ...multiChoiceConfig.options,
        { id: 'opt5', label: '', createdAt: '2025-01-01T00:00:00Z' },
      ],
    }
    const next = updateLabProject(state, 'mc1', { config: badConfig })
    // Should be unchanged
    expect(next.lab!.projects['mc1'].config).toBe(multiChoiceConfig)
  })

  it('rejects multi-choice config with duplicate option labels', () => {
    const proj = makeProject('mc1', 'daily-multi-choice', multiChoiceConfig)
    const state = stateWithProject(proj)

    const badConfig: LabDailyMultiChoiceProjectConfig = {
      ...multiChoiceConfig,
      options: [
        { id: 'opt1', label: 'VEF', createdAt: '2025-01-01T00:00:00Z' },
        { id: 'opt2', label: 'vef', createdAt: '2025-01-01T00:00:00Z' }, // duplicate
      ],
    }
    const next = updateLabProject(state, 'mc1', { config: badConfig })
    expect(next.lab!.projects['mc1'].config).toBe(multiChoiceConfig)
  })

  it('allows archived options with duplicate labels', () => {
    const proj = makeProject('mc1', 'daily-multi-choice', multiChoiceConfig)
    const state = stateWithProject(proj)

    const config: LabDailyMultiChoiceProjectConfig = {
      ...multiChoiceConfig,
      options: [
        { id: 'opt1', label: 'VEF', createdAt: '2025-01-01T00:00:00Z' },
        { id: 'opt2', label: 'VEF', createdAt: '2025-01-01T00:00:00Z', archived: true }, // archived dup ok
        { id: 'opt3', label: 'Coding', createdAt: '2025-01-01T00:00:00Z' },
      ],
    }
    const next = updateLabProject(state, 'mc1', { config })
    expect(next.lab!.projects['mc1'].config).toEqual(config)
  })

  it('rejects daily config with duplicate additional outcome names', () => {
    const proj = makeProject('d1', 'daily', dailyConfig)
    const state = stateWithProject(proj)

    const badConfig: LabDailyProjectConfig = {
      ...dailyConfig,
      additionalOutcomes: [
        { id: 'outcome_2', name: 'Energy', scale: { min: 1, max: 10 } },
        { id: 'outcome_3', name: 'energy', scale: { min: 1, max: 10 } }, // duplicate
      ],
    }
    const next = updateLabProject(state, 'd1', { config: badConfig })
    expect(next.lab!.projects['d1'].config).toBe(dailyConfig)
  })
})

// ─── deleteLabProject cascades ──────────────────────────────────────

describe('deleteLabProject cascades', () => {
  it('cleans up multiChoiceLogsByProject', () => {
    const proj = makeProject('mc1', 'daily-multi-choice', multiChoiceConfig)
    let state = stateWithProject(proj)
    state = setLabMultiChoiceLog(state, 'mc1', '2025-01-15', {
      selectedOptionIds: ['opt1'],
    })
    expect(state.lab!.multiChoiceLogsByProject['mc1']).toBeDefined()

    const next = deleteLabProject(state, 'mc1')
    expect(next.lab!.multiChoiceLogsByProject['mc1']).toBeUndefined()
  })

  it('cleans up tagCategoriesByProject and tagCategoryOrderByProject', () => {
    const proj = makeProject('p1', 'daily', dailyConfig)
    let state = stateWithProject(proj)
    state = addLabTagCategory(state, 'p1', 'Category A')

    expect(state.lab!.tagCategoriesByProject?.['p1']).toBeDefined()
    expect(state.lab!.tagCategoryOrderByProject?.['p1']).toBeDefined()

    const next = deleteLabProject(state, 'p1')
    expect(next.lab!.tagCategoriesByProject?.['p1']).toBeUndefined()
    expect(next.lab!.tagCategoryOrderByProject?.['p1']).toBeUndefined()
  })

  it('cleans up absenceMarkersByProject', () => {
    const proj = makeProject('e1', 'event', {
      kind: 'event',
      event: { name: 'Headache' },
      completion: { requireAtLeastOneTag: false },
    })
    let state = stateWithProject(proj)
    // Manually insert an absence marker
    state = {
      ...state,
      lab: {
        ...state.lab!,
        absenceMarkersByProject: {
          e1: {
            '2025-01-15': {
              date: '2025-01-15',
              updatedAt: '2025-01-15T00:00:00Z',
              noEvent: true as const,
            },
          },
        },
      },
    }

    const next = deleteLabProject(state, 'e1')
    expect(next.lab!.absenceMarkersByProject?.['e1']).toBeUndefined()
  })
})

// ─── addLabProject initializes stores ───────────────────────────────

describe('addLabProject', () => {
  it('initializes multiChoiceLogsByProject for multi-choice projects', () => {
    const state = createTestState()
    const next = addLabProject(state, 'Test', 'daily-multi-choice', multiChoiceConfig)
    const newId = next.lab!.projectOrder[0]
    expect(next.lab!.multiChoiceLogsByProject[newId]).toEqual({})
  })

  it('does not initialize multiChoiceLogsByProject for daily projects', () => {
    const state = createTestState()
    const next = addLabProject(state, 'Test', 'daily', dailyConfig)
    const newId = next.lab!.projectOrder[0]
    // Should not have an entry (the spread just carries forward existing entries)
    expect(next.lab!.multiChoiceLogsByProject[newId]).toBeUndefined()
  })

  it('initializes dailyLogsByProject for tag-only projects', () => {
    const state = createTestState()
    const next = addLabProject(state, 'Test', 'daily-tag-only', tagOnlyConfig)
    const newId = next.lab!.projectOrder[0]
    expect(next.lab!.dailyLogsByProject[newId]).toEqual({})
  })
})
