import styles from './LabResultsTabs.module.css'
import { useRef } from 'react'

export type LabResultsTabKey =
  | 'top'
  | 'occurrence'
  | 'eventFrequency'
  | 'positive'
  | 'negative'
  | 'stats'
  | 'coverage'
  | 'uncertain'

export type LabResultsTabDef = { key: LabResultsTabKey; label: string }

const DEFAULT_TABS: LabResultsTabDef[] = [
  { key: 'top', label: 'Top findings' },
  { key: 'occurrence', label: 'Occurrence insights' },
  { key: 'positive', label: 'Positive effects' },
  { key: 'negative', label: 'Negative effects' },
  { key: 'stats', label: 'Tag Statistics' },
  { key: 'coverage', label: 'Tag coverage' },
  { key: 'uncertain', label: 'Uncertain' },
]
interface LabResultsTabsProps {
  active: LabResultsTabKey
  onChange: (next: LabResultsTabKey) => void
  tabs?: LabResultsTabDef[]
}

export function LabResultsTabs({ active, onChange, tabs }: LabResultsTabsProps) {
  const buttonRefs = useRef<Partial<Record<LabResultsTabKey, HTMLButtonElement | null>>>({})

  const visibleTabs = tabs && tabs.length > 0 ? tabs : DEFAULT_TABS
  const orderedKeys = visibleTabs.map((t) => t.key)

  const focusTab = (key: LabResultsTabKey) => {
    const el = buttonRefs.current[key]
    if (el) el.focus({ preventScroll: true })
  }

  const moveFocus = (nextKey: LabResultsTabKey) => {
    onChange(nextKey)
    // Focus after state/URL update so the newly-selected tab is in tab order.
    requestAnimationFrame(() => focusTab(nextKey))
  }

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, key: LabResultsTabKey) => {
    if (orderedKeys.length === 0) return

    const idx = orderedKeys.indexOf(key)
    if (idx < 0) return

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextKey = orderedKeys[(idx + 1) % orderedKeys.length]
      moveFocus(nextKey)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const nextKey = orderedKeys[(idx - 1 + orderedKeys.length) % orderedKeys.length]
      moveFocus(nextKey)
    } else if (e.key === 'Home') {
      e.preventDefault()
      moveFocus(orderedKeys[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      moveFocus(orderedKeys[orderedKeys.length - 1])
    }
  }

  return (
    <div className={styles.container} role="tablist" aria-label="Results sections">
      {visibleTabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={[styles.tab, active === t.key && styles.active].filter(Boolean).join(' ')}
          onClick={() => onChange(t.key)}
          role="tab"
          aria-selected={active === t.key}
          id={`lab-results-tab-${t.key}`}
          aria-controls={`lab-results-panel-${t.key}`}
          tabIndex={active === t.key ? 0 : -1}
          ref={(el) => {
            buttonRefs.current[t.key] = el
          }}
          onKeyDown={(e) => onTabKeyDown(e, t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
