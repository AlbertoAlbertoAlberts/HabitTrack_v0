import { describe, it, expect } from 'vitest'
import {
  presenceEffect,
  lagEffects,
  rollingAccumulation,
  doseResponse,
  regimeSummary,
  eventTagFrequency,
  eventGroupFrequency,
  eventTagSeverityEffect,
  eventGroupSeverityEffect,
  eventTagEpisodeDurationEffect,
  eventTagEpisodeMaxSeverityEffect,
  eventGroupEpisodeDurationEffect,
  eventGroupEpisodeMaxSeverityEffect,
  eventTagOccurrenceEffect,
  eventGroupOccurrenceEffect,
} from '../analysis/methods'
import type { DailyDataset, EventDataset } from '../analysis/datasetBuilders'

describe('presenceEffect', () => {
  it('returns empty findings when dataset is empty', () => {
    const dataset: DailyDataset = {
      rows: [],
      coverage: { totalLogs: 0, validRows: 0, skippedRows: 0 },
    }

    const findings = presenceEffect.run(dataset, 'proj1')

    expect(findings).toEqual([])
  })

  it('returns empty findings when insufficient data', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 5, tags: { tag1: { present: true } } },
        { date: '2025-01-02', outcome: 6, tags: { tag1: { present: false } } },
      ],
      coverage: { totalLogs: 2, validRows: 2, skippedRows: 0 },
    }

    const findings = presenceEffect.run(dataset, 'proj1')

    expect(findings).toEqual([])
  })

  it('detects positive effect when tag present correlates with higher outcome', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 8, tags: { tag1: { present: true } } },
        { date: '2025-01-02', outcome: 9, tags: { tag1: { present: true } } },
        { date: '2025-01-03', outcome: 8, tags: { tag1: { present: true } } },
        { date: '2025-01-04', outcome: 4, tags: { tag1: { present: false } } },
        { date: '2025-01-05', outcome: 5, tags: { tag1: { present: false } } },
        { date: '2025-01-06', outcome: 4, tags: { tag1: { present: false } } },
      ],
      coverage: { totalLogs: 6, validRows: 6, skippedRows: 0 },
    }

    const findings = presenceEffect.run(dataset, 'proj1')

    expect(findings).toHaveLength(1)
    expect(findings[0].effect).toBeGreaterThan(0)
    expect(findings[0].method).toBe('presence-effect')
    expect(findings[0].confidence).toBe('medium')
  })

  it('detects negative effect when tag present correlates with lower outcome', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 3, tags: { tag1: { present: true } } },
        { date: '2025-01-02', outcome: 4, tags: { tag1: { present: true } } },
        { date: '2025-01-03', outcome: 3, tags: { tag1: { present: true } } },
        { date: '2025-01-04', outcome: 8, tags: { tag1: { present: false } } },
        { date: '2025-01-05', outcome: 9, tags: { tag1: { present: false } } },
        { date: '2025-01-06', outcome: 8, tags: { tag1: { present: false } } },
      ],
      coverage: { totalLogs: 6, validRows: 6, skippedRows: 0 },
    }

    const findings = presenceEffect.run(dataset, 'proj1')

    expect(findings).toHaveLength(1)
    expect(findings[0].effect).toBeLessThan(0)
  })

  it('assigns high confidence when sample size >= 20', () => {
    const rows = []
    for (let i = 1; i <= 20; i++) {
      rows.push({
        date: `2025-01-${String(i).padStart(2, '0')}`,
        outcome: i % 2 === 0 ? 8 : 4,
        tags: { tag1: { present: i % 2 === 0 } },
      })
    }

    const dataset: DailyDataset = {
      rows,
      coverage: { totalLogs: 20, validRows: 20, skippedRows: 0 },
    }

    const findings = presenceEffect.run(dataset, 'proj1')

    expect(findings[0].confidence).toBe('high')
  })
})

