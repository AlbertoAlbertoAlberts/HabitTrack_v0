import type { AppStateV1 } from '../../types'
import { buildDailyDataset, buildEventDataset, buildEventGroupDataset } from './datasetBuilders'
import { v1AllMethods } from './methods'
import type { LabFinding } from './types'
import { generateFingerprint, getCachedFindings, setCachedFindings, type FindingsCache } from './cache'

/**
 * Analysis result with updated cache
 */
export interface AnalysisResult {
  findings: LabFinding[]
  updatedCache?: Record<string, FindingsCache>
  cacheHit: boolean
}

/**
 * Minimum time between recomputations for the same project (milliseconds)
 * Prevents computation storms from rapid successive calls
 */
const MIN_RECOMPUTE_INTERVAL_MS = 1000 // 1 second

/**
 * Check if enough time has passed since last computation
 */
function canRecompute(
  cache: Record<string, FindingsCache> | undefined,
  projectId: string
): boolean {
  if (!cache) return true

  const entry = cache[projectId]
  if (!entry) return true

  const lastComputed = new Date(entry.computedAt).getTime()
  const now = Date.now()
  const elapsed = now - lastComputed

  return elapsed >= MIN_RECOMPUTE_INTERVAL_MS
}

/**
 * Apply guardrails to filter out unreliable findings
 */
function applyGuardrails(findings: LabFinding[], minSampleSize: number = 6): LabFinding[] {
  return findings.filter((finding) => {
    // Minimum sample size
    if (finding.sampleSize < minSampleSize) return false

    // Filter very small effects (likely noise)
    // Frequency-style findings use an effect in [0..1] (rate). Small rates can still be useful.
    const isFrequency = finding.method === 'event-tag-frequency' || finding.method === 'event-group-frequency'
    const isOccurrence = finding.method === 'event-tag-occurrence-effect' || finding.method === 'event-group-occurrence-effect'
    if (!isFrequency && !isOccurrence && Math.abs(finding.effect) < 0.1) return false

    return true
  })
}

/**
 * Identify rare tags that should be excluded from analysis
 */
function getRareTagIds(state: AppStateV1, projectId: string): Set<string> {
  const project = state.lab?.projects[projectId]
  if (!project || project.mode !== 'daily') return new Set()

  const logs = state.lab?.dailyLogsByProject[projectId] || {}
  const totalLogs = Object.keys(logs).length
  
  if (totalLogs < 10) return new Set()

  const projectTags = state.lab?.tagsByProject[projectId] || {}
  const tagCounts: Record<string, number> = {}

  // Count tag occurrences
  for (const tagId of Object.keys(projectTags)) {
    tagCounts[tagId] = 0
  }

  for (const log of Object.values(logs)) {
    for (const tagUse of log.tags) {
      if (tagCounts[tagUse.tagId] !== undefined) {
        tagCounts[tagUse.tagId]++
      }
    }
  }

  // Mark tags with < 10% occurrence as rare
  const rareTagIds = new Set<string>()
  for (const [tagId, count] of Object.entries(tagCounts)) {
    if (count / totalLogs < 0.1) {
      rareTagIds.add(tagId)
    }
  }

  return rareTagIds
}

/**
 * Run analysis for a single project with caching and safeguards
 * Returns findings along with updated cache if recomputation occurred
 * 
 * Safeguards:
 * - Fingerprint-based cache invalidation (detects all data changes)
 * - Throttling to prevent computation storms (1 second minimum between runs)
 * - Returns cache hit indicator for debugging/monitoring
 */
export function runAnalysisForProject(
  state: AppStateV1,
  projectId: string
): AnalysisResult {
  const project = state.lab?.projects[projectId]
  if (!project || project.archived) {
    return { findings: [], cacheHit: false }
  }

  // Generate fingerprint
  const fingerprint = generateFingerprint(state, projectId)

  // Check cache first
  const cached = getCachedFindings(state.lab?.findingsCache, projectId, fingerprint)
  if (cached) {
    return { findings: cached, cacheHit: true }
  }

  // Check if we're computing too frequently (throttling safeguard)
  if (!canRecompute(state.lab?.findingsCache, projectId)) {
    // Return stale cache if available, empty otherwise
    const staleCache = state.lab?.findingsCache?.[projectId]
    return {
      findings: staleCache?.findings || [],
      cacheHit: true, // Technically using stale cache
    }
  }

  // Build dataset and run analysis
  if (project.mode === 'daily') {
    const dataset = buildDailyDataset(state, projectId)
    
    // Need minimum data
    if (dataset.rows.length < 5) {
      // Cache empty result to avoid repeated computation
      const updatedCache = setCachedFindings(
        state.lab?.findingsCache,
        projectId,
        fingerprint,
        []
      )
      return { findings: [], updatedCache, cacheHit: false }
    }

    // Identify rare tags to exclude
    const rareTagIds = getRareTagIds(state, projectId)

    // Run all applicable daily methods
    const findings: LabFinding[] = []
    for (const method of v1AllMethods) {
      if (method.kind === 'daily') {
        const methodFindings = method.run(dataset, projectId)
        findings.push(...methodFindings)
      }
    }

    // Filter rare tags
    const nonRareFindings = findings.filter((f) => !rareTagIds.has(f.tagId))

    // Apply guardrails
    const finalFindings = applyGuardrails(nonRareFindings)

    // Update cache
    const updatedCache = setCachedFindings(
      state.lab?.findingsCache,
      projectId,
      fingerprint,
      finalFindings
    )

    return { findings: finalFindings, updatedCache, cacheHit: false }
  }

  // Event projects
  const dataset = buildEventDataset(state, projectId)

  // Need minimum data
  if (dataset.rows.length < 5) {
    const updatedCache = setCachedFindings(state.lab?.findingsCache, projectId, fingerprint, [])
    return { findings: [], updatedCache, cacheHit: false }
  }

  // Build group-projected dataset for group frequency methods
  const groupProjected = buildEventGroupDataset(state, projectId)
  const groupDataset = { rows: groupProjected.rows, coverage: groupProjected.coverage }

  const findings: LabFinding[] = []
  for (const method of v1AllMethods) {
    if (method.kind !== 'event') continue

    const isGroupMethod =
      method.name === 'event-group-frequency' ||
      method.name === 'event-group-severity-effect' ||
      method.name === 'event-group-episode-duration-effect' ||
      method.name === 'event-group-episode-max-severity-effect' ||
      method.name === 'event-group-occurrence-effect'
    const methodDataset = isGroupMethod ? groupDataset : dataset
    const methodFindings = method.run(methodDataset, projectId)
    findings.push(...methodFindings)
  }

  const finalFindings = applyGuardrails(findings)

  const updatedCache = setCachedFindings(state.lab?.findingsCache, projectId, fingerprint, finalFindings)
  return { findings: finalFindings, updatedCache, cacheHit: false }
}

/**
 * Run analysis for all active projects
 * Returns all findings by project along with updated cache
 */
export function runAnalysisForAllProjects(state: AppStateV1): {
  findingsByProject: Record<string, LabFinding[]>
  updatedCache?: Record<string, FindingsCache>
} {
  const findingsByProject: Record<string, LabFinding[]> = {}
  let updatedCache = state.lab?.findingsCache

  const projectIds = state.lab?.projectOrder || []
  for (const projectId of projectIds) {
    const result = runAnalysisForProject(state, projectId)
    
    if (result.findings.length > 0) {
      findingsByProject[projectId] = result.findings
    }

    // Accumulate cache updates
    if (result.updatedCache) {
      updatedCache = result.updatedCache
    }
  }

  return { findingsByProject, updatedCache }
}
