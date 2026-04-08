import { describe, it, expect } from 'vitest'
import { createTestState } from './testHelpers'
import { tagFrequency, tagCoOccurrence, buildTagDotTableData } from '../analysis/tagOnlyMethods'
import { choiceFrequency, buildChoiceGridData } from '../analysis/multiChoiceMethods'
import { crossOutcomeCorrelation, perOutcomeTagCorrelation } from '../analysis/multiOutcomeMethods'
import {
  buildTagOnlyDataset,
  buildMultiChoiceDataset,
  buildDailyDataset,
  buildDailyDatasetForOutcome,
} from '../analysis/datasetBuilders'
import { generateFingerprint } from '../analysis/cache'
import { runAnalysisForProject } from '../analysis/runner'
import type { LabProject, LabDailyLog, LabMultiChoiceLog } from '../../types'

// ── Helpers ─────────────────────────────────────────────────

const ts = '2025-01-01T00:00:00.000Z'

function makeDailyProject(id: string, overrides: Partial<LabProject> = {}): LabProject {
  return {
    id,
    name: 'Daily Test',
    mode: 'daily',
    createdAt: ts,
    updatedAt: ts,
    config: {
      kind: 'daily',
      outcome: { id: 'outcome', name: 'Quality', scale: { min: 1, max: 10 }, required: true },
      alignment: { exposureWindow: 'sameDay' },
      completion: { requireOutcome: true, requireAtLeastOneTag: false },
    },
    ...overrides,
  }
}

function makeTagOnlyProject(id: string): LabProject {
  return {
    id,
    name: 'Tag Only Test',
    mode: 'daily-tag-only',
    createdAt: ts,
    updatedAt: ts,
    config: {
      kind: 'daily-tag-only',
      tagsEnabled: true as const,
      completion: { requireAtLeastOneTag: false },
    },
  }
}

function makeMultiChoiceProject(id: string): LabProject {
  return {
    id,
    name: 'Multi-Choice Test',
    mode: 'daily-multi-choice',
    createdAt: ts,
    updatedAt: ts,
    config: {
      kind: 'daily-multi-choice',
      selectionMode: 'multiple',
      options: [
        { id: 'opt-a', label: 'VEF', createdAt: ts },
        { id: 'opt-b', label: 'Coding', createdAt: ts },
        { id: 'opt-c', label: 'Day-off', createdAt: ts },
      ],
      completion: { requireAtLeastOneChoice: true },
    },
  }
}

function makeTagOnlyLogs(days: number, tagPattern: (day: number) => string[]): Record<string, LabDailyLog> {
  const logs: Record<string, LabDailyLog> = {}
  for (let i = 0; i < days; i++) {
    const date = `2025-01-${String(i + 1).padStart(2, '0')}`
    const tagIds = tagPattern(i)
    logs[date] = {
      date,
      updatedAt: ts,
      tags: tagIds.map((id) => ({ tagId: id })),
    }
  }
  return logs
}

function makeMultiChoiceLogs(days: number, pattern: (day: number) => string[]): Record<string, LabMultiChoiceLog> {
  const logs: Record<string, LabMultiChoiceLog> = {}
  for (let i = 0; i < days; i++) {
    const date = `2025-01-${String(i + 1).padStart(2, '0')}`
    logs[date] = {
      date,
      updatedAt: ts,
      selectedOptionIds: pattern(i),
    }
  }
  return logs
}

// ── Tag-only methods ────────────────────────────────────────