describe('lagEffects', () => {
  it('returns empty findings when dataset is too small', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 5, tags: { tag1: { present: true } } },
        { date: '2025-01-02', outcome: 6, tags: { tag1: { present: false } } },
      ],
      coverage: { totalLogs: 2, validRows: 2, skippedRows: 0 },
    }

    const findings = lagEffects.run(dataset, 'proj1')

    expect(findings).toEqual([])
  })

  it('detects lag-1 effect', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 5, tags: { tag1: { present: false } } },
        { date: '2025-01-02', outcome: 8, tags: { tag1: { present: true } } }, // day after tag
        { date: '2025-01-03', outcome: 9, tags: { tag1: { present: true } } },
        { date: '2025-01-04', outcome: 8, tags: { tag1: { present: true } } },
        { date: '2025-01-05', outcome: 4, tags: { tag1: { present: false } } }, // day after no tag
        { date: '2025-01-06', outcome: 5, tags: { tag1: { present: false } } },
        { date: '2025-01-07', outcome: 4, tags: { tag1: { present: false } } },
      ],
      coverage: { totalLogs: 7, validRows: 7, skippedRows: 0 },
    }

    const findings = lagEffects.run(dataset, 'proj1')

    const lag1 = findings.find((f) => f.method === 'lag-1')
    expect(lag1).toBeDefined()
    expect(lag1!.effect).toBeGreaterThan(0)
  })

  it('tests multiple lag windows (lag-1, lag-2, lag-3)', () => {
    const rows = []
    for (let i = 1; i <= 15; i++) {
      rows.push({
        date: `2025-01-${String(i).padStart(2, '0')}`,
        outcome: i % 3 === 0 ? 8 : 5,
        tags: { tag1: { present: i % 3 === 0 } },
      })
    }

    const dataset: DailyDataset = {
      rows,
      coverage: { totalLogs: 15, validRows: 15, skippedRows: 0 },
    }

    const findings = lagEffects.run(dataset, 'proj1')

    const methods = findings.map((f) => f.method)
    expect(methods).toContain('lag-1')
    expect(methods).toContain('lag-2')
    expect(methods).toContain('lag-3')
  })
})

describe('eventTagFrequency', () => {
  it('computes per-tag presence rate across events', () => {
    const rows: EventDataset['rows'] = []
    for (let i = 0; i < 10; i++) {
      rows.push({
        timestamp: `2025-01-01T0${i}:00:00.000Z`,
        tags: {
          tag1: { present: i < 7 },
          tag2: { present: i === 0 },
        },
      })
    }

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: 10, validRows: 10, skippedRows: 0 },
    }

    const findings = eventTagFrequency.run(dataset, 'proj1')
    const byTag = Object.fromEntries(findings.map((f) => [f.tagId, f]))

    expect(byTag.tag1).toBeTruthy()
    expect(byTag.tag1.effect).toBe(0.7)
    expect(byTag.tag1.sampleSize).toBe(10)

    expect(byTag.tag2).toBeTruthy()
    expect(byTag.tag2.effect).toBe(0.1)
  })
})

describe('eventGroupFrequency', () => {
  it('computes group presence rate across events (group:<name> keys)', () => {
    const dataset: EventDataset = {
      rows: [
        { timestamp: '2025-01-01T00:00:00.000Z', tags: { 'group:health': { present: true } } },
        { timestamp: '2025-01-01T01:00:00.000Z', tags: { 'group:health': { present: true } } },
        { timestamp: '2025-01-01T02:00:00.000Z', tags: { 'group:health': { present: false } } },
        { timestamp: '2025-01-01T03:00:00.000Z', tags: { 'group:health': { present: true } } },
        { timestamp: '2025-01-01T04:00:00.000Z', tags: { 'group:work': { present: true } } },
      ],
      coverage: { totalLogs: 5, validRows: 5, skippedRows: 0 },
    }

    const findings = eventGroupFrequency.run(dataset, 'proj1')
    const byTag = Object.fromEntries(findings.map((f) => [f.tagId, f]))

    expect(byTag['group:health']).toBeTruthy()
    expect(byTag['group:health'].effect).toBe(0.6)
  })
})

describe('eventTagSeverityEffect', () => {
  it('computes mean severity difference when tag present vs absent', () => {
    const rows: EventDataset['rows'] = []
    for (let i = 0; i < 12; i++) {
      const present = i < 6
      rows.push({
        timestamp: `2025-01-01T${String(i).padStart(2, '0')}:00:00.000Z`,
        severity: present ? 8 : 4,
        tags: {
          tag1: { present },
        },
      })
    }

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: 12, validRows: 12, skippedRows: 0 },
    }

    const findings = eventTagSeverityEffect.run(dataset, 'proj1')
    expect(findings).toHaveLength(1)
    expect(findings[0].tagId).toBe('tag1')
    expect(findings[0].effect).toBeGreaterThan(0)
    expect(findings[0].method).toBe('event-tag-severity-effect')
  })
})

