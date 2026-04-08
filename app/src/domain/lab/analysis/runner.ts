import type { AppStateV1 } from '../../types'
import {
  buildDailyDataset,
  buildDailyDatasetForOutcome,
  buildEventDataset,
  buildEventGroupDataset,
  buildMultiChoiceDataset,
  buildTagOnlyDataset,
} from './datasetBuilders'
import { v1AllMethods } from './methods'
import { tagFrequency, tagCoOccurrence } from './tagOnlyMethods'
import { choiceFrequency } from './multiChoiceMethods'
import { crossOutcomeCorrelation, perOutcomeTagCorrelation } from './multiOutcomeMethods'
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
    const isFrequency =
      finding.method === 'event-tag-frequency' ||
      finding.method === 'event-group-frequency' ||
      finding.method === 'tag-frequency' ||
      finding.method === 'choice-frequency'
    const isOccurrence = finding.method === 'event-tag-occurrence-effect' || finding.method === 'event-group-occurrence-effect'
    const isCoOccurrence = finding.method === 'tag-co-occurrence'
    const isCrossOutcome = finding.method === 'cross-outcome-correlation'
    if (!isFrequency && !isOccurrence && !isCoOccurrence && !isCrossOutcome && Math.abs(finding.effect) < 0.1) return false

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

    // Multi-outcome analysis (MO1 + MO2)
    if (project.config.kind === 'daily' && project.config.additionalOutcomes && project.config.additionalOutcomes.length > 0) {
      const additionalOutcomeIds = project.config.additionalOutcomes.map((o) => o.id)

      // Build per-outcome datasets
      const outcomeDatasets: Record<string, ReturnType<typeof buildDailyDatasetForOutcome>> = {}
      for (const outcomeId of additionalOutcomeIds) {
        outcomeDatasets[outcomeId] = buildDailyDatasetForOutcome(state, projectId, outcomeId)
      }

      // Build scales map for normalization in cross-outcome correlation
      const scales: Record<string, { min: number; max: number }> = {
        primary: { min: project.config.outcome.scale.min, max: project.config.outcome.scale.max },
      }
      for (const ao of project.config.additionalOutcomes) {
        scales[ao.id] = { min: ao.scale.min, max: ao.scale.max }
      }

      // MO1: Cross-outcome correlation
      const crossFindings = crossOutcomeCorrelation(projectId, additionalOutcomeIds, outcomeDatasets, dataset, scales)
      findings.push(...crossFindings)

      // MO2: Per-outcome tag correlation (run existing daily methods per additional outcome)
      for (const outcomeId of additionalOutcomeIds) {
        const outcomeDataset = outcomeDatasets[outcomeId]
        const perOutcomeFindings = perOutcomeTagCorrelation(outcomeId, outcomeDataset, projectId)
        findings.push(...perOutcomeFindings)
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

  // Tag-only projects
  if (project.mode === 'daily-tag-only') {
    const dataset = buildTagOnlyDataset(state, projectId)

    if (dataset.rows.length < 5) {
      const updatedCache = setCachedFindings(state.lab?.findingsCache, projectId, fingerprint, [])
      return { findings: [], updatedCache, cacheHit: false }
    }

    const findings: LabFinding[] = []
    findings.push(...tagFrequency(dataset, projectId))
    findings.push(...tagCoOccurrence(dataset, projectId))

    const finalFindings = applyGuardrails(findings)
    const updatedCache = setCachedFindings(state.lab?.findingsCache, projectId, fingerprint, finalFindings)
    return { findings: finalFindings, updatedCache, cacheHit: false }
  }

  // Multi-choice projects
  if (project.mode === 'daily-multi-choice') {
    const dataset = buildMultiChoiceDataset(state, projectId)

    if (dataset.rows.length < 5) {
      const updatedCache = setCachedFindings(state.lab?.findingsCache, projectId, fingerprint, [])
      return { findings: [], updatedCache, cacheHit: false }
    }

    const findings: LabFinding[] = []
    findings.push(...choiceFrequency(dataset, projectId))

    const finalFindings = applyGuardrails(findings)
    const updatedCache = setCachedFindings(state.lab?.findingsCache, projectId, fingerprint, finalFindings)
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
