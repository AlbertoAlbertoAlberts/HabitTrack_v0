import type { AppStateV1 } from '../../types'
import type { LabFinding } from './types'

// Bump this when analysis logic changes in a way that should force recomputation.
const ANALYSIS_FINGERPRINT_VERSION = 'lab-analysis-v4'

/**
 * Findings cache entry
 */
export interface FindingsCache {
  fingerprint: string
  findings: LabFinding[]
  computedAt: string // ISO timestamp
}

/**
 * Generate fingerprint for a project's data
 * Fingerprint changes when logs or tags change
 * 
 * Includes detailed content hashing to detect any data changes that affect analysis:
 * - Log outcomes, dates, and tag usage
 * - Tag definitions (including intensity settings)
 * - Project configuration
 */
export function generateFingerprint(state: AppStateV1, projectId: string): string {
  const project = state.lab?.projects[projectId]
  if (!project) return 'no-project'

  // Hash based on data that affects findings
  const parts: string[] = []

  // Analysis version (ensures caches are invalidated on logic changes)
  parts.push(ANALYSIS_FINGERPRINT_VERSION)

  // Project mode and config version
  parts.push(project.mode)
  parts.push(project.updatedAt) // Detect config changes

  // Logs with detailed content
  if (project.mode === 'daily') {
    const logs = state.lab?.dailyLogsByProject[projectId] || {}
    parts.push(`logs:${Object.keys(logs).length}`)
    
    // Include detailed log content hash (dates + outcomes + tag usage with intensity)
    const logHashes = Object.entries(logs)
      .map(([date, log]) => {
        const tagStr = log.tags
          .map((t) => `${t.tagId}${t.intensity !== undefined ? `:${t.intensity}` : ''}`)
          .sort()
          .join(',')
        return `${date}:${log.outcome ?? 'null'}:${tagStr}:${log.noTags ? 'noTags' : ''}`
      })
      .sort()
      .join('|')
    parts.push(logHashes)
  } else {
    const logs = state.lab?.eventLogsByProject[projectId] || {}
    parts.push(`logs:${Object.keys(logs).length}`)
    
    // Include event log content hash
    const logHashes = Object.values(logs)
      .map((log) => {
        const tagStr = log.tags
          .map((t) => `${t.tagId}${t.intensity !== undefined ? `:${t.intensity}` : ''}`)
          .sort()
          .join(',')
        return `${log.timestamp}:${log.severity ?? 'null'}:${tagStr}`
      })
      .sort()
      .join('|')
    parts.push(logHashes)
  }

  // Tags with intensity settings
  const tags = state.lab?.tagsByProject[projectId] || {}
  const tagHashes = Object.entries(tags)
    .map(([id, tag]) => {
      const intensityStr = tag.intensity?.enabled ? `i:${tag.intensity.min}-${tag.intensity.max}` : 'no-i'
      return `${id}:${tag.name}:${intensityStr}:${tag.updatedAt}`
    })
    .sort()
    .join('|')
  parts.push(`tags:${Object.keys(tags).length}:${tagHashes}`)

  return parts.join('::')
}

/**
 * Get cached findings if valid, otherwise null
 */
export function getCachedFindings(
  cache: Record<string, FindingsCache> | undefined,
  projectId: string,
  currentFingerprint: string
): LabFinding[] | null {
  if (!cache) return null

  const entry = cache[projectId]
  if (!entry) return null

  // Check if fingerprint matches
  if (entry.fingerprint !== currentFingerprint) return null

  return entry.findings
}

/**
 * Store findings in cache
 */
export function setCachedFindings(
  cache: Record<string, FindingsCache> | undefined,
  projectId: string,
  fingerprint: string,
  findings: LabFinding[]
): Record<string, FindingsCache> {
  const newCache = { ...cache }
  newCache[projectId] = {
    fingerprint,
    findings,
    computedAt: new Date().toISOString(),
  }
  return newCache
}