describe('eventGroupSeverityEffect', () => {
  it('computes mean severity difference for group keys', () => {
    const dataset: EventDataset = {
      rows: [
        { timestamp: '2025-01-01T00:00:00.000Z', severity: 7, tags: { 'group:health': { present: true } } },
        { timestamp: '2025-01-01T01:00:00.000Z', severity: 8, tags: { 'group:health': { present: true } } },
        { timestamp: '2025-01-01T02:00:00.000Z', severity: 9, tags: { 'group:health': { present: true } } },
        { timestamp: '2025-01-01T03:00:00.000Z', severity: 3, tags: { 'group:health': { present: false } } },
        { timestamp: '2025-01-01T04:00:00.000Z', severity: 4, tags: { 'group:health': { present: false } } },
        { timestamp: '2025-01-01T05:00:00.000Z', severity: 5, tags: { 'group:health': { present: false } } },
      ],
      coverage: { totalLogs: 6, validRows: 6, skippedRows: 0 },
    }

    const findings = eventGroupSeverityEffect.run(dataset, 'proj1')
    expect(findings).toHaveLength(1)
    expect(findings[0].tagId).toBe('group:health')
    expect(findings[0].effect).toBeGreaterThan(0)
    expect(findings[0].method).toBe('event-group-severity-effect')
  })
})

describe('eventTagEpisodeDurationEffect', () => {
  it('computes mean episode duration difference when tag appears in an episode', () => {
    const rows: EventDataset['rows'] = [
      // Episode 1 (duration 10h), tag1 present
      { timestamp: '2025-01-01T00:00:00.000Z', episodeId: 'ep-1', tags: { tag1: { present: true } } },
      { timestamp: '2025-01-01T10:00:00.000Z', episodeId: 'ep-1', tags: { tag1: { present: true } } },
      // Episode 2 (duration 0h), tag1 absent
      { timestamp: '2025-01-02T00:00:00.000Z', episodeId: 'ep-2', tags: { tag1: { present: false } } },
      // Episode 3 (duration 5h), tag1 present
      { timestamp: '2025-01-03T00:00:00.000Z', episodeId: 'ep-3', tags: { tag1: { present: true } } },
      { timestamp: '2025-01-03T05:00:00.000Z', episodeId: 'ep-3', tags: { tag1: { present: true } } },
      // Episode 4 (duration 0h), tag1 absent
      { timestamp: '2025-01-04T00:00:00.000Z', episodeId: 'ep-4', tags: { tag1: { present: false } } },
      // Episode 5 (duration 0h), tag1 absent
      { timestamp: '2025-01-05T00:00:00.000Z', episodeId: 'ep-5', tags: { tag1: { present: false } } },
      // Episode 6 (duration 2h), tag1 present
      { timestamp: '2025-01-06T00:00:00.000Z', episodeId: 'ep-6', tags: { tag1: { present: true } } },
      { timestamp: '2025-01-06T02:00:00.000Z', episodeId: 'ep-6', tags: { tag1: { present: true } } },
    ]

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: rows.length, validRows: rows.length, skippedRows: 0 },
    }

    const findings = eventTagEpisodeDurationEffect.run(dataset, 'proj1')
    expect(findings).toHaveLength(1)
    expect(findings[0].tagId).toBe('tag1')
    expect(findings[0].method).toBe('event-tag-episode-duration-effect')
    expect(findings[0].effect).toBeGreaterThan(0)
  })
})

describe('eventTagEpisodeMaxSeverityEffect', () => {
  it('computes mean max episode severity difference when tag appears in an episode', () => {
    const rows: EventDataset['rows'] = [
      // Episodes with tag1 present have higher max severity
      { timestamp: '2025-01-01T00:00:00.000Z', episodeId: 'ep-1', severity: 8, tags: { tag1: { present: true } } },
      { timestamp: '2025-01-01T01:00:00.000Z', episodeId: 'ep-1', severity: 9, tags: { tag1: { present: true } } },
      { timestamp: '2025-01-02T00:00:00.000Z', episodeId: 'ep-2', severity: 3, tags: { tag1: { present: false } } },
      { timestamp: '2025-01-03T00:00:00.000Z', episodeId: 'ep-3', severity: 8, tags: { tag1: { present: true } } },
      { timestamp: '2025-01-04T00:00:00.000Z', episodeId: 'ep-4', severity: 4, tags: { tag1: { present: false } } },
      { timestamp: '2025-01-05T00:00:00.000Z', episodeId: 'ep-5', severity: 2, tags: { tag1: { present: false } } },
      { timestamp: '2025-01-06T00:00:00.000Z', episodeId: 'ep-6', severity: 7, tags: { tag1: { present: true } } },
    ]

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: rows.length, validRows: rows.length, skippedRows: 0 },
    }

    const findings = eventTagEpisodeMaxSeverityEffect.run(dataset, 'proj1')
    expect(findings).toHaveLength(1)
    expect(findings[0].tagId).toBe('tag1')
    expect(findings[0].method).toBe('event-tag-episode-max-severity-effect')
    expect(findings[0].effect).toBeGreaterThan(0)
  })
})

