import { describe, it, expect } from 'vitest'
import {
  buildDailyDataset,
  buildEventDataset,
  buildEventGroupDataset,
  buildEventDailySummary,
  buildEventEpisodeSummary,
  buildEventOccurrenceDailyDataset,
} from '../analysis/datasetBuilders'
import { createTestState } from './testHelpers'

describe('buildDailyDataset', () => {
  it('returns empty dataset when project does not exist', () => {
    const state = createTestState({
      projects: {},
    })

    const result = buildDailyDataset(state, 'nonexistent')

    expect(result.rows).toEqual([])
    expect(result.coverage).toEqual({
      totalLogs: 0,
      validRows: 0,
      skippedRows: 0,
    })
  })

  it('returns empty dataset when project is event mode', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Test',
          mode: 'event',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'event',
            event: { name: 'Headache' },
            completion: { requireAtLeastOneTag: false },
          },
        },
      },
      projectOrder: ['proj1'],
    })

    const result = buildDailyDataset(state, 'proj1')

    expect(result.rows).toEqual([])
  })

  it('builds complete dataset with all tags initialized', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Sleep Quality',
          mode: 'daily',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'daily',
            outcome: {
              id: 'outcome',
              name: 'Quality',
              scale: { min: 1, max: 10 },
              required: true,
            },
            alignment: { exposureWindow: 'sameDay' },
            completion: {
              requireOutcome: true,
              requireAtLeastOneTag: false,
            },
          },
        },
      },
      projectOrder: ['proj1'],
      tagsByProject: {
        proj1: {
          tag1: {
            id: 'tag1',
            name: 'Coffee',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          tag2: {
            id: 'tag2',
            name: 'Exercise',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            intensity: {
              enabled: true,
              min: 0,
              max: 10,
            },
          },
        },
      },
      dailyLogsByProject: {
        proj1: {
          '2025-01-15': {
            date: '2025-01-15',
            updatedAt: '2025-01-15T20:00:00.000Z',
            outcome: 8,
            tags: [{ tagId: 'tag1' }],
          },
          '2025-01-16': {
            date: '2025-01-16',
            updatedAt: '2025-01-16T20:00:00.000Z',
            outcome: 6,
            tags: [{ tagId: 'tag2', intensity: 5 }],
          },
        },
      },
    })

    const result = buildDailyDataset(state, 'proj1')

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({
      date: '2025-01-15',
      outcome: 8,
      tags: {
        tag1: { present: true },
        tag2: { present: false },
      },
    })
    expect(result.rows[1]).toEqual({
      date: '2025-01-16',
      outcome: 6,
      tags: {
        tag1: { present: false },
        tag2: { present: true, intensity: 5 },
      },
    })
    expect(result.coverage).toEqual({
      totalLogs: 2,
      validRows: 2,
      skippedRows: 0,
    })
  })

  it('skips incomplete logs when requireOutcome is true', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Test',
          mode: 'daily',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'daily',
            outcome: {
              id: 'outcome',
              name: 'Quality',
              scale: { min: 1, max: 10 },
              required: true,
            },
            alignment: { exposureWindow: 'sameDay' },
            completion: {
              requireOutcome: true,
              requireAtLeastOneTag: false,
            },
          },
        },
      },
      projectOrder: ['proj1'],
      tagsByProject: {
        proj1: {
          tag1: {
            id: 'tag1',
            name: 'Coffee',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      },
      dailyLogsByProject: {
        proj1: {
          '2025-01-15': {
            date: '2025-01-15',
            updatedAt: '2025-01-15T20:00:00.000Z',
            outcome: 8,
            tags: [],
          },
          '2025-01-16': {
            date: '2025-01-16',
            updatedAt: '2025-01-16T20:00:00.000Z',
            tags: [],
          },
          '2025-01-17': {
            date: '2025-01-17',
            updatedAt: '2025-01-17T20:00:00.000Z',
            outcome: 7,
            tags: [],
          },
        },
      },
    })

    const result = buildDailyDataset(state, 'proj1')

    expect(result.rows).toHaveLength(2)
    expect(result.coverage).toEqual({
      totalLogs: 3,
      validRows: 2,
      skippedRows: 1,
    })
  })

  it('sorts rows by date ascending', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Test',
          mode: 'daily',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'daily',
            outcome: {
              id: 'outcome',
              name: 'Quality',
              scale: { min: 1, max: 10 },
              required: true,
            },
            alignment: { exposureWindow: 'sameDay' },
            completion: {
              requireOutcome: true,
              requireAtLeastOneTag: false,
            },
          },
        },
      },
      projectOrder: ['proj1'],
      tagsByProject: {
        proj1: {
          tag1: {
            id: 'tag1',
            name: 'Coffee',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      },
      dailyLogsByProject: {
        proj1: {
          '2025-01-20': {
            date: '2025-01-20',
            updatedAt: '2025-01-20T20:00:00.000Z',
            outcome: 9,
            tags: [],
          },
          '2025-01-15': {
            date: '2025-01-15',
            updatedAt: '2025-01-15T20:00:00.000Z',
            outcome: 7,
            tags: [],
          },
          '2025-01-18': {
            date: '2025-01-18',
            updatedAt: '2025-01-18T20:00:00.000Z',
            outcome: 8,
            tags: [],
          },
        },
      },
    })

    const result = buildDailyDataset(state, 'proj1')

    expect(result.rows.map((r) => r.date)).toEqual(['2025-01-15', '2025-01-18', '2025-01-20'])
  })
})

