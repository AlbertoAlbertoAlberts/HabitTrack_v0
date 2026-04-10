import { useState, useEffect, useMemo } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import type {
  LabProject,
  LabDailyProjectConfig,
  LabDailyTagOnlyProjectConfig,
  LabDailyMultiChoiceProjectConfig,
  LabTagDef,
  LabTagUse,
  LabTagCategory,
} from '../../../domain/types'
import { formatTagNameDisplay } from '../../../domain/lab/utils/tagDisplay'
import { toLocalDateString, addDays } from '../../../domain/utils/localDate'
import { IntensityPicker } from '../../../components/ui/IntensityPicker'
import styles from './DailyLogForm.module.css'

interface DailyLogFormProps {
  projectId: string
}

export function DailyLogForm({ projectId }: DailyLogFormProps) {
  const state = useAppState()
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateString(new Date()))

  const project = state.lab?.projects[projectId]
  if (!project) return null
  if (project.mode !== 'daily' && project.mode !== 'daily-tag-only' && project.mode !== 'daily-multi-choice') return null

  const today = toLocalDateString(new Date())
  const isToday = selectedDate === today

  const handlePrevDay = () => setSelectedDate((d) => addDays(d, -1))
  const handleNextDay = () => {
    if (selectedDate < today) setSelectedDate((d) => addDays(d, 1))
  }
  const handleGoToday = () => setSelectedDate(today)

  const formatDate = (date: string) => {
    const [y, m, d] = date.split('-')
    const dt = new Date(Number(y), Number(m) - 1, Number(d))
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {project.mode === 'daily' && 'Daily Log'}
          {project.mode === 'daily-tag-only' && 'Daily Tags'}
          {project.mode === 'daily-multi-choice' && 'Daily Log'}
        </h3>
        <div className={styles.dateNav}>
          <button type="button" className={styles.dateBtn} onClick={handlePrevDay} aria-label="Previous day">
            ‹
          </button>
          <span className={styles.dateLabel} onClick={handleGoToday} title="Go to today">
            {isToday ? <span className={styles.todayBadge}>Today</span> : formatDate(selectedDate)}
          </span>
          <button
            type="button"
            className={styles.dateBtn}
            onClick={handleNextDay}
            disabled={selectedDate >= today}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </div>

      {project.config.kind === 'daily' && (
        <DailyOutcomeForm projectId={projectId} project={project} date={selectedDate} />
      )}
      {project.config.kind === 'daily-tag-only' && (
        <DailyTagOnlyForm projectId={projectId} project={project} date={selectedDate} />
      )}
      {project.config.kind === 'daily-multi-choice' && (
        <DailyMultiChoiceForm projectId={projectId} project={project} date={selectedDate} />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Daily – Track Outcome form
// ──────────────────────────────────────────────

interface DailyOutcomeFormProps {
  projectId: string
  project: LabProject
  date: string
}

function DailyOutcomeForm({ projectId, project, date }: DailyOutcomeFormProps) {
  const state = useAppState()
  const config = project.config as LabDailyProjectConfig

  const existingLog = state.lab?.dailyLogsByProject[projectId]?.[date]

  const [outcome, setOutcome] = useState<string>('')
  const [additionalOutcomes, setAdditionalOutcomes] = useState<Record<string, string>>({})
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [tagIntensities, setTagIntensities] = useState<Record<string, number>>({})
  const [noTags, setNoTags] = useState(false)
  const [note, setNote] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Load existing log when date changes
  useEffect(() => {
    if (existingLog) {
      setOutcome(existingLog.outcome !== undefined ? String(existingLog.outcome) : '')
      setAdditionalOutcomes(
        existingLog.additionalOutcomes
          ? Object.fromEntries(Object.entries(existingLog.additionalOutcomes).map(([k, v]) => [k, String(v)]))
          : {}
      )
      setSelectedTags(new Set(existingLog.tags.map((t) => t.tagId)))
      setTagIntensities(() => {
        const m: Record<string, number> = {}
        for (const t of existingLog.tags) {
          if (t.intensity !== undefined) m[t.tagId] = t.intensity
        }
        return m
      })
      setNoTags(existingLog.noTags ?? false)
      setNote(existingLog.note ?? '')
    } else {
      setOutcome('')
      setAdditionalOutcomes({})
      setSelectedTags(new Set())
      setTagIntensities({})
      setNoTags(false)
      setNote('')
    }
    setSaveError(null)
    setSaved(false)
  }, [date, projectId, existingLog?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const projectTags = useMemo(() => {
    return Object.values(state.lab?.tagsByProject[projectId] ?? {})
  }, [state.lab?.tagsByProject[projectId]]) // eslint-disable-line react-hooks/exhaustive-deps

  const tagsEnabled = config.tagsEnabled !== false
  const showTags = tagsEnabled && projectTags.length > 0
  const hasAdditionalOutcomes = (config.additionalOutcomes?.length ?? 0) > 0

  const selectedIntensityTags = projectTags.filter(
    (t) => selectedTags.has(t.id) && t.intensity?.enabled
  )

  // Tag category grouping
  const { tagGroups, hasCategories } = useTagGroups(projectId, projectTags)

  const handleSave = () => {
    setSaveError(null)

    // Validate primary outcome
    const outcomeVal = outcome.trim() ? Number(outcome) : undefined
    if (outcomeVal !== undefined) {
      if (isNaN(outcomeVal) || outcomeVal < config.outcome.scale.min || outcomeVal > config.outcome.scale.max) {
        setSaveError(`${config.outcome.name} must be between ${config.outcome.scale.min} and ${config.outcome.scale.max}`)
        return
      }
    }

    // Validate additional outcomes
    const addOutcomesParsed: Record<string, number> = {}
    if (hasAdditionalOutcomes) {
      for (const def of config.additionalOutcomes!) {
        const raw = additionalOutcomes[def.id]?.trim()
        if (raw) {
          const num = Number(raw)
          if (isNaN(num) || num < def.scale.min || num > def.scale.max) {
            setSaveError(`${def.name} must be between ${def.scale.min} and ${def.scale.max}`)
            return
          }
          addOutcomesParsed[def.id] = num
        }
      }
    }

    // Build tags
    const tags: LabTagUse[] = Array.from(selectedTags).map((tagId) => ({
      tagId,
      intensity: tagIntensities[tagId],
    }))

    // Validate tag intensities
    for (const t of tags) {
      const tagDef = projectTags.find((x) => x.id === t.tagId)
      if (!tagDef) continue
      const res = appStore.selectors.validateLabTagIntensity(tagDef, t.intensity)
      if (!res.valid) {
        setSaveError(`"${formatTagNameDisplay(tagDef.name)}": ${res.error}`)
        return
      }
    }

    appStore.actions.setLabDailyLog(projectId, date, {
      outcome: outcomeVal,
      additionalOutcomes: Object.keys(addOutcomesParsed).length > 0 ? addOutcomesParsed : undefined,
      tags,
      noTags: noTags || undefined,
      note: note.trim() || undefined,
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    if (!existingLog) return
    appStore.actions.deleteLabDailyLog(projectId, date)
    setOutcome('')
    setAdditionalOutcomes({})
    setSelectedTags(new Set())
    setTagIntensities({})
    setNoTags(false)
    setNote('')
    setSaved(false)
  }

  return (
    <div className={styles.form}>
      {saveError && <div className={styles.saveError} role="alert">{saveError}</div>}

      {/* Primary outcome */}
      <div className={styles.outcomeSection}>
        <div className={styles.outcomeRow}>
          <div className={styles.outcomeLabel}>{config.outcome.name}</div>
          <input
            type="number"
            className={styles.outcomeInput}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            min={config.outcome.scale.min}
            max={config.outcome.scale.max}
            step={config.outcome.scale.step || 1}
            placeholder={`${config.outcome.scale.min}–${config.outcome.scale.max}`}
          />
          <span className={styles.outcomeScale}>{config.outcome.scale.min}–{config.outcome.scale.max}</span>
        </div>

        {/* Additional outcomes */}
        {hasAdditionalOutcomes && config.additionalOutcomes!.map((def) => (
          <div key={def.id} className={styles.outcomeRow}>
            <div className={styles.outcomeLabel}>{def.name}</div>
            <input
              type="number"
              className={styles.outcomeInput}
              value={additionalOutcomes[def.id] ?? ''}
              onChange={(e) =>
                setAdditionalOutcomes((prev) => ({ ...prev, [def.id]: e.target.value }))
              }
              min={def.scale.min}
              max={def.scale.max}
              step={def.scale.step || 1}
              placeholder={`${def.scale.min}–${def.scale.max}`}
            />
            <span className={styles.outcomeScale}>{def.scale.min}–{def.scale.max}</span>
          </div>
        ))}
      </div>

      {/* Tags */}
      {showTags && (
        <TagSelector
          tagGroups={tagGroups}
          hasCategories={hasCategories}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          tagIntensities={tagIntensities}
          setTagIntensities={setTagIntensities}
          selectedIntensityTags={selectedIntensityTags}
          noTags={noTags}
          setNoTags={setNoTags}
          showNoTags={config.allowExplicitNoTags === true}
        />
      )}

      {/* Note */}
      <div className={styles.noteSection}>
        <label className={styles.noteLabel}>
          Note (optional)
          <textarea
            className={styles.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Additional details..."
          />
        </label>
      </div>

      {/* Actions */}
      <div className={styles.formActions}>
        {saved && (
          <span className={styles.savedIndicator}>
            <span className={styles.savedCheck}>✓</span> Saved
          </span>
        )}
        {existingLog && (
          <button type="button" className={styles.clearButton} onClick={handleClear}>
            Clear
          </button>
        )}
        <button type="button" className={styles.saveButton} onClick={handleSave}>
          {existingLog ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Daily – Tag Only form
// ──────────────────────────────────────────────

interface DailyTagOnlyFormProps {
  projectId: string
  project: LabProject
  date: string
}

function DailyTagOnlyForm({ projectId, project, date }: DailyTagOnlyFormProps) {
  const state = useAppState()
  const config = project.config as LabDailyTagOnlyProjectConfig

  const existingLog = state.lab?.dailyLogsByProject[projectId]?.[date]

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [tagIntensities, setTagIntensities] = useState<Record<string, number>>({})
  const [noTags, setNoTags] = useState(false)
  const [note, setNote] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Load existing log when date changes
  useEffect(() => {
    if (existingLog) {
      setSelectedTags(new Set(existingLog.tags.map((t) => t.tagId)))
      setTagIntensities(() => {
        const m: Record<string, number> = {}
        for (const t of existingLog.tags) {
          if (t.intensity !== undefined) m[t.tagId] = t.intensity
        }
        return m
      })
      setNoTags(existingLog.noTags ?? false)
      setNote(existingLog.note ?? '')
    } else {
      setSelectedTags(new Set())
      setTagIntensities({})
      setNoTags(false)
      setNote('')
    }
    setSaveError(null)
    setSaved(false)
  }, [date, projectId, existingLog?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const projectTags = useMemo(() => {
    return Object.values(state.lab?.tagsByProject[projectId] ?? {})
  }, [state.lab?.tagsByProject[projectId]]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIntensityTags = projectTags.filter(
    (t) => selectedTags.has(t.id) && t.intensity?.enabled
  )

  const { tagGroups, hasCategories } = useTagGroups(projectId, projectTags)

  const handleSave = () => {
    setSaveError(null)

    const tags: LabTagUse[] = Array.from(selectedTags).map((tagId) => ({
      tagId,
      intensity: tagIntensities[tagId],
    }))

    for (const t of tags) {
      const tagDef = projectTags.find((x) => x.id === t.tagId)
      if (!tagDef) continue
      const res = appStore.selectors.validateLabTagIntensity(tagDef, t.intensity)
      if (!res.valid) {
        setSaveError(`"${formatTagNameDisplay(tagDef.name)}": ${res.error}`)
        return
      }
    }

    appStore.actions.setLabDailyLog(projectId, date, {
      outcome: undefined,
      tags,
      noTags: noTags || undefined,
      note: note.trim() || undefined,
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    if (!existingLog) return
    appStore.actions.deleteLabDailyLog(projectId, date)
    setSelectedTags(new Set())
    setTagIntensities({})
    setNoTags(false)
    setNote('')
    setSaved(false)
  }

  if (projectTags.length === 0) {
    return (
      <div className={styles.form}>
        <div className={styles.emptyInfo}>
          Add tags to this project to start logging daily tags.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.form}>
      {saveError && <div className={styles.saveError} role="alert">{saveError}</div>}

      <TagSelector
        tagGroups={tagGroups}
        hasCategories={hasCategories}
        selectedTags={selectedTags}
        setSelectedTags={setSelectedTags}
        tagIntensities={tagIntensities}
        setTagIntensities={setTagIntensities}
        selectedIntensityTags={selectedIntensityTags}
        noTags={noTags}
        setNoTags={setNoTags}
        showNoTags={config.allowExplicitNoTags === true}
      />

      <div className={styles.noteSection}>
        <label className={styles.noteLabel}>
          Note (optional)
          <textarea
            className={styles.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Additional details..."
          />
        </label>
      </div>

      <div className={styles.formActions}>
        {saved && (
          <span className={styles.savedIndicator}>
            <span className={styles.savedCheck}>✓</span> Saved
          </span>
        )}
        {existingLog && (
          <button type="button" className={styles.clearButton} onClick={handleClear}>
            Clear
          </button>
        )}
        <button type="button" className={styles.saveButton} onClick={handleSave}>
          {existingLog ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Daily – Multiple-choice form
// ──────────────────────────────────────────────

interface DailyMultiChoiceFormProps {
  projectId: string
  project: LabProject
  date: string
}

function DailyMultiChoiceForm({ projectId, project, date }: DailyMultiChoiceFormProps) {
  const state = useAppState()
  const config = project.config as LabDailyMultiChoiceProjectConfig

  const existingLog = state.lab?.multiChoiceLogsByProject[projectId]?.[date]

  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // --- Tag state (only used when tagsEnabled) ---
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [tagIntensities, setTagIntensities] = useState<Record<string, number>>({})
  const [noTags, setNoTags] = useState(false)

  const mcTagsEnabled = config.tagsEnabled === true

  const projectTags = useMemo(() => {
    return Object.values(state.lab?.tagsByProject[projectId] ?? {})
  }, [state.lab?.tagsByProject[projectId]]) // eslint-disable-line react-hooks/exhaustive-deps

  const showTags = mcTagsEnabled && projectTags.length > 0

  const selectedIntensityTags = projectTags.filter(
    (t) => selectedTags.has(t.id) && t.intensity?.enabled
  )

  const { tagGroups, hasCategories } = useTagGroups(projectId, projectTags)

  const activeOptions = useMemo(
    () => config.options.filter((o) => !o.archived),
    [config.options]
  )

  // Load existing log when date changes
  useEffect(() => {
    if (existingLog) {
      setSelectedOptionIds(new Set(existingLog.selectedOptionIds))
      setNote(existingLog.note ?? '')
      // Restore tag state
      if (existingLog.tags) {
        setSelectedTags(new Set(existingLog.tags.map((t) => t.tagId)))
        setTagIntensities(() => {
          const m: Record<string, number> = {}
          for (const t of existingLog.tags!) {
            if (t.intensity !== undefined) m[t.tagId] = t.intensity
          }
          return m
        })
      } else {
        setSelectedTags(new Set())
        setTagIntensities({})
      }
      setNoTags(existingLog.noTags ?? false)
    } else {
      setSelectedOptionIds(new Set())
      setNote('')
      setSelectedTags(new Set())
      setTagIntensities({})
      setNoTags(false)
    }
    setSaveError(null)
    setSaved(false)
  }, [date, projectId, existingLog?.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const isSingleSelect = config.selectionMode === 'single'

  const toggleOption = (optionId: string) => {
    if (isSingleSelect) {
      // Radio behavior: select only this one
      setSelectedOptionIds((prev) => (prev.has(optionId) ? new Set() : new Set([optionId])))
    } else {
      setSelectedOptionIds((prev) => {
        const next = new Set(prev)
        if (next.has(optionId)) {
          next.delete(optionId)
        } else {
          next.add(optionId)
        }
        return next
      })
    }
  }

  const handleSave = () => {
    setSaveError(null)

    // Build tags if enabled
    let tags: LabTagUse[] | undefined
    if (mcTagsEnabled && selectedTags.size > 0) {
      tags = Array.from(selectedTags).map((tagId) => ({
        tagId,
        intensity: tagIntensities[tagId],
      }))

      // Validate tag intensities
      for (const t of tags) {
        const tagDef = projectTags.find((x) => x.id === t.tagId)
        if (!tagDef) continue
        const res = appStore.selectors.validateLabTagIntensity(tagDef, t.intensity)
        if (!res.valid) {
          setSaveError(`"${formatTagNameDisplay(tagDef.name)}": ${res.error}`)
          return
        }
      }
    }

    appStore.actions.setLabMultiChoiceLog(projectId, date, {
      selectedOptionIds: Array.from(selectedOptionIds),
      tags,
      noTags: mcTagsEnabled && noTags ? true : undefined,
      note: note.trim() || undefined,
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    if (!existingLog) return
    appStore.actions.deleteLabMultiChoiceLog(projectId, date)
    setSelectedOptionIds(new Set())
    setNote('')
    setSelectedTags(new Set())
    setTagIntensities({})
    setNoTags(false)
    setSaved(false)
  }

  if (activeOptions.length === 0) {
    return (
      <div className={styles.form}>
        <div className={styles.emptyInfo}>
          All options are archived. Edit the project to add new options.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.form}>
      {saveError && <div className={styles.saveError} role="alert">{saveError}</div>}

      <div className={styles.choicesSection}>
        <div className={styles.choicesTitle}>
          {isSingleSelect ? 'Select one' : 'Select all that apply'}
        </div>
        <div className={styles.choicesList}>
          {activeOptions.map((option) => {
            const isSelected = selectedOptionIds.has(option.id)
            return (
              <label
                key={option.id}
                className={`${styles.choiceLabel} ${isSelected ? styles.choiceLabelSelected : ''}`}
              >
                <input
                  type={isSingleSelect ? 'radio' : 'checkbox'}
                  name={`choice-${projectId}-${date}`}
                  checked={isSelected}
                  onChange={() => {
                    if (!isSingleSelect) toggleOption(option.id)
                  }}
                  onClick={() => {
                    if (isSingleSelect) toggleOption(option.id)
                  }}
                />
                {option.label}
              </label>
            )
          })}
        </div>
      </div>

      {/* Tags (when enabled) */}
      {showTags && (
        <TagSelector
          tagGroups={tagGroups}
          hasCategories={hasCategories}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          tagIntensities={tagIntensities}
          setTagIntensities={setTagIntensities}
          selectedIntensityTags={selectedIntensityTags}
          noTags={noTags}
          setNoTags={setNoTags}
          showNoTags={config.allowExplicitNoTags === true}
        />
      )}

      <div className={styles.noteSection}>
        <label className={styles.noteLabel}>
          Note (optional)
          <textarea
            className={styles.textarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Additional details..."
          />
        </label>
      </div>

      <div className={styles.formActions}>
        {saved && (
          <span className={styles.savedIndicator}>
            <span className={styles.savedCheck}>✓</span> Saved
          </span>
        )}
        {existingLog && (
          <button type="button" className={styles.clearButton} onClick={handleClear}>
            Clear
          </button>
        )}
        <button type="button" className={styles.saveButton} onClick={handleSave}>
          {existingLog ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Shared: Tag Selector sub-component
// ──────────────────────────────────────────────

interface TagGroup {
  category: LabTagCategory | null
  tags: LabTagDef[]
}

interface TagSelectorProps {
  tagGroups: TagGroup[]
  hasCategories: boolean
  selectedTags: Set<string>
  setSelectedTags: React.Dispatch<React.SetStateAction<Set<string>>>
  tagIntensities: Record<string, number>
  setTagIntensities: React.Dispatch<React.SetStateAction<Record<string, number>>>
  selectedIntensityTags: LabTagDef[]
  noTags: boolean
  setNoTags: React.Dispatch<React.SetStateAction<boolean>>
  showNoTags: boolean
}

function TagSelector({
  tagGroups,
  hasCategories,
  selectedTags,
  setSelectedTags,
  tagIntensities,
  setTagIntensities,
  selectedIntensityTags,
  noTags,
  setNoTags,
  showNoTags,
}: TagSelectorProps) {

  const handleToggleTag = (tagId: string, checked: boolean) => {
    if (checked) {
      setSelectedTags((prev) => new Set(prev).add(tagId))
      if (noTags) setNoTags(false)
    } else {
      setSelectedTags((prev) => {
        const next = new Set(prev)
        next.delete(tagId)
        return next
      })
      setTagIntensities((prev) => {
        const next = { ...prev }
        delete next[tagId]
        return next
      })
    }
  }

  const handleNoTags = (checked: boolean) => {
    setNoTags(checked)
    if (checked) {
      setSelectedTags(new Set())
      setTagIntensities({})
    }
  }

  return (
    <div className={styles.tagsSection}>
      <div className={styles.tagsTitle}>Tags</div>

      {tagGroups.map((group) => (
        <div key={group.category?.id ?? '__uncategorized__'}>
          {hasCategories && (
            <div className={styles.tagCategoryHeader}>
              {group.category?.name ?? 'Uncategorized'}
            </div>
          )}
          <div className={styles.tagGrid}>
            {group.tags.map((tag) => (
              <label key={tag.id} className={styles.tagLabel}>
                <input
                  type="checkbox"
                  checked={selectedTags.has(tag.id)}
                  disabled={noTags}
                  onChange={(e) => handleToggleTag(tag.id, e.target.checked)}
                />
                {formatTagNameDisplay(tag.name)}
              </label>
            ))}
          </div>
        </div>
      ))}

      {showNoTags && (
        <div className={styles.noTagsRow}>
          <label className={styles.noTagsLabel}>
            <input
              type="checkbox"
              checked={noTags}
              onChange={(e) => handleNoTags(e.target.checked)}
            />
            No tags today
          </label>
        </div>
      )}

      {selectedIntensityTags.length > 0 && (
        <div className={styles.intensityList}>
          <div className={styles.intensityTitle}>Intensity</div>
          {selectedIntensityTags.map((tag) => (
            <div key={tag.id} className={styles.intensityRow}>
              <div className={styles.intensityName}>{formatTagNameDisplay(tag.name)}</div>
              <IntensityPicker
                min={tag.intensity?.min ?? 1}
                max={tag.intensity?.max ?? 5}
                step={tag.intensity?.step ?? 1}
                value={tagIntensities[tag.id]}
                onChange={(next) =>
                  setTagIntensities((prev) => ({ ...prev, [tag.id]: next }))
                }
                ariaLabel={`Intensity for ${formatTagNameDisplay(tag.name)}`}
              />
              {tag.intensity?.unitLabel && (
                <div className={styles.intensityUnit}>{tag.intensity.unitLabel}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Hook: group tags by category
// ──────────────────────────────────────────────

function useTagGroups(projectId: string, tags: LabTagDef[]) {
  const state = useAppState()

  return useMemo(() => {
    const categoriesMap = state.lab?.tagCategoriesByProject?.[projectId] ?? {}
    const categoryOrder = state.lab?.tagCategoryOrderByProject?.[projectId] ?? []

    const orderedCatSet = new Set(categoryOrder)
    const allCategories: LabTagCategory[] = [
      ...categoryOrder.map((id) => categoriesMap[id]).filter(Boolean),
      ...Object.values(categoriesMap).filter((c) => !orderedCatSet.has(c.id)),
    ]

    const hasCategories = allCategories.length > 0

    if (!hasCategories) {
      return { tagGroups: [{ category: null, tags }] as TagGroup[], hasCategories: false }
    }

    const groups: TagGroup[] = []
    const catTagMap = new Map<string, LabTagDef[]>()
    const uncategorized: LabTagDef[] = []

    for (const tag of tags) {
      if (tag.categoryId && categoriesMap[tag.categoryId]) {
        const list = catTagMap.get(tag.categoryId) ?? []
        list.push(tag)
        catTagMap.set(tag.categoryId, list)
      } else {
        uncategorized.push(tag)
      }
    }

    for (const cat of allCategories) {
      const catTags = catTagMap.get(cat.id) ?? []
      if (catTags.length > 0) {
        groups.push({ category: cat, tags: catTags })
      }
    }

    if (uncategorized.length > 0) {
      groups.push({ category: null, tags: uncategorized })
    }

    return { tagGroups: groups, hasCategories }
  }, [state.lab?.tagCategoriesByProject, state.lab?.tagCategoryOrderByProject, projectId, tags])
}