describe('eventGroupEpisodeDurationEffect', () => {
  it('computes mean episode duration difference for group keys', () => {
    const rows: EventDataset['rows'] = [
      { timestamp: '2025-01-01T00:00:00.000Z', episodeId: 'ep-1', tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-01T10:00:00.000Z', episodeId: 'ep-1', tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-02T00:00:00.000Z', episodeId: 'ep-2', tags: { 'group:g': { present: false } } },
      { timestamp: '2025-01-03T00:00:00.000Z', episodeId: 'ep-3', tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-03T05:00:00.000Z', episodeId: 'ep-3', tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-04T00:00:00.000Z', episodeId: 'ep-4', tags: { 'group:g': { present: false } } },
      { timestamp: '2025-01-05T00:00:00.000Z', episodeId: 'ep-5', tags: { 'group:g': { present: false } } },
      { timestamp: '2025-01-06T00:00:00.000Z', episodeId: 'ep-6', tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-06T02:00:00.000Z', episodeId: 'ep-6', tags: { 'group:g': { present: true } } },
    ]

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: rows.length, validRows: rows.length, skippedRows: 0 },
    }

    const findings = eventGroupEpisodeDurationEffect.run(dataset, 'proj1')
    expect(findings).toHaveLength(1)
    expect(findings[0].tagId).toBe('group:g')
    expect(findings[0].method).toBe('event-group-episode-duration-effect')
    expect(findings[0].effect).toBeGreaterThan(0)
  })
})

describe('eventGroupEpisodeMaxSeverityEffect', () => {
  it('computes mean max episode severity difference for group keys', () => {
    const rows: EventDataset['rows'] = [
      { timestamp: '2025-01-01T00:00:00.000Z', episodeId: 'ep-1', severity: 8, tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-01T01:00:00.000Z', episodeId: 'ep-1', severity: 9, tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-02T00:00:00.000Z', episodeId: 'ep-2', severity: 3, tags: { 'group:g': { present: false } } },
      { timestamp: '2025-01-03T00:00:00.000Z', episodeId: 'ep-3', severity: 8, tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-04T00:00:00.000Z', episodeId: 'ep-4', severity: 4, tags: { 'group:g': { present: false } } },
      { timestamp: '2025-01-05T00:00:00.000Z', episodeId: 'ep-5', severity: 2, tags: { 'group:g': { present: false } } },
      { timestamp: '2025-01-06T00:00:00.000Z', episodeId: 'ep-6', severity: 7, tags: { 'group:g': { present: true } } },
    ]

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: rows.length, validRows: rows.length, skippedRows: 0 },
    }

    const findings = eventGroupEpisodeMaxSeverityEffect.run(dataset, 'proj1')
    expect(findings).toHaveLength(1)
    expect(findings[0].tagId).toBe('group:g')
    expect(findings[0].method).toBe('event-group-episode-max-severity-effect')
    expect(findings[0].effect).toBeGreaterThan(0)
  })
})

