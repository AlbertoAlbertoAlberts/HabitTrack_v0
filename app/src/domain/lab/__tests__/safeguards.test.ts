import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateFingerprint, getCachedFindings } from '../analysis/cache'
import { runAnalysisForProject } from '../analysis/runner'
import { createTestState } from './testHelpers'

describe('Cache Safeguards', () => {
  describe('generateFingerprint', () => {
    it('generates different fingerprints when log outcomes change', () => {
      const state1 = createTestState({
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
        tagsByProject: { proj1: {} },
        dailyLogsByProject: {
          proj1: {
            '2025-01-15': {
              date: '2025-01-15',
              updatedAt: '2025-01-15T20:00:00.000Z',
              outcome: 8,
              tags: [],
            },
          },
        },
      })

      const state2 = createTestState({
        projects: state1.lab!.projects,
        projectOrder: state1.lab!.projectOrder,
        tagsByProject: state1.lab!.tagsByProject,
        dailyLogsByProject: {
          proj1: {
            '2025-01-15': {
              date: '2025-01-15',
              updatedAt: '2025-01-15T20:00:00.000Z',
              outcome: 9, // Different outcome
              tags: [],
            },
          },
        },
      })

      const fp1 = generateFingerprint(state1, 'proj1')
      const fp2 = generateFingerprint(state2, 'proj1')

      expect(fp1).not.toBe(fp2)
    })

    it('generates different fingerprints when tags are added', () => {
      const state1 = createTestState({
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
        tagsByProject: { proj1: {} },
        dailyLogsByProject: {
          proj1: {
            '2025-01-15': {
              date: '2025-01-15',
              updatedAt: '2025-01-15T20:00:00.000Z',
              outcome: 8,
              tags: [],
            },
          },
        },
      })

      const state2 = createTestState({
        projects: state1.lab!.projects,
        projectOrder: state1.lab!.projectOrder,
        tagsByProject: {
          proj1: {
            tag1: {
              id: 'tag1',
              name: 'Coffee',
              createdAt: '2025-01-15T00:00:00.000Z',
              updatedAt: '2025-01-15T00:00:00.000Z',
            },
          },
        },
        dailyLogsByProject: state1.lab!.dailyLogsByProject,
      })

      const fp1 = generateFingerprint(state1, 'proj1')
      const fp2 = generateFingerprint(state2, 'proj1')

      expect(fp1).not.toBe(fp2)
    })

    it('generates different fingerprints when tag intensity is added to log', () => {
      const state1 = createTestState({
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
              createdAt: '2025-01-15T00:00:00.000Z',
              updatedAt: '2025-01-15T00:00:00.000Z',
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
              tags: [{ tagId: 'tag1' }], // No intensity
            },
          },
        },
      })

      const state2 = createTestState({
        projects: state1.lab!.projects,
        projectOrder: state1.lab!.projectOrder,
        tagsByProject: state1.lab!.tagsByProject,
        dailyLogsByProject: {
          proj1: {
            '2025-01-15': {
              date: '2025-01-15',
              updatedAt: '2025-01-15T20:00:00.000Z',
              outcome: 8,
              tags: [{ tagId: 'tag1', intensity: 5 }], // With intensity
            },
          },
        },
      })

      const fp1 = generateFingerprint(state1, 'proj1')
      const fp2 = generateFingerprint(state2, 'proj1')

      expect(fp1).not.toBe(fp2)
    })

    it('generates same fingerprint for unchanged data', () => {
      const state1 = createTestState({
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
        tagsByProject: { proj1: {} },
        dailyLogsByProject: {
          proj1: {
            '2025-01-15': {
              date: '2025-01-15',
              updatedAt: '2025-01-15T20:00:00.000Z',
              outcome: 8,
              tags: [],
            },
          },
        },
      })

      // Create independent copy with same data
      const state2 = createTestState({
        projects: state1.lab!.projects,
        projectOrder: state1.lab!.projectOrder,
        tagsByProject: state1.lab!.tagsByProject,
        dailyLogsByProject: state1.lab!.dailyLogsByProject,
      })

      const fp1 = generateFingerprint(state1, 'proj1')
      const fp2 = generateFingerprint(state2, 'proj1')

      expect(fp1).toBe(fp2)
    })
  })

  describe('Cache hit/miss behavior', () => {
    it('returns cached findings when fingerprint matches', () => {
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
        findingsCache: {
          proj1: {
            fingerprint: 'test-fp',
            findings: [
              {
                projectId: 'proj1',
                tagId: 'tag1',
                method: 'presence-effect',
                effect: 2.5,
                confidence: 'high',
                sampleSize: 20,
                summary: 'Test finding',
              },
            ],
            computedAt: new Date().toISOString(),
          },
        },
      })

      const cached = getCachedFindings(state.lab?.findingsCache, 'proj1', 'test-fp')

      expect(cached).toHaveLength(1)
      expect(cached![0].effect).toBe(2.5)
    })

    it('returns null when fingerprint does not match', () => {
      const state = createTestState({
        findingsCache: {
          proj1: {
            fingerprint: 'old-fp',
            findings: [],
            computedAt: new Date().toISOString(),
          },
        },
      })

      const cached = getCachedFindings(state.lab?.findingsCache, 'proj1', 'new-fp')

      expect(cached).toBeNull()
    })
  })

  describe('Throttling safeguard', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('prevents recomputation within 1 second', () => {
      // Create state with enough data for analysis
      const baseState = createTestState({
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
            '2025-01-01': {
              date: '2025-01-01',
              updatedAt: '2025-01-01T20:00:00.000Z',
              outcome: 8,
              tags: [{ tagId: 'tag1' }],
            },
            '2025-01-02': {
              date: '2025-01-02',
              updatedAt: '2025-01-02T20:00:00.000Z',
              outcome: 9,
              tags: [{ tagId: 'tag1' }],
            },
            '2025-01-03': {
              date: '2025-01-03',
              updatedAt: '2025-01-03T20:00:00.000Z',
              outcome: 8,
              tags: [{ tagId: 'tag1' }],
            },
            '2025-01-04': {
              date: '2025-01-04',
              updatedAt: '2025-01-04T20:00:00.000Z',
              outcome: 4,
              tags: [],
            },
            '2025-01-05': {
              date: '2025-01-05',
              updatedAt: '2025-01-05T20:00:00.000Z',
              outcome: 5,
              tags: [],
            },
            '2025-01-06': {
              date: '2025-01-06',
              updatedAt: '2025-01-06T20:00:00.000Z',
              outcome: 4,
              tags: [],
            },
          },
        },
      })

      // First run - should compute
      const result1 = runAnalysisForProject(baseState, 'proj1')
      expect(result1.cacheHit).toBe(false)
      expect(result1.updatedCache).toBeDefined()

      // Create state with updated cache
      const stateWithCache = createTestState({
        ...baseState.lab!,
        findingsCache: result1.updatedCache,
      })

      // Immediate second run (< 1 second) - should return stale cache
      const result2 = runAnalysisForProject(stateWithCache, 'proj1')
      expect(result2.cacheHit).toBe(true)
      expect(result2.updatedCache).toBeUndefined()

      // Advance time past throttle window
      vi.advanceTimersByTime(1100)

      // Third run (> 1 second) - should allow recompute if needed
      const result3 = runAnalysisForProject(stateWithCache, 'proj1')
      // Since fingerprint hasn't changed, should still use cache
      expect(result3.cacheHit).toBe(true)
    })
  })
})