describe('Tag-only analysis methods', () => {
  describe('T1: tagFrequency', () => {
    it('calculates correct rates for 10 days, 3 tags', () => {
      // tagA: present on 8/10 days, tagB: 5/10, tagC: 2/10
      const state = createTestState({
        projects: { p1: makeTagOnlyProject('p1') },
        projectOrder: ['p1'],
        tagsByProject: {
          p1: {
            tagA: { id: 'tagA', name: 'Sleep', createdAt: ts, updatedAt: ts },
            tagB: { id: 'tagB', name: 'Exercise', createdAt: ts, updatedAt: ts },
            tagC: { id: 'tagC', name: 'Coffee', createdAt: ts, updatedAt: ts },
          },
        },
        dailyLogsByProject: {
          p1: makeTagOnlyLogs(10, (day) => {
            const tags: string[] = []
            if (day < 8) tags.push('tagA')   // 8/10
            if (day % 2 === 0) tags.push('tagB') // 5/10 (0,2,4,6,8)
            if (day < 2) tags.push('tagC')   // 2/10
            return tags
          }),
        },
      })

      const dataset = buildTagOnlyDataset(state, 'p1')
      expect(dataset.rows.length).toBe(10)

      const findings = tagFrequency(dataset, 'p1')
      expect(findings.length).toBe(3)

      const findA = findings.find((f) => f.tagId === 'tagA')!
      expect(findA.effect).toBe(0.8) // 8/10
      expect(findA.sampleSize).toBe(10)
      expect(findA.method).toBe('tag-frequency')

      const findB = findings.find((f) => f.tagId === 'tagB')!
      expect(findB.effect).toBe(0.5) // 5/10

      const findC = findings.find((f) => f.tagId === 'tagC')!
      expect(findC.effect).toBe(0.2) // 2/10
    })

    it('returns empty for zero rows', () => {
      const dataset = { rows: [], coverage: { totalLogs: 0, validRows: 0, skippedRows: 0 } }
      expect(tagFrequency(dataset, 'p1')).toEqual([])
    })
  })

  describe('T2: tagCoOccurrence', () => {
    it('finds co-occurring pairs with correct Jaccard', () => {
      // tagA+tagB always together (10/10), tagC alone (separate 5 days)
      const state = createTestState({
        projects: { p1: makeTagOnlyProject('p1') },
        projectOrder: ['p1'],
        tagsByProject: {
          p1: {
            tagA: { id: 'tagA', name: 'A', createdAt: ts, updatedAt: ts },
            tagB: { id: 'tagB', name: 'B', createdAt: ts, updatedAt: ts },
            tagC: { id: 'tagC', name: 'C', createdAt: ts, updatedAt: ts },
          },
        },
        dailyLogsByProject: {
          p1: makeTagOnlyLogs(15, (day) => {
            if (day < 10) return ['tagA', 'tagB'] // A+B together for 10 days
            return ['tagC']                        // C alone for 5 days
          }),
        },
      })

      const dataset = buildTagOnlyDataset(state, 'p1')
      const findings = tagCoOccurrence(dataset, 'p1')

      // A+B: co-occur 10/10 days where either is present → Jaccard = 10/10 = 1.0
      const abPair = findings.find((f) =>
        f.tagId.includes('tagA') && f.tagId.includes('tagB')
      )
      expect(abPair).toBeDefined()
      expect(abPair!.effect).toBe(1) // Jaccard = 1.0

      // A+C or B+C: never co-occur → should not appear
      const acPair = findings.find((f) =>
        f.tagId.includes('tagA') && f.tagId.includes('tagC')
      )
      expect(acPair).toBeUndefined()
    })

    it('returns empty with < 5 rows', () => {
      const dataset = {
        rows: [
          { date: '2025-01-01', tags: { a: true } },
          { date: '2025-01-02', tags: { a: true } },
        ],
        coverage: { totalLogs: 2, validRows: 2, skippedRows: 0 },
      }
      expect(tagCoOccurrence(dataset, 'p1')).toEqual([])
    })

    it('returns empty when no tag has ≥5 occurrences', () => {
      // 10 rows but each tag only appears once
      const state = createTestState({
        projects: { p1: makeTagOnlyProject('p1') },
        projectOrder: ['p1'],
        tagsByProject: {
          p1: {
            tagA: { id: 'tagA', name: 'A', createdAt: ts, updatedAt: ts },
            tagB: { id: 'tagB', name: 'B', createdAt: ts, updatedAt: ts },
          },
        },
        dailyLogsByProject: {
          p1: makeTagOnlyLogs(10, (day) => {
            if (day === 0) return ['tagA']
            if (day === 1) return ['tagB']
            return []
          }),
        },
      })

      const dataset = buildTagOnlyDataset(state, 'p1')
      expect(tagCoOccurrence(dataset, 'p1')).toEqual([])
    })
  })

  describe('T3: buildTagDotTableData', () => {
    it('returns presence map for selected tags', () => {
      const state = createTestState({
        projects: { p1: makeTagOnlyProject('p1') },
        projectOrder: ['p1'],
        tagsByProject: {
          p1: {
            tagA: { id: 'tagA', name: 'A', createdAt: ts, updatedAt: ts },
          },
        },
        dailyLogsByProject: {
          p1: makeTagOnlyLogs(5, (day) => (day % 2 === 0 ? ['tagA'] : [])),
        },
      })

      const dataset = buildTagOnlyDataset(state, 'p1')
      const result = buildTagDotTableData(dataset, ['tagA'], '2025-01-01', 5)

      expect(result.tagA).toBeDefined()
      expect(result.tagA['2025-01-01']).toBe(true)
      expect(result.tagA['2025-01-02']).toBe(false)
      expect(result.tagA['2025-01-03']).toBe(true)
    })

    it('limits to 5 tags', () => {
      const dataset = {
        rows: [{ date: '2025-01-01', tags: { a: true, b: true, c: true, d: true, e: true, f: true } }],
        coverage: { totalLogs: 1, validRows: 1, skippedRows: 0 },
      }
      const result = buildTagDotTableData(dataset, ['a', 'b', 'c', 'd', 'e', 'f'], '2025-01-01', 1)
      expect(Object.keys(result).length).toBe(5)
    })
  })
})