describe('buildEventDataset', () => {
  it('returns empty dataset when project does not exist', () => {
    const state = createTestState({
      projects: {},
    })

    const result = buildEventDataset(state, 'nonexistent')

    expect(result.rows).toEqual([])
    expect(result.coverage).toEqual({
      totalLogs: 0,
      validRows: 0,
      skippedRows: 0,
    })
  })

  it('returns empty dataset when project is daily mode', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Test',
          mode: 'daily',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'daily',
            outcome: {
              id: 'outcome',
              name: 'Quality',
              scale: { min: 1, max: 10 },
              required: true,
            },
            alignment: { exposureWindow: 'sameDay' },
            completion: {
              requireOutcome: true,
              requireAtLeastOneTag: false,
            },
          },
        },
      },
      projectOrder: ['proj1'],
    })

    const result = buildEventDataset(state, 'proj1')

    expect(result.rows).toEqual([])
  })

  it('builds complete event dataset with all tags', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Headaches',
          mode: 'event',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'event',
            event: { name: 'Headache' },
            completion: { requireAtLeastOneTag: false },
          },
        },
      },
      projectOrder: ['proj1'],
      tagsByProject: {
        proj1: {
          tag1: {
            id: 'tag1',
            name: 'Stress',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            intensity: {
              enabled: true,
              min: 1,
              max: 10,
            },
          },
          tag2: {
            id: 'tag2',
            name: 'Caffeine',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      },
      eventLogsByProject: {
        proj1: {
          log1: {
            id: 'log1',
            timestamp: '2025-01-15T14:30:00.000Z',
            createdAt: '2025-01-15T14:30:00.000Z',
            updatedAt: '2025-01-15T14:30:00.000Z',
            severity: 7,
            tags: [{ tagId: 'tag1', intensity: 8 }],
          },
          log2: {
            id: 'log2',
            timestamp: '2025-01-16T10:00:00.000Z',
            createdAt: '2025-01-16T10:00:00.000Z',
            updatedAt: '2025-01-16T10:00:00.000Z',
            tags: [{ tagId: 'tag2' }],
            note: 'After coffee',
          },
        },
      },
    })

    const result = buildEventDataset(state, 'proj1')

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({
      timestamp: '2025-01-15T14:30:00.000Z',
      severity: 7,
      episodeId: 'ep-1',
      episodeIndexWithinStreak: 1,
      streakLength: 1,
      tags: {
        tag1: { present: true, intensity: 8 },
        tag2: { present: false },
      },
    })
    expect(result.rows[1]).toEqual({
      timestamp: '2025-01-16T10:00:00.000Z',
      episodeId: 'ep-2',
      episodeIndexWithinStreak: 1,
      streakLength: 1,
      tags: {
        tag1: { present: false },
        tag2: { present: true },
      },
      note: 'After coffee',
    })
  })

  it('sorts event logs by timestamp ascending', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Test',
          mode: 'event',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'event',
            event: { name: 'Event' },
            completion: { requireAtLeastOneTag: false },
          },
        },
      },
      projectOrder: ['proj1'],
      eventLogsByProject: {
        proj1: {
          log1: {
            id: 'log1',
            timestamp: '2025-01-15T20:00:00.000Z',
            createdAt: '2025-01-15T20:00:00.000Z',
            updatedAt: '2025-01-15T20:00:00.000Z',
            tags: [],
          },
          log2: {
            id: 'log2',
            timestamp: '2025-01-15T10:00:00.000Z',
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T10:00:00.000Z',
            tags: [],
          },
          log3: {
            id: 'log3',
            timestamp: '2025-01-15T15:00:00.000Z',
            createdAt: '2025-01-15T15:00:00.000Z',
            updatedAt: '2025-01-15T15:00:00.000Z',
            tags: [],
          },
        },
      },
    })

    const result = buildEventDataset(state, 'proj1')

    expect(result.rows.map((r) => r.timestamp)).toEqual([
      '2025-01-15T10:00:00.000Z',
      '2025-01-15T15:00:00.000Z',
      '2025-01-15T20:00:00.000Z',
    ])
  })

  it('derives episode fields using 12h threshold', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Test',
          mode: 'event',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'event',
            event: { name: 'Event' },
            completion: { requireAtLeastOneTag: false },
          },
        },
      },
      projectOrder: ['proj1'],
      eventLogsByProject: {
        proj1: {
          // Episode 1: 10:00 and 21:59 (gap < 12h)
          a: {
            id: 'a',
            timestamp: '2025-01-15T10:00:00.000Z',
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T10:00:00.000Z',
            tags: [],
          },
          b: {
            id: 'b',
            timestamp: '2025-01-15T21:59:00.000Z',
            createdAt: '2025-01-15T21:59:00.000Z',
            updatedAt: '2025-01-15T21:59:00.000Z',
            tags: [],
          },
          // Episode 2: next day 11:59 (gap > 12h from 21:59)
          c: {
            id: 'c',
            timestamp: '2025-01-16T11:59:00.000Z',
            createdAt: '2025-01-16T11:59:00.000Z',
            updatedAt: '2025-01-16T11:59:00.000Z',
            tags: [],
          },
        },
      },
    })

    const result = buildEventDataset(state, 'proj1')
    expect(result.rows).toHaveLength(3)

    expect(result.rows[0].episodeId).toBe('ep-1')
    expect(result.rows[0].episodeIndexWithinStreak).toBe(1)
    expect(result.rows[0].streakLength).toBe(2)

    expect(result.rows[1].episodeId).toBe('ep-1')
    expect(result.rows[1].episodeIndexWithinStreak).toBe(2)
    expect(result.rows[1].streakLength).toBe(2)

    expect(result.rows[2].episodeId).toBe('ep-2')
    expect(result.rows[2].episodeIndexWithinStreak).toBe(1)
    expect(result.rows[2].streakLength).toBe(1)
  })
})

