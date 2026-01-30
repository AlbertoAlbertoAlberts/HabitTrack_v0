import { useAppState } from '../../../domain/store/useAppStore'
import { buildDailyDataset, buildEventDataset } from '../../../domain/lab/analysis/datasetBuilders'
import { formatTagNameDisplay } from '../../../domain/lab/utils/tagDisplay'
import styles from './DataMaturityView.module.css'
import type { CSSProperties } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

interface DataMaturityViewProps {
  projectId: string
}

export function DataMaturityView({ projectId }: DataMaturityViewProps) {
  const state = useAppState()
  const project = state.lab?.projects[projectId]
  const [isOpen, setIsOpen] = useState(false)
  const contentId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      const target = event.target
      if (!(target instanceof Node)) return
      if (el.contains(target)) return
      setIsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true } as AddEventListenerOptions)
  }, [isOpen])

  if (!project) return null

  const isDaily = project.mode === 'daily'
  const totalWindow = 120

  const countLogged = isDaily
    ? buildDailyDataset(state, projectId).coverage.validRows
    : buildEventDataset(state, projectId).coverage.validRows

  const countClamped = Math.max(0, Math.min(countLogged, totalWindow))

  const unitLabel = isDaily ? 'dienas' : 'logs'

  const phases = [
    { label: 'Pētīšanas stadija', range: `0–13 ${unitLabel}`, min: 0, max: 13 },
    { label: 'Agrīni dati', range: `14–29 ${unitLabel}`, min: 14, max: 29 },
    { label: 'Veidojas tendences', range: `30–59 ${unitLabel}`, min: 30, max: 59 },
    { label: 'Nobrieduši dati', range: `60–119 ${unitLabel}`, min: 60, max: 119 },
    { label: 'Augsta uzticamība', range: `120+ ${unitLabel}`, min: 120, max: null as number | null },
  ]

  const currentPhaseIndex = (() => {
    if (countLogged >= 120) return 4
    if (countLogged >= 60) return 3
    if (countLogged >= 30) return 2
    if (countLogged >= 14) return 1
    return 0
  })()

  const currentPhase = phases[currentPhaseIndex]
  const phaseMin = currentPhase.min
  const phaseMax = currentPhase.max ?? currentPhase.min
  const phaseLen = Math.max(1, phaseMax - phaseMin + 1)
  const dayInPhase = Math.max(0, countLogged - phaseMin)
  const completedDaysInPhase = currentPhase.max === null
    ? phaseLen
    : Math.max(0, Math.min(phaseLen, dayInPhase + 1))

  const dotCount = currentPhase.max === null ? 1 : phaseLen
  const filledDots = currentPhase.max === null ? dotCount : completedDaysInPhase

  const ringStyle: CSSProperties = {
    '--progress': `${(countClamped / totalWindow) * 100}%`,
  } as CSSProperties

  const innerDotsStyle: CSSProperties = {
    '--dot-count': dotCount,
  } as CSSProperties

  const headerLabel = `${currentPhase.label} (${currentPhase.range})`

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        className={styles.headerButton}
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <div className={styles.headerLabel}>{headerLabel}</div>
        <span className={[styles.chevron, isOpen && styles.chevronOpen].filter(Boolean).join(' ')} aria-hidden>
          ▸
        </span>
      </button>

      {isOpen && (
        <div id={contentId} className={styles.dropdown}>
          <div className={styles.maturityLayout}>
            <div className={styles.ringWrap} aria-label={`Data maturity: ${countClamped}/${totalWindow} ${unitLabel}`}>
              <div className={styles.ringCard}>
                <div className={styles.ring} style={ringStyle}>
                  <div className={styles.innerDots} style={innerDotsStyle}>
                    {Array.from({ length: filledDots }).map((_, i) => (
                      <span key={i} className={styles.dot} style={{ '--i': i } as CSSProperties} />
                    ))}
                  </div>
                  <div className={styles.ringCenter}>
                    <div className={styles.ringText}>
                      {countClamped}/{totalWindow}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.phaseList}>
              {phases.map((p, idx) => {
                const checked = idx <= currentPhaseIndex
                return (
                  <div
                    key={p.label}
                    className={[styles.phaseRow, idx === currentPhaseIndex && styles.phaseRowActive]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className={[styles.checkbox, checked && styles.checkboxChecked].filter(Boolean).join(' ')}>
                      {checked && <span className={styles.checkMark}>✓</span>}
                    </div>
                    <div className={styles.phaseText}>
                      <div className={styles.phaseLine}>
                        <span className={styles.phaseLabel}>{p.label}</span>{' '}
                        <span className={styles.phaseRange}>({p.range})</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface TagCoverageViewProps {
  projectId: string
}

export function TagCoverageView({ projectId }: TagCoverageViewProps) {
  const state = useAppState()
  const project = state.lab?.projects[projectId]
  const tags = state.lab?.tagsByProject[projectId] || {}

  if (!project) return null

  const dataset = project.mode === 'daily'
    ? buildDailyDataset(state, projectId)
    : project.mode === 'event'
      ? buildEventDataset(state, projectId)
      : null

  if (!dataset) return null

  const { rows } = dataset
  const tagIds = Object.keys(tags)

  const totalCount = rows.length

  if (tagIds.length === 0) {
    return (
      <div className={styles.tagMaturity}>
        <div className={styles.tagMaturityTitle}>Tag Coverage</div>
        <div className={styles.tagMaturityEmpty}>No tags yet. Add tags to this project to see coverage.</div>
      </div>
    )
  }

  if (totalCount === 0) {
    return (
      <div className={styles.tagMaturity}>
        <div className={styles.tagMaturityTitle}>Tag Coverage</div>
        <div className={styles.tagMaturityEmpty}>
          {project.mode === 'daily' ? 'No daily logs yet.' : 'No events yet.'}
        </div>
      </div>
    )
  }

  const items = tagIds
    .map((tagId) => {
      const tagName = tags[tagId]?.name || 'Unknown'
      const presentCount = rows.filter((r) => r.tags[tagId]?.present).length
      return { tagId, tagName, presentCount }
    })
    // Most mature first: highest presence count (coverage), then name for stability
    .sort((a, b) => {
      if (b.presentCount !== a.presentCount) return b.presentCount - a.presentCount
      return a.tagName.localeCompare(b.tagName)
    })

  return (
    <div className={styles.tagMaturity}>
      <div className={styles.tagMaturityTitle}>Tag Coverage</div>
      {items.map((item) => (
        <TagMaturityBar
          key={item.tagId}
          tagId={item.tagId}
          tagName={item.tagName}
          presentCount={item.presentCount}
          totalCount={totalCount}
        />
      ))}
    </div>
  )
}

interface TagMaturityBarProps {
  tagId: string
  tagName: string
  presentCount: number
  totalCount: number
}

function TagMaturityBar({ tagName, presentCount, totalCount }: TagMaturityBarProps) {
  const percentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0

  // Minimum threshold for reliable analysis
  const minThreshold = 10
  const isReady = presentCount >= minThreshold

  return (
    <div className={styles.tagBar}>
      <div className={styles.tagBarHeader}>
        <span className={styles.tagBarName}>{formatTagNameDisplay(tagName)}</span>
        <span className={styles.tagBarStats}>
          {presentCount} / {totalCount}
          {!isReady && <span className={styles.tagBarWarning}> ⚠ needs {minThreshold - presentCount} more</span>}
        </span>
      </div>
      <div className={styles.progressBar}>
        <div
          className={[styles.progressFill, isReady && styles.progressFillReady]
            .filter(Boolean)
            .join(' ')}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