// ── Multi-choice methods ────────────────────────────────────

describe('Multi-choice analysis methods', () => {
  describe('MC1: choiceFrequency', () => {
    it('calculates correct rates for options', () => {
      // 10 days: opt-a selected 7/10, opt-b 4/10, opt-c 1/10
      const state = createTestState({
        projects: { p1: makeMultiChoiceProject('p1') },
        projectOrder: ['p1'],
        multiChoiceLogsByProject: {
          p1: makeMultiChoiceLogs(10, (day) => {
            const opts: string[] = []
            if (day < 7) opts.push('opt-a')
            if (day >= 3 && day < 7) opts.push('opt-b') // 4 days
            if (day === 9) opts.push('opt-c')
            return opts
          }),
        },
      })

      const dataset = buildMultiChoiceDataset(state, 'p1')
      expect(dataset.rows.length).toBe(10)

      const findings = choiceFrequency(dataset, 'p1')

      const findA = findings.find((f) => f.tagId === 'option:opt-a')!
      expect(findA.effect).toBe(0.7) // 7/10

      const findB = findings.find((f) => f.tagId === 'option:opt-b')!
      expect(findB.effect).toBe(0.4) // 4/10

      const findC = findings.find((f) => f.tagId === 'option:opt-c')!
      expect(findC.effect).toBe(0.1) // 1/10
    })

    it('returns empty for zero rows', () => {
      const dataset = { rows: [], coverage: { totalLogs: 0, validRows: 0, skippedRows: 0 } }
      expect(choiceFrequency(dataset, 'p1')).toEqual([])
    })
  })

  describe('MC2: buildChoiceGridData', () => {
    it('returns selection map for options', () => {
      const state = createTestState({
        projects: { p1: makeMultiChoiceProject('p1') },
        projectOrder: ['p1'],
        multiChoiceLogsByProject: {
          p1: makeMultiChoiceLogs(3, (day) => (day === 0 ? ['opt-a', 'opt-b'] : ['opt-b'])),
        },
      })

      const dataset = buildMultiChoiceDataset(state, 'p1')
      const result = buildChoiceGridData(dataset, ['opt-a', 'opt-b'], '2025-01-01', 3)

      expect(result['opt-a']['2025-01-01']).toBe(true)
      expect(result['opt-a']['2025-01-02']).toBe(false)
      expect(result['opt-b']['2025-01-01']).toBe(true)
      expect(result['opt-b']['2025-01-02']).toBe(true)
    })
  })
})