describe('buildEventGroupDataset', () => {
  it('projects tag presence into group presence (virtual group keys)', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Headaches',
          mode: 'event',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'event',
            event: { name: 'Headache' },
            completion: { requireAtLeastOneTag: false },
          },
        },
      },
      projectOrder: ['proj1'],
      tagsByProject: {
        proj1: {
          tag1: {
            id: 'tag1',
            name: 'Coffee',
            group: 'FOOD',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          tag2: {
            id: 'tag2',
            name: 'Stress',
            group: 'CONTEXT',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          tag3: {
            id: 'tag3',
            name: 'No group',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      },
      eventLogsByProject: {
        proj1: {
          a: {
            id: 'a',
            timestamp: '2025-01-15T10:00:00.000Z',
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T10:00:00.000Z',
            tags: [{ tagId: 'tag1' }, { tagId: 'tag3' }],
          },
          b: {
            id: 'b',
            timestamp: '2025-01-16T10:00:00.000Z',
            createdAt: '2025-01-16T10:00:00.000Z',
            updatedAt: '2025-01-16T10:00:00.000Z',
            tags: [{ tagId: 'tag2' }],
          },
        },
      },
    })

    const result = buildEventGroupDataset(state, 'proj1')
    expect(result.rows).toHaveLength(2)

    expect(result.groupKeyToName).toEqual({
      'group:FOOD': 'FOOD',
      'group:CONTEXT': 'CONTEXT',
    })

    expect(result.rows[0].tags).toEqual({
      'group:FOOD': { present: true },
      'group:CONTEXT': { present: false },
    })

    expect(result.rows[1].tags).toEqual({
      'group:FOOD': { present: false },
      'group:CONTEXT': { present: true },
    })
  })
})

describe('buildEventDailySummary', () => {
  it('buckets by local date and aggregates severity', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Test',
          mode: 'event',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'event',
            event: { name: 'Event' },
            completion: { requireAtLeastOneTag: false },
          },
        },
      },
      projectOrder: ['proj1'],
      eventLogsByProject: {
        proj1: {
          a: {
            id: 'a',
            timestamp: '2025-01-15T10:00:00.000Z',
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T10:00:00.000Z',
            severity: 3,
            tags: [],
          },
          b: {
            id: 'b',
            timestamp: '2025-01-15T18:00:00.000Z',
            createdAt: '2025-01-15T18:00:00.000Z',
            updatedAt: '2025-01-15T18:00:00.000Z',
            severity: 7,
            tags: [],
          },
          c: {
            id: 'c',
            timestamp: '2025-01-16T10:00:00.000Z',
            createdAt: '2025-01-16T10:00:00.000Z',
            updatedAt: '2025-01-16T10:00:00.000Z',
            tags: [],
          },
        },
      },
    })

    const result = buildEventDailySummary(state, 'proj1')

    expect(result).toEqual([
      {
        date: '2025-01-15',
        count: 2,
        severityCount: 2,
        maxSeverity: 7,
        avgSeverity: 5,
      },
      {
        date: '2025-01-16',
        count: 1,
        severityCount: 0,
        maxSeverity: undefined,
        avgSeverity: undefined,
      },
    ])
  })
})

