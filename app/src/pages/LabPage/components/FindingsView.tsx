import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import { runAnalysisForProject } from '../../../domain/lab/analysis/runner'
import type { LabFinding } from '../../../domain/lab/analysis/types'
import type { LabTagDef } from '../../../domain/types'
import { getConfidenceExplanation } from '../../../domain/lab/analysis/summaryBuilder'
import { formatTagNameDisplay } from '../../../domain/lab/utils/tagDisplay'
import { TagStatsView } from './TagStatsView'
import { DataMaturityView, TagCoverageView } from './DataMaturityView'
import { LabResultsTabs, type LabResultsTabDef, type LabResultsTabKey } from './LabResultsTabs'
import { EventFrequencyView } from './EventFrequencyView'
import { EventEpisodesView } from './EventEpisodesView'
import styles from './FindingsView.module.css'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

function isTabKey(
  value: string | null
): value is 'top' | 'occurrence' | 'eventFrequency' | 'positive' | 'negative' | 'stats' | 'coverage' | 'uncertain' {
  return (
    value === 'top' ||
    value === 'occurrence' ||
    value === 'eventFrequency' ||
    value === 'positive' ||
    value === 'negative' ||
    value === 'stats' ||
    value === 'coverage' ||
    value === 'uncertain'
  )
}

function isEventViewMode(value: string | null): value is 'tags' | 'groups' {
  return value === 'tags' || value === 'groups'
}