describe('eventTagOccurrenceEffect', () => {
  it('computes inferred event-day probability difference (day baseline filled with outcome=0)', () => {
    // Range: Jan 01 -> Jan 20 (20 days)
    // Tag present on 3 of the event days; there are non-event days in the range.
    const rows: EventDataset['rows'] = [
      { timestamp: '2025-01-01T10:00:00.000Z', tags: { tag1: { present: true } } },
      { timestamp: '2025-01-02T10:00:00.000Z', tags: { tag1: { present: false } } },
      { timestamp: '2025-01-04T10:00:00.000Z', tags: { tag1: { present: true } } },
      { timestamp: '2025-01-07T10:00:00.000Z', tags: { tag1: { present: false } } },
      { timestamp: '2025-01-20T10:00:00.000Z', tags: { tag1: { present: true } } },
    ]

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: rows.length, validRows: rows.length, skippedRows: 0 },
    }

    const findings = eventTagOccurrenceEffect.run(dataset, 'proj1')
    expect(findings).toHaveLength(1)
    expect(findings[0].tagId).toBe('tag1')
    expect(findings[0].method).toBe('event-tag-occurrence-effect')
    // With-tag days are always event days (outcome=1), without-tag days include non-event days -> effect should be positive.
    expect(findings[0].effect).toBeGreaterThan(0)
  })

  it('returns empty when every day is an event-day in the observed range', () => {
    const rows: EventDataset['rows'] = Array.from({ length: 20 }).map((_, i) => {
      const day = String(i + 1).padStart(2, '0')
      return {
        timestamp: `2025-01-${day}T10:00:00.000Z`,
        tags: { tag1: { present: i % 2 === 0 } },
      }
    })

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: rows.length, validRows: rows.length, skippedRows: 0 },
    }

    const findings = eventTagOccurrenceEffect.run(dataset, 'proj1')
    expect(findings).toEqual([])
  })
})

describe('eventGroupOccurrenceEffect', () => {
  it('computes inferred event-day probability difference for group keys', () => {
    const rows: EventDataset['rows'] = [
      { timestamp: '2025-01-01T10:00:00.000Z', tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-02T10:00:00.000Z', tags: { 'group:g': { present: false } } },
      { timestamp: '2025-01-04T10:00:00.000Z', tags: { 'group:g': { present: true } } },
      { timestamp: '2025-01-07T10:00:00.000Z', tags: { 'group:g': { present: false } } },
      { timestamp: '2025-01-20T10:00:00.000Z', tags: { 'group:g': { present: true } } },
    ]

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: rows.length, validRows: rows.length, skippedRows: 0 },
    }

    const findings = eventGroupOccurrenceEffect.run(dataset, 'proj1')
    expect(findings).toHaveLength(1)
    expect(findings[0].tagId).toBe('group:g')
    expect(findings[0].method).toBe('event-group-occurrence-effect')
    expect(findings[0].effect).toBeGreaterThan(0)
  })

  it('returns empty when every day is an event-day in the observed range', () => {
    const rows: EventDataset['rows'] = Array.from({ length: 20 }).map((_, i) => {
      const day = String(i + 1).padStart(2, '0')
      return {
        timestamp: `2025-01-${day}T10:00:00.000Z`,
        tags: { 'group:g': { present: i % 2 === 0 } },
      }
    })

    const dataset: EventDataset = {
      rows,
      coverage: { totalLogs: rows.length, validRows: rows.length, skippedRows: 0 },
    }

    const findings = eventGroupOccurrenceEffect.run(dataset, 'proj1')
    expect(findings).toEqual([])
  })
})

describe('rollingAccumulation', () => {
  it('returns empty findings when dataset is too small', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 5, tags: { tag1: { present: true } } },
      ],
      coverage: { totalLogs: 1, validRows: 1, skippedRows: 0 },
    }

    const findings = rollingAccumulation.run(dataset, 'proj1')

    expect(findings).toEqual([])
  })

  it('detects rolling 3-day and 7-day accumulation effects', () => {
    const rows = []
    for (let i = 1; i <= 20; i++) {
      rows.push({
        date: `2025-01-${String(i).padStart(2, '0')}`,
        outcome: i % 4 === 0 ? 9 : 5,
        tags: { tag1: { present: i % 4 === 0 || i % 4 === 1 } },
      })
    }

    const dataset: DailyDataset = {
      rows,
      coverage: { totalLogs: 20, validRows: 20, skippedRows: 0 },
    }

    const findings = rollingAccumulation.run(dataset, 'proj1')

    const methods = findings.map((f) => f.method)
    expect(methods).toContain('rolling-3d')
    expect(methods).toContain('rolling-7d')
  })

  it('assigns medium confidence when sample size >= 20', () => {
    const rows = []
    for (let i = 1; i <= 25; i++) {
      rows.push({
        date: `2025-01-${String(i).padStart(2, '0')}`,
        outcome: 5 + Math.random() * 3,
        tags: { tag1: { present: i % 2 === 0 } },
      })
    }

    const dataset: DailyDataset = {
      rows,
      coverage: { totalLogs: 25, validRows: 25, skippedRows: 0 },
    }

    const findings = rollingAccumulation.run(dataset, 'proj1')

    const rolling3 = findings.find((f) => f.method === 'rolling-3d')
    if (rolling3) {
      expect(rolling3.confidence).toBe('medium')
    }
  })
})