describe('buildEventEpisodeSummary', () => {
  it('summarizes episodes, severity, and gaps', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Test',
          mode: 'event',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'event',
            event: { name: 'Event' },
            completion: { requireAtLeastOneTag: false },
          },
        },
      },
      projectOrder: ['proj1'],
      eventLogsByProject: {
        proj1: {
          // Episode 1: 10:00 and 21:00 (gap < 12h)
          a: {
            id: 'a',
            timestamp: '2025-01-15T10:00:00.000Z',
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T10:00:00.000Z',
            severity: 4,
            tags: [],
          },
          b: {
            id: 'b',
            timestamp: '2025-01-15T21:00:00.000Z',
            createdAt: '2025-01-15T21:00:00.000Z',
            updatedAt: '2025-01-15T21:00:00.000Z',
            severity: 6,
            tags: [],
          },
          // Episode 2: next day 12:30 (gap > 12h from 21:00)
          c: {
            id: 'c',
            timestamp: '2025-01-16T12:30:00.000Z',
            createdAt: '2025-01-16T12:30:00.000Z',
            updatedAt: '2025-01-16T12:30:00.000Z',
            tags: [],
          },
        },
      },
    })

    const result = buildEventEpisodeSummary(state, 'proj1')
    expect(result).toHaveLength(2)

    expect(result[0]).toMatchObject({
      episodeId: 'ep-1',
      startTimestamp: '2025-01-15T10:00:00.000Z',
      endTimestamp: '2025-01-15T21:00:00.000Z',
      eventCount: 2,
      durationHours: 11,
      severityCount: 2,
      maxSeverity: 6,
    })
    expect(result[0].avgSeverity).toBeCloseTo(5, 6)
    expect(result[0].gapSincePrevEpisodeHours).toBeUndefined()

    expect(result[1]).toMatchObject({
      episodeId: 'ep-2',
      startTimestamp: '2025-01-16T12:30:00.000Z',
      endTimestamp: '2025-01-16T12:30:00.000Z',
      eventCount: 1,
      durationHours: 0,
      gapSincePrevEpisodeHours: 15.5,
      severityCount: 0,
      maxSeverity: undefined,
      avgSeverity: undefined,
    })
  })
})

describe('buildEventOccurrenceDailyDataset', () => {
  it('fills missing days with outcome=0 and derives tag presence from event days', () => {
    const state = createTestState({
      projects: {
        proj1: {
          id: 'proj1',
          name: 'Test',
          mode: 'event',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          config: {
            kind: 'event',
            event: { name: 'Event' },
            completion: { requireAtLeastOneTag: false },
          },
        },
      },
      projectOrder: ['proj1'],
      tagsByProject: {
        proj1: {
          tag1: {
            id: 'tag1',
            name: 'T1',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        },
      },
      eventLogsByProject: {
        proj1: {
          a: {
            id: 'a',
            timestamp: '2025-01-01T10:00:00.000Z',
            createdAt: '2025-01-01T10:00:00.000Z',
            updatedAt: '2025-01-01T10:00:00.000Z',
            tags: [{ tagId: 'tag1' }],
          },
          b: {
            id: 'b',
            timestamp: '2025-01-03T10:00:00.000Z',
            createdAt: '2025-01-03T10:00:00.000Z',
            updatedAt: '2025-01-03T10:00:00.000Z',
            tags: [],
          },
        },
      },
    })

    const dataset = buildEventOccurrenceDailyDataset(state, 'proj1')
    expect(dataset.rows.map((r) => r.date)).toEqual(['2025-01-01', '2025-01-02', '2025-01-03'])
    expect(dataset.rows.map((r) => r.outcome)).toEqual([1, 0, 1])
    expect(dataset.rows[0].tags.tag1.present).toBe(true)
    expect(dataset.rows[1].tags.tag1.present).toBe(false)
    expect(dataset.rows[2].tags.tag1.present).toBe(false)
  })
})