// ── Multi-outcome methods ───────────────────────────────────

describe('Multi-outcome analysis methods', () => {
  describe('MO1: crossOutcomeCorrelation', () => {
    it('finds strong positive correlation for perfectly correlated data', () => {
      // Primary = i, Additional = i (perfect correlation)
      const logs: Record<string, LabDailyLog> = {}
      for (let i = 0; i < 15; i++) {
        const date = `2025-01-${String(i + 1).padStart(2, '0')}`
        logs[date] = {
          date,
          updatedAt: ts,
          outcome: i + 1,
          additionalOutcomes: { out2: i + 1 },
          tags: [],
        }
      }

      const project = makeDailyProject('p1', {
        config: {
          kind: 'daily',
          outcome: { id: 'outcome', name: 'Quality', scale: { min: 1, max: 15 }, required: true },
          additionalOutcomes: [{ id: 'out2', name: 'Energy' }],
          alignment: { exposureWindow: 'sameDay' },
          completion: { requireOutcome: true, requireAtLeastOneTag: false },
        },
      })

      const state = createTestState({
        projects: { p1: project },
        projectOrder: ['p1'],
        tagsByProject: { p1: {} },
        dailyLogsByProject: { p1: logs },
      })

      const primaryDataset = buildDailyDataset(state, 'p1')
      const out2Dataset = buildDailyDatasetForOutcome(state, 'p1', 'out2')

      const findings = crossOutcomeCorrelation('p1', ['out2'], { out2: out2Dataset }, primaryDataset)
      expect(findings.length).toBe(1)
      expect(findings[0].method).toBe('cross-outcome-correlation')
      expect(findings[0].effect).toBeCloseTo(1, 2) // r ≈ 1
      expect(findings[0].sampleSize).toBe(15)
    })

    it('finds negative correlation for inversely related data', () => {
      const logs: Record<string, LabDailyLog> = {}
      for (let i = 0; i < 12; i++) {
        const date = `2025-01-${String(i + 1).padStart(2, '0')}`
        logs[date] = {
          date,
          updatedAt: ts,
          outcome: i + 1,
          additionalOutcomes: { out2: 13 - i }, // inverse
          tags: [],
        }
      }

      const project = makeDailyProject('p1', {
        config: {
          kind: 'daily',
          outcome: { id: 'outcome', name: 'Quality', scale: { min: 1, max: 15 }, required: true },
          additionalOutcomes: [{ id: 'out2', name: 'Energy' }],
          alignment: { exposureWindow: 'sameDay' },
          completion: { requireOutcome: true, requireAtLeastOneTag: false },
        },
      })

      const state = createTestState({
        projects: { p1: project },
        projectOrder: ['p1'],
        tagsByProject: { p1: {} },
        dailyLogsByProject: { p1: logs },
      })

      const primaryDataset = buildDailyDataset(state, 'p1')
      const out2Dataset = buildDailyDatasetForOutcome(state, 'p1', 'out2')

      const findings = crossOutcomeCorrelation('p1', ['out2'], { out2: out2Dataset }, primaryDataset)
      expect(findings.length).toBe(1)
      expect(findings[0].effect).toBeCloseTo(-1, 2) // r ≈ -1
    })

    it('requires ≥10 overlapping days', () => {
      const logs: Record<string, LabDailyLog> = {}
      for (let i = 0; i < 9; i++) {
        const date = `2025-01-${String(i + 1).padStart(2, '0')}`
        logs[date] = {
          date,
          updatedAt: ts,
          outcome: i + 1,
          additionalOutcomes: { out2: i + 1 },
          tags: [],
        }
      }

      const project = makeDailyProject('p1', {
        config: {
          kind: 'daily',
          outcome: { id: 'outcome', name: 'Quality', scale: { min: 1, max: 10 }, required: true },
          additionalOutcomes: [{ id: 'out2', name: 'Energy' }],
          alignment: { exposureWindow: 'sameDay' },
          completion: { requireOutcome: true, requireAtLeastOneTag: false },
        },
      })

      const state = createTestState({
        projects: { p1: project },
        projectOrder: ['p1'],
        tagsByProject: { p1: {} },
        dailyLogsByProject: { p1: logs },
      })

      const primaryDataset = buildDailyDataset(state, 'p1')
      const out2Dataset = buildDailyDatasetForOutcome(state, 'p1', 'out2')

      const findings = crossOutcomeCorrelation('p1', ['out2'], { out2: out2Dataset }, primaryDataset)
      expect(findings.length).toBe(0) // < 10 days
    })
  })

  describe('MO2: perOutcomeTagCorrelation', () => {
    it('runs existing daily methods for each additional outcome', () => {
      // 20 days: tagA present on days 0-9, absent 10-19
      // out2 outcome: 8 when tagA present, 3 when absent → clear presence-effect
      const logs: Record<string, LabDailyLog> = {}
      for (let i = 0; i < 20; i++) {
        const date = `2025-01-${String(i + 1).padStart(2, '0')}`
        logs[date] = {
          date,
          updatedAt: ts,
          outcome: 5,
          additionalOutcomes: { out2: i < 10 ? 8 : 3 },
          tags: i < 10 ? [{ tagId: 'tagA' }] : [],
        }
      }

      const project = makeDailyProject('p1', {
        config: {
          kind: 'daily',
          outcome: { id: 'outcome', name: 'Quality', scale: { min: 1, max: 10 }, required: true },
          additionalOutcomes: [{ id: 'out2', name: 'Energy' }],
          alignment: { exposureWindow: 'sameDay' },
          completion: { requireOutcome: false, requireAtLeastOneTag: false },
        },
      })

      const state = createTestState({
        projects: { p1: project },
        projectOrder: ['p1'],
        tagsByProject: {
          p1: { tagA: { id: 'tagA', name: 'Sleep', createdAt: ts, updatedAt: ts } },
        },
        dailyLogsByProject: { p1: logs },
      })

      const out2Dataset = buildDailyDatasetForOutcome(state, 'p1', 'out2')
      const findings = perOutcomeTagCorrelation('out2', out2Dataset, 'p1')

      // Should have findings with prefixed method names
      expect(findings.length).toBeGreaterThan(0)

      const presenceFind = findings.find((f) => f.method === 'out2::presence-effect')
      expect(presenceFind).toBeDefined()
      expect(presenceFind!.effect).toBeGreaterThan(0) // tagA → higher out2
      expect(presenceFind!.tagId).toBe('tagA')
    })

    it('returns empty for < 5 rows', () => {
      const dataset = { rows: [], coverage: { totalLogs: 0, validRows: 0, skippedRows: 0 } }
      expect(perOutcomeTagCorrelation('out2', dataset, 'p1')).toEqual([])
    })
  })
})