interface FindingsViewProps {
  projectId: string
  onEditProject?: (projectId: string) => void
}
export function FindingsView({ projectId, onEditProject }: FindingsViewProps) {
  const state = useAppState()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedStatsTagId, setSelectedStatsTagId] = useState<string | null>(null)
  const tabPanelRef = useRef<HTMLDivElement | null>(null)
  const [tabPanelMinHeight, setTabPanelMinHeight] = useState(0)
  const project = state.lab?.projects[projectId]
  const tags: Record<string, LabTagDef> = state.lab?.tagsByProject[projectId] || {}
  const eventLogsById = useMemo(
    () => {
      const logsById = state.lab?.eventLogsByProject?.[projectId] || {}
      return project?.mode === 'event' ? logsById : {}
    },
    [project?.mode, state.lab?.eventLogsByProject, projectId]
  )
  const eventLogCount = project?.mode === 'event' ? Object.keys(eventLogsById).length : 0

  const eventSeverityLogCount = useMemo(() => {
    if (project?.mode !== 'event') return 0
    return Object.values(eventLogsById).filter((l) => typeof l.severity === 'number' && Number.isFinite(l.severity)).length
  }, [eventLogsById, project?.mode])

  const rawTab = searchParams.get('tab')
  const defaultTab: LabResultsTabKey = 'top'
  const parsedTab: LabResultsTabKey = isTabKey(rawTab) ? rawTab : defaultTab

  const rawView = searchParams.get('view')
  const viewMode: 'tags' | 'groups' = project?.mode === 'event' ? (isEventViewMode(rawView) ? rawView : 'tags') : 'tags'

  const severityTabsAvailable = project?.mode === 'event' ? eventSeverityLogCount >= 6 : true

  const availableTabs: LabResultsTabKey[] =
    project?.mode === 'event' && !severityTabsAvailable
      ? ['top', 'occurrence', 'stats', 'eventFrequency', 'coverage']
      : project?.mode === 'event'
        ? ['top', 'occurrence', 'positive', 'negative', 'stats', 'eventFrequency', 'coverage', 'uncertain']
        : ['top', 'positive', 'negative', 'stats', 'coverage', 'uncertain']

  const activeTab: LabResultsTabKey = availableTabs.includes(parsedTab) ? parsedTab : availableTabs[0]

  // Ensure URL is always shareable/bookmarkable with an explicit valid tab.
  useEffect(() => {
    if (rawTab === activeTab) return
    const next = new URLSearchParams(searchParams)
    next.set('tab', activeTab)
    setSearchParams(next, { replace: true })
  }, [rawTab, activeTab, searchParams, setSearchParams])

  // Ensure view is explicit for event projects (shareable/bookmarkable)
  useEffect(() => {
    if (project?.mode !== 'event') return
    if (rawView === viewMode) return
    const next = new URLSearchParams(searchParams)
    next.set('view', viewMode)
    setSearchParams(next, { replace: true })
  }, [project?.mode, rawView, viewMode, searchParams, setSearchParams])

  // Run analysis (uses cache when possible)
  const result = runAnalysisForProject(state, projectId)
  const findings = result.findings

  const visibleFindings = useMemo(() => {
    if (project?.mode !== 'event') return findings
    if (viewMode === 'groups') return findings.filter((f) => f.tagId.startsWith('group:'))
    return findings.filter((f) => !f.tagId.startsWith('group:'))
  }, [findings, project?.mode, viewMode])

  // Persist cache updates to state
  useEffect(() => {
    if (result.updatedCache) {
      appStore.actions.updateFindingsCache(result.updatedCache)
    }
  }, [result.updatedCache])

  const { top10ByAbsEffect, occurrenceInsights, episodeInsights, negative, positive, uncertain } = useMemo(() => {
    if (project?.mode === 'event') {
      const frequencyMethod = viewMode === 'groups' ? 'event-group-frequency' : 'event-tag-frequency'
      const occurrenceMethod = viewMode === 'groups' ? 'event-group-occurrence-effect' : 'event-tag-occurrence-effect'
      const episodeDurationMethod =
        viewMode === 'groups' ? 'event-group-episode-duration-effect' : 'event-tag-episode-duration-effect'
      const episodeMaxSeverityMethod =
        viewMode === 'groups'
          ? 'event-group-episode-max-severity-effect'
          : 'event-tag-episode-max-severity-effect'

      const top10ByAbsEffect = [...visibleFindings]
        .filter((f) => f.method === frequencyMethod)
        .sort((a, b) => b.effect - a.effect)
        .slice(0, 10)

      const occurrenceInsights = [...visibleFindings]
        .filter((f) => f.method === occurrenceMethod)
        .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
        .slice(0, 10)

      const episodeDuration = [...visibleFindings]
        .filter((f) => f.method === episodeDurationMethod)
        .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
        .slice(0, 10)

      const episodeMaxSeverity = [...visibleFindings]
        .filter((f) => f.method === episodeMaxSeverityMethod)
        .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
        .slice(0, 10)

      const severityOnly = visibleFindings.filter((f) =>
        viewMode === 'groups' ? f.method === 'event-group-severity-effect' : f.method === 'event-tag-severity-effect'
      )

      const negative = [...severityOnly]
        .filter((f) => f.effect < 0)
        .sort((a, b) => a.effect - b.effect)
        .slice(0, 10)

      const positive = [...severityOnly]
        .filter((f) => f.effect > 0)
        .sort((a, b) => b.effect - a.effect)
        .slice(0, 10)

      const uncertain = [...severityOnly]
        .sort((a, b) => {
          // Sort by confidence (low first) then by sample size (small first)
          if (a.confidence !== b.confidence) {
            const order = { low: 0, medium: 1, high: 2 }
            return order[a.confidence] - order[b.confidence]
          }
          return a.sampleSize - b.sampleSize
        })
        .slice(0, 10)

      return {
        top10ByAbsEffect,
        occurrenceInsights,
        episodeInsights: {
          duration: episodeDuration,
          maxSeverity: episodeMaxSeverity,
        },
        negative,
        positive,
        uncertain,
      }
    }

    const severityOnly = visibleFindings

    const top10ByAbsEffect = [...visibleFindings].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)).slice(0, 10)

    const negative = severityOnly
      .filter((f) => f.effect < 0)
      .sort((a, b) => a.effect - b.effect)
      .slice(0, 10)

    const positive = severityOnly
      .filter((f) => f.effect > 0)
      .sort((a, b) => b.effect - a.effect)
      .slice(0, 10)

    const uncertain = [...severityOnly]
      .sort((a, b) => {
        // Sort by confidence (low first) then by sample size (small first)
        if (a.confidence !== b.confidence) {
          const order = { low: 0, medium: 1, high: 2 }
          return order[a.confidence] - order[b.confidence]
        }
        return a.sampleSize - b.sampleSize
      })
      .slice(0, 10)

    return {
      top10ByAbsEffect,
      occurrenceInsights: [],
      episodeInsights: { duration: [], maxSeverity: [] },
      negative,
      positive,
      uncertain,
    }
  }, [visibleFindings, project?.mode, viewMode])

  // Prevent the content area from collapsing upward when switching to a shorter tab.
  useLayoutEffect(() => {
    const el = tabPanelRef.current
    if (!el) return

    const h = Math.ceil(el.getBoundingClientRect().height)
    if (!Number.isFinite(h) || h <= 0) return

    setTabPanelMinHeight((prev) => Math.max(prev, h))
  }, [activeTab, visibleFindings.length])

  const titles =
    project?.mode === 'event'
      ? {
          top: viewMode === 'groups' ? 'Group frequency' : 'Tag frequency',
          occurrence: viewMode === 'groups' ? 'Occurrence insights (groups)' : 'Occurrence insights',
          episodeDuration: viewMode === 'groups' ? 'Episode duration insights (groups)' : 'Episode duration insights',
          episodeMaxSeverity: viewMode === 'groups' ? 'Episode max severity insights (groups)' : 'Episode max severity insights',
          negative: 'Lower severity findings',
          positive: 'Higher severity findings',
          uncertain: 'Most uncertain findings',
        }
      : {
          top: 'Top Findings',
          negative: '🔻 Strongest Negative Effects',
          positive: '🔺 Strongest Positive Effects',
          uncertain: '❓ Most Uncertain',
        }

  const tabDefs: LabResultsTabDef[] = useMemo(() => {
    if (project?.mode !== 'event') {
      return [
        { key: 'top', label: 'Top findings' },
        { key: 'positive', label: 'Positive effects' },
        { key: 'negative', label: 'Negative effects' },
        { key: 'stats', label: 'Tag Statistics' },
        { key: 'coverage', label: 'Tag coverage' },
        { key: 'uncertain', label: 'Uncertain' },
      ]
    }

    if (!severityTabsAvailable) {
      return [
        { key: 'top', label: viewMode === 'groups' ? 'Group frequency' : 'Tag frequency' },
        { key: 'occurrence', label: viewMode === 'groups' ? 'Occurrence (groups)' : 'Occurrence insights' },
        { key: 'stats', label: 'Tag Statistics' },
        { key: 'eventFrequency', label: 'Event frequency' },
        { key: 'coverage', label: 'Tag coverage' },
      ]
    }

    return [
      { key: 'top', label: viewMode === 'groups' ? 'Group frequency' : 'Tag frequency' },
      { key: 'occurrence', label: viewMode === 'groups' ? 'Occurrence (groups)' : 'Occurrence insights' },
      { key: 'positive', label: viewMode === 'groups' ? 'Higher severity (groups)' : 'Higher severity' },
      { key: 'negative', label: viewMode === 'groups' ? 'Lower severity (groups)' : 'Lower severity' },
      { key: 'stats', label: 'Tag Statistics' },
      { key: 'eventFrequency', label: 'Event frequency' },
      { key: 'coverage', label: 'Tag coverage' },
      { key: 'uncertain', label: 'Uncertain' },
    ]
  }, [project?.mode, severityTabsAvailable, viewMode])

  if (!project) return null

  const severityEnabled =
    project.mode === 'event' && project.config.kind === 'event'
      ? Boolean(project.config.event.severity?.enabled)
      : false

  // Show loading indicator for fresh computation
  const isComputing = !result.cacheHit && result.updatedCache !== undefined

  const notEnoughData =
    (project.mode === 'daily' && findings.length === 0) ||
    (project.mode === 'event' && eventLogCount < 5)

  const notEnoughDataHint =
    project.mode === 'daily'
      ? 'Keep logging data for this project to discover patterns and correlations.'
      : 'Log a few more events to unlock frequency and severity insights.'

  const tabPanelId = `lab-results-panel-${activeTab}`
  const tabId = `lab-results-tab-${activeTab}`

  return (
    <div className={styles.container}>
      {project.mode === 'event' && eventLogCount >= 5 && !severityTabsAvailable && (
        <div className={styles.severityNotice} role="note" aria-label="Severity recommendation">
          <div className={styles.severityNoticeRow}>
            <div className={styles.severityNoticeBody}>
              <div className={styles.severityNoticeTitle}>Add severity for deeper insights</div>
              {!severityEnabled ? (
                <div className={styles.severityNoticeText}>
                  Severity is currently off for this project. Enable it to log event severity (1–10) and unlock the Higher/Lower
                  severity tabs. After enabling, use “+ Log Event” (left panel) or edit an existing event to add severity.
                </div>
              ) : (
                <div className={styles.severityNoticeText}>
                  You have {eventLogCount} events logged, {eventSeverityLogCount} with severity. Add severity to at least 6 events to
                  unlock Higher/Lower severity tabs. Tip: expand an event in the left list and click Edit to fill severity on older
                  events. For now, “Tag frequency” shows frequency (how often tags appear with events).
                </div>
              )}
            </div>

            {onEditProject && (
              <button
                type="button"
                className={styles.severityNoticeBtn}
                onClick={() => onEditProject(projectId)}
              >
                {severityEnabled ? 'Project settings' : 'Enable severity'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className={styles.tabsRow}>
        <div className={styles.tabsLeft}>
          <LabResultsTabs
            active={activeTab}
            tabs={tabDefs}
            onChange={(nextTab) => {
              const next = new URLSearchParams(searchParams)
              next.set('tab', nextTab)
              setSearchParams(next)
            }}
          />
        </div>
        <div className={styles.tabsRight}>
          <div className={styles.rightStack}>
            <DataMaturityView projectId={projectId} />

            {project.mode === 'event' && (
              <div className={styles.viewToggle} aria-label="View mode">
                <button
                  type="button"
                  className={[styles.viewToggleBtn, viewMode === 'tags' && styles.viewToggleBtnActive]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.set('view', 'tags')
                    setSearchParams(next)
                  }}
                >
                  Tags
                </button>
                <button
                  type="button"
                  className={[styles.viewToggleBtn, viewMode === 'groups' && styles.viewToggleBtnActive]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams)
                    next.set('view', 'groups')
                    setSearchParams(next)
                  }}
                >
                  Groups
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        ref={tabPanelRef}
        role="tabpanel"
        id={tabPanelId}
        aria-labelledby={tabId}
        style={tabPanelMinHeight > 0 ? { minHeight: tabPanelMinHeight } : undefined}
      >
        {notEnoughData ? (
          <div className={styles.emptyStateBox}>
            <div className={styles.emptyIcon}>📊</div>
            <div className={styles.emptyTitle}>Not enough data yet</div>
            <div className={styles.emptyHint}>{notEnoughDataHint}</div>
            {isComputing && <div className={styles.computing}>Analyzing...</div>}
          </div>
        ) : (
          <>
            {activeTab === 'eventFrequency' && project.mode === 'event' && (
              <section className={styles.section}>
                <EventFrequencyView projectId={projectId} />
                <EventEpisodesView projectId={projectId} />

                {episodeInsights.duration.length > 0 && (
                  <>
                    <h3 className={styles.sectionTitle}>{titles.episodeDuration}</h3>
                    <RankedFindingsTwoCol findings={episodeInsights.duration} tags={tags} />
                  </>
                )}

                {episodeInsights.maxSeverity.length > 0 && (
                  <>
                    <h3 className={styles.sectionTitle}>{titles.episodeMaxSeverity}</h3>
                    <RankedFindingsTwoCol findings={episodeInsights.maxSeverity} tags={tags} />
                  </>
                )}
              </section>
            )}

            {activeTab === 'occurrence' && project.mode === 'event' && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>{titles.occurrence}</h3>
                <div className={styles.emptyHint}>
                  Baseline is inferred: days without events are treated as outcome=0 (no event). Exposures aren’t logged on those days.
                </div>

                {occurrenceInsights.length > 0 ? (
                  <RankedFindingsTwoCol findings={occurrenceInsights} tags={tags} />
                ) : (
                  <div className={styles.emptyHint}>
                    No occurrence insights available for this period. This tab needs some “off days” (days with no events) in the observed
                    date range.
                  </div>
                )}
              </section>
            )}

        {activeTab === 'coverage' && viewMode === 'groups' && project.mode === 'event' && (
          <section className={styles.section}>
            <div className={styles.emptyHint}>
              Group coverage isn’t available yet. Switch to “Tags” to see coverage.
            </div>
          </section>
        )}

        {activeTab === 'coverage' && !(viewMode === 'groups' && project.mode === 'event') && (
          <section className={styles.section}>
            <TagCoverageView projectId={projectId} />
          </section>
        )}

        {activeTab === 'top' && top10ByAbsEffect.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{titles.top}</h3>
            <RankedFindingsTwoCol findings={top10ByAbsEffect} tags={tags} />
          </section>
        )}

        {activeTab === 'top' && top10ByAbsEffect.length === 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{titles.top}</h3>
            <div className={styles.emptyHint}>No tag frequency findings yet. Try tagging events more consistently.</div>
          </section>
        )}

        {activeTab === 'negative' && negative.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{titles.negative}</h3>
            <RankedFindingsTwoCol findings={negative} tags={tags} />
          </section>
        )}

        {activeTab === 'negative' && negative.length === 0 && project.mode === 'event' && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{titles.negative}</h3>
            <div className={styles.emptyHint}>No severity findings yet. Add severity to events to populate this tab.</div>
          </section>
        )}

        {activeTab === 'positive' && positive.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{titles.positive}</h3>
            <RankedFindingsTwoCol findings={positive} tags={tags} />
          </section>
        )}

        {activeTab === 'positive' && positive.length === 0 && project.mode === 'event' && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{titles.positive}</h3>
            <div className={styles.emptyHint}>No severity findings yet. Add severity to events to populate this tab.</div>
          </section>
        )}

        {activeTab === 'uncertain' && uncertain.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{titles.uncertain}</h3>
            <RankedFindingsTwoCol findings={uncertain} tags={tags} />
          </section>
        )}

        {activeTab === 'uncertain' && uncertain.length === 0 && project.mode === 'event' && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{titles.uncertain}</h3>
            <div className={styles.emptyHint}>No severity findings yet. Add severity to events to unlock uncertainty ranking.</div>
          </section>
        )}

        {activeTab === 'stats' && viewMode === 'groups' && project.mode === 'event' && (
          <section className={styles.section}>
            <div className={styles.emptyHint}>
              Group statistics aren’t available yet. Switch to “Tags” to see tag stats.
            </div>
          </section>
        )}

        {activeTab === 'stats' && !(viewMode === 'groups' && project.mode === 'event') && (
          <section className={styles.section}>
            <TagStatsView
              projectId={projectId}
              selectedTagId={selectedStatsTagId}
              onSelectTag={setSelectedStatsTagId}
            />
          </section>
        )}

          </>
        )}
      </div>
    </div>
  )
}