describe('doseResponse', () => {
  it('returns empty findings when no intensity data', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 5, tags: { tag1: { present: true } } },
        { date: '2025-01-02', outcome: 6, tags: { tag1: { present: true } } },
      ],
      coverage: { totalLogs: 2, validRows: 2, skippedRows: 0 },
    }

    const findings = doseResponse.run(dataset, 'proj1')

    expect(findings).toEqual([])
  })

  it('detects dose-response relationship with intensity', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 4, tags: { tag1: { present: true, intensity: 1 } } },
        { date: '2025-01-02', outcome: 4, tags: { tag1: { present: true, intensity: 2 } } },
        { date: '2025-01-03', outcome: 5, tags: { tag1: { present: true, intensity: 3 } } },
        { date: '2025-01-04', outcome: 6, tags: { tag1: { present: true, intensity: 5 } } },
        { date: '2025-01-05', outcome: 8, tags: { tag1: { present: true, intensity: 8 } } },
        { date: '2025-01-06', outcome: 9, tags: { tag1: { present: true, intensity: 10 } } },
      ],
      coverage: { totalLogs: 6, validRows: 6, skippedRows: 0 },
    }

    const findings = doseResponse.run(dataset, 'proj1')

    expect(findings).toHaveLength(1)
    expect(findings[0].method).toBe('dose-response')
    expect(findings[0].effect).toBeGreaterThan(0)
  })

  it('requires minimum of 6 intensity data points', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 4, tags: { tag1: { present: true, intensity: 1 } } },
        { date: '2025-01-02', outcome: 5, tags: { tag1: { present: true, intensity: 5 } } },
        { date: '2025-01-03', outcome: 8, tags: { tag1: { present: true, intensity: 10 } } },
      ],
      coverage: { totalLogs: 3, validRows: 3, skippedRows: 0 },
    }

    const findings = doseResponse.run(dataset, 'proj1')

    expect(findings).toEqual([])
  })
})

describe('regimeSummary', () => {
  it('returns empty findings when dataset is too small', () => {
    const dataset: DailyDataset = {
      rows: [
        { date: '2025-01-01', outcome: 5, tags: { tag1: { present: true } } },
      ],
      coverage: { totalLogs: 1, validRows: 1, skippedRows: 0 },
    }

    const findings = regimeSummary.run(dataset, 'proj1')

    expect(findings).toEqual([])
  })

  it('detects tags more common on high outcome days', () => {
    const rows = []
    // Low outcome days: tag1 absent
    for (let i = 1; i <= 5; i++) {
      rows.push({
        date: `2025-01-${String(i).padStart(2, '0')}`,
        outcome: 3,
        tags: { tag1: { present: false } },
      })
    }
    // High outcome days: tag1 present
    for (let i = 6; i <= 10; i++) {
      rows.push({
        date: `2025-01-${String(i).padStart(2, '0')}`,
        outcome: 9,
        tags: { tag1: { present: true } },
      })
    }

    const dataset: DailyDataset = {
      rows,
      coverage: { totalLogs: 10, validRows: 10, skippedRows: 0 },
    }

    const findings = regimeSummary.run(dataset, 'proj1')

    expect(findings).toHaveLength(1)
    expect(findings[0].method).toBe('regime-summary')
    expect(findings[0].effect).toBeGreaterThan(0)
  })

  it('filters out small differences (< 15%)', () => {
    const rows = []
    // Create data where difference is exactly 10% (below the 15% threshold)
    // Bottom 25%: outcomes 1-5, top 25%: outcomes 16-20
    for (let i = 1; i <= 20; i++) {
      let isTagPresent = false
      if (i <= 5) isTagPresent = i <= 2 // 2/5 = 40% in bottom quarter
      else if (i >= 16) isTagPresent = i <= 17 // 2/5 = 40% in top quarter (no difference)
      else isTagPresent = i % 2 === 0 // Random for middle

      rows.push({
        date: `2025-01-${String(i).padStart(2, '0')}`,
        outcome: i,
        tags: { tag1: { present: isTagPresent } },
      })
    }

    const dataset: DailyDataset = {
      rows,
      coverage: { totalLogs: 20, validRows: 20, skippedRows: 0 },
    }

    const findings = regimeSummary.run(dataset, 'proj1')

    // Should not detect effect since difference is 0%
    expect(findings).toEqual([])
  })
})