// ── Dataset builders ────────────────────────────────────────

describe('New dataset builders', () => {
  it('buildTagOnlyDataset returns correct structure', () => {
    const state = createTestState({
      projects: { p1: makeTagOnlyProject('p1') },
      projectOrder: ['p1'],
      tagsByProject: {
        p1: {
          tagA: { id: 'tagA', name: 'A', createdAt: ts, updatedAt: ts },
          tagB: { id: 'tagB', name: 'B', createdAt: ts, updatedAt: ts },
        },
      },
      dailyLogsByProject: {
        p1: makeTagOnlyLogs(3, (day) => (day === 0 ? ['tagA'] : ['tagB'])),
      },
    })

    const dataset = buildTagOnlyDataset(state, 'p1')
    expect(dataset.rows.length).toBe(3)
    expect(dataset.rows[0].tags.tagA).toBe(true)
    expect(dataset.rows[0].tags.tagB).toBe(false)
    expect(dataset.rows[1].tags.tagA).toBe(false)
    expect(dataset.rows[1].tags.tagB).toBe(true)
  })

  it('buildTagOnlyDataset rejects non-tag-only projects', () => {
    const state = createTestState({
      projects: { p1: makeDailyProject('p1') },
      projectOrder: ['p1'],
    })
    const dataset = buildTagOnlyDataset(state, 'p1')
    expect(dataset.rows.length).toBe(0)
  })

  it('buildMultiChoiceDataset returns correct structure', () => {
    const state = createTestState({
      projects: { p1: makeMultiChoiceProject('p1') },
      projectOrder: ['p1'],
      multiChoiceLogsByProject: {
        p1: makeMultiChoiceLogs(3, (day) => (day === 0 ? ['opt-a', 'opt-b'] : ['opt-c'])),
      },
    })

    const dataset = buildMultiChoiceDataset(state, 'p1')
    expect(dataset.rows.length).toBe(3)
    expect(dataset.rows[0].selectedOptionIds).toEqual(['opt-a', 'opt-b'])
    expect(dataset.rows[1].selectedOptionIds).toEqual(['opt-c'])
  })

  it('buildMultiChoiceDataset rejects non-multi-choice projects', () => {
    const state = createTestState({
      projects: { p1: makeDailyProject('p1') },
      projectOrder: ['p1'],
    })
    const dataset = buildMultiChoiceDataset(state, 'p1')
    expect(dataset.rows.length).toBe(0)
  })

  it('buildDailyDatasetForOutcome uses additional outcome as row.outcome', () => {
    const logs: Record<string, LabDailyLog> = {}
    for (let i = 0; i < 5; i++) {
      const date = `2025-01-${String(i + 1).padStart(2, '0')}`
      logs[date] = {
        date,
        updatedAt: ts,
        outcome: 5,
        additionalOutcomes: { out2: i + 1 },
        tags: [],
      }
    }

    const project = makeDailyProject('p1', {
      config: {
        kind: 'daily',
        outcome: { id: 'outcome', name: 'Quality', scale: { min: 1, max: 10 }, required: true },
        additionalOutcomes: [{ id: 'out2', name: 'Energy' }],
        alignment: { exposureWindow: 'sameDay' },
        completion: { requireOutcome: true, requireAtLeastOneTag: false },
      },
    })

    const state = createTestState({
      projects: { p1: project },
      projectOrder: ['p1'],
      tagsByProject: { p1: {} },
      dailyLogsByProject: { p1: logs },
    })

    const dataset = buildDailyDatasetForOutcome(state, 'p1', 'out2')
    expect(dataset.rows.length).toBe(5)
    expect(dataset.rows[0].outcome).toBe(1) // First day's additionalOutcomes.out2
    expect(dataset.rows[4].outcome).toBe(5) // Last day's additionalOutcomes.out2
  })

  it('buildDailyDatasetForOutcome skips days missing the outcome', () => {
    const logs: Record<string, LabDailyLog> = {
      '2025-01-01': { date: '2025-01-01', updatedAt: ts, outcome: 5, additionalOutcomes: { out2: 7 }, tags: [] },
      '2025-01-02': { date: '2025-01-02', updatedAt: ts, outcome: 5, tags: [] }, // no additionalOutcomes
      '2025-01-03': { date: '2025-01-03', updatedAt: ts, outcome: 5, additionalOutcomes: { out2: 3 }, tags: [] },
    }

    const project = makeDailyProject('p1', {
      config: {
        kind: 'daily',
        outcome: { id: 'outcome', name: 'Quality', scale: { min: 1, max: 10 }, required: true },
        additionalOutcomes: [{ id: 'out2', name: 'Energy' }],
        alignment: { exposureWindow: 'sameDay' },
        completion: { requireOutcome: true, requireAtLeastOneTag: false },
      },
    })

    const state = createTestState({
      projects: { p1: project },
      projectOrder: ['p1'],
      tagsByProject: { p1: {} },
      dailyLogsByProject: { p1: logs },
    })

    const dataset = buildDailyDatasetForOutcome(state, 'p1', 'out2')
    expect(dataset.rows.length).toBe(2)
    expect(dataset.coverage.skippedRows).toBe(1)
  })
})