interface FindingCardProps {
  finding: LabFinding
  tags: Record<string, LabTagDef>
  rank: number
}

function RankedFindingsTwoCol({
  findings,
  tags,
}: {
  findings: LabFinding[]
  tags: Record<string, LabTagDef>
}) {
  const left = findings.slice(0, 5)
  const right = findings.slice(5, 10)

  return (
    <div className={styles.findingsColumns}>
      <div className={styles.findingsCol}>
        {left.map((finding, i) => (
          <FindingCard key={`l-${i}-${finding.tagId}-${finding.method}`} finding={finding} tags={tags} rank={i + 1} />
        ))}
      </div>
      <div className={styles.findingsCol}>
        {right.map((finding, i) => (
          <FindingCard
            key={`r-${i}-${finding.tagId}-${finding.method}`}
            finding={finding}
            tags={tags}
            rank={i + 6}
          />
        ))}
      </div>
    </div>
  )
}

function FindingCard({ finding, tags, rank }: FindingCardProps) {
  const isGroupKey = finding.tagId.startsWith('group:')
  const tag = isGroupKey ? undefined : tags[finding.tagId]
  const rawTagName = isGroupKey ? finding.tagId.slice('group:'.length) : tag?.name || 'Unknown Tag'
  const tagName = formatTagNameDisplay(rawTagName)

  const effectColor = finding.effect > 0 ? styles.effectPositive : styles.effectNegative
  const confidenceBadge = {
    high: '●●●',
    medium: '●●○',
    low: '●○○',
  }[finding.confidence]

  // Replace [TAG] placeholder with actual tag name
  const summary = finding.summary.replace('[TAG]', tagName)
  const confidenceExplanation = getConfidenceExplanation(finding.confidence, finding.sampleSize)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.tagLine}>
          <span className={styles.rank}>{rank}.</span>
          <span className={styles.tagName}>{tagName}</span>
        </span>
        <span className={`${styles.effectBadge} ${effectColor}`}>
          {finding.effect > 0 ? '+' : ''}
          {finding.effect.toFixed(2)}
        </span>
      </div>
      <div className={styles.summary}>{summary}</div>
      <div className={styles.meta}>
        <span className={styles.method}>{finding.method}</span>
        <span className={styles.confidence} title={confidenceExplanation}>
          {confidenceBadge}
        </span>
        <span className={styles.sample}>n={finding.sampleSize}</span>
      </div>
    </div>
  )
}