// ── Runner integration ──────────────────────────────────────

describe('Runner dispatches to new methods', () => {
  it('runs tag-only analysis for daily-tag-only projects', () => {
    const state = createTestState({
      projects: { p1: makeTagOnlyProject('p1') },
      projectOrder: ['p1'],
      tagsByProject: {
        p1: {
          tagA: { id: 'tagA', name: 'A', createdAt: ts, updatedAt: ts },
          tagB: { id: 'tagB', name: 'B', createdAt: ts, updatedAt: ts },
        },
      },
      dailyLogsByProject: {
        p1: makeTagOnlyLogs(10, (day) => {
          if (day < 7) return ['tagA', 'tagB']
          return ['tagA']
        }),
      },
    })

    const result = runAnalysisForProject(state, 'p1')
    expect(result.cacheHit).toBe(false)
    expect(result.findings.length).toBeGreaterThan(0)

    // Should have tag-frequency findings
    const freqFindings = result.findings.filter((f) => f.method === 'tag-frequency')
    expect(freqFindings.length).toBeGreaterThan(0)
  })

  it('runs multi-choice analysis for daily-multi-choice projects', () => {
    const state = createTestState({
      projects: { p1: makeMultiChoiceProject('p1') },
      projectOrder: ['p1'],
      multiChoiceLogsByProject: {
        p1: makeMultiChoiceLogs(10, (day) =>
          day < 7 ? ['opt-a'] : ['opt-b']
        ),
      },
    })

    const result = runAnalysisForProject(state, 'p1')
    expect(result.cacheHit).toBe(false)
    expect(result.findings.length).toBeGreaterThan(0)

    const choiceFindings = result.findings.filter((f) => f.method === 'choice-frequency')
    expect(choiceFindings.length).toBeGreaterThan(0)
  })

  it('existing daily project with no additional outcomes is unchanged', () => {
    const logs: Record<string, LabDailyLog> = {}
    for (let i = 0; i < 20; i++) {
      const date = `2025-01-${String(i + 1).padStart(2, '0')}`
      logs[date] = {
        date,
        updatedAt: ts,
        outcome: i % 2 === 0 ? 8 : 3,
        tags: i < 10 ? [{ tagId: 'tagA' }] : [],
      }
    }

    const state = createTestState({
      projects: { p1: makeDailyProject('p1') },
      projectOrder: ['p1'],
      tagsByProject: {
        p1: { tagA: { id: 'tagA', name: 'Sleep', createdAt: ts, updatedAt: ts } },
      },
      dailyLogsByProject: { p1: logs },
    })

    const result = runAnalysisForProject(state, 'p1')
    expect(result.findings.length).toBeGreaterThan(0)

    // Should NOT have any cross-outcome or per-outcome prefixed methods
    const crossOutcome = result.findings.filter((f) => f.method === 'cross-outcome-correlation')
    expect(crossOutcome.length).toBe(0)

    const perOutcome = result.findings.filter((f) => f.method.includes('::'))
    expect(perOutcome.length).toBe(0)
  })

  it('respects minimum data threshold for tag-only projects', () => {
    const state = createTestState({
      projects: { p1: makeTagOnlyProject('p1') },
      projectOrder: ['p1'],
      tagsByProject: {
        p1: { tagA: { id: 'tagA', name: 'A', createdAt: ts, updatedAt: ts } },
      },
      dailyLogsByProject: {
        p1: makeTagOnlyLogs(3, () => ['tagA']), // < 5 minimum
      },
    })

    const result = runAnalysisForProject(state, 'p1')
    expect(result.findings).toEqual([])
  })

  it('respects minimum data threshold for multi-choice projects', () => {
    const state = createTestState({
      projects: { p1: makeMultiChoiceProject('p1') },
      projectOrder: ['p1'],
      multiChoiceLogsByProject: {
        p1: makeMultiChoiceLogs(4, () => ['opt-a']), // < 5 minimum
      },
    })

    const result = runAnalysisForProject(state, 'p1')
    expect(result.findings).toEqual([])
  })
})

// ── Cache fingerprint ───────────────────────────────────────

describe('Cache fingerprint for new types', () => {
  it('changes when multi-choice log changes', () => {
    const state1 = createTestState({
      projects: { p1: makeMultiChoiceProject('p1') },
      projectOrder: ['p1'],
      multiChoiceLogsByProject: {
        p1: { '2025-01-01': { date: '2025-01-01', updatedAt: ts, selectedOptionIds: ['opt-a'] } },
      },
    })

    const state2 = createTestState({
      projects: { p1: makeMultiChoiceProject('p1') },
      projectOrder: ['p1'],
      multiChoiceLogsByProject: {
        p1: { '2025-01-01': { date: '2025-01-01', updatedAt: ts, selectedOptionIds: ['opt-b'] } }, // changed
      },
    })

    const fp1 = generateFingerprint(state1, 'p1')
    const fp2 = generateFingerprint(state2, 'p1')
    expect(fp1).not.toBe(fp2)
  })

  it('changes when additionalOutcomes change on daily logs', () => {
    const makeDailyState = (addOut: number) => createTestState({
      projects: { p1: makeDailyProject('p1') },
      projectOrder: ['p1'],
      tagsByProject: { p1: {} },
      dailyLogsByProject: {
        p1: {
          '2025-01-01': {
            date: '2025-01-01',
            updatedAt: ts,
            outcome: 5,
            additionalOutcomes: { out2: addOut },
            tags: [],
          },
        },
      },
    })

    const fp1 = generateFingerprint(makeDailyState(7), 'p1')
    const fp2 = generateFingerprint(makeDailyState(3), 'p1')
    expect(fp1).not.toBe(fp2)
  })

  it('includes tag-only daily logs in fingerprint', () => {
    const state1 = createTestState({
      projects: { p1: makeTagOnlyProject('p1') },
      projectOrder: ['p1'],
      tagsByProject: { p1: { tagA: { id: 'tagA', name: 'A', createdAt: ts, updatedAt: ts } } },
      dailyLogsByProject: {
        p1: { '2025-01-01': { date: '2025-01-01', updatedAt: ts, tags: [{ tagId: 'tagA' }] } },
      },
    })

    const state2 = createTestState({
      projects: { p1: makeTagOnlyProject('p1') },
      projectOrder: ['p1'],
      tagsByProject: { p1: { tagA: { id: 'tagA', name: 'A', createdAt: ts, updatedAt: ts } } },
      dailyLogsByProject: {
        p1: { '2025-01-01': { date: '2025-01-01', updatedAt: ts, tags: [] } }, // tag removed
      },
    })

    const fp1 = generateFingerprint(state1, 'p1')
    const fp2 = generateFingerprint(state2, 'p1')
    expect(fp1).not.toBe(fp2)
  })
})
