import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import type { LabProject, LabTagUse, LabDailyProjectConfig, LabDailyTagOnlyProjectConfig, LabDailyMultiChoiceProjectConfig } from '../../../domain/types'
import { formatTagNameDisplay } from '../../../domain/lab/utils/tagDisplay'
import { IntensityPicker } from '../../../components/ui/IntensityPicker'
import { Dialog, DialogBody, DialogFooter } from '../../../components/ui/Dialog'
import sharedStyles from '../../../components/ui/shared.module.css'
import styles from './DailyLabWidget.module.css'

interface DailyLabWidgetProps {
  date: string // YYYY-MM-DD
}

export function DailyLabWidget({ date }: DailyLabWidgetProps) {
  const state = useAppState()
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)

  // Respect the user-defined project order from Lab
  const projectOrder = state.lab?.projectOrder ?? []
  const projectsById = state.lab?.projects ?? {}
  const orderedSet = new Set(projectOrder)
  const missingIds = Object.keys(projectsById).filter((id) => !orderedSet.has(id))
  const projects = [...projectOrder, ...missingIds]
    .map((id) => projectsById[id])
    .filter((p) => p && !p.archived)

  if (projects.length === 0) return null

  return (
    <div className={styles.widget}>
      <h3 className={styles.title}>LAB Projects</h3>
      {projects.map((project) => (
        <ProjectEntry
          key={project.id}
          project={project}
          date={date}
          isExpanded={expandedProjectId === project.id}
          onToggle={() =>
            setExpandedProjectId(expandedProjectId === project.id ? null : project.id)
          }
        />
      ))}
    </div>
  )
}

interface ProjectEntryProps {
  project: LabProject
  date: string
  isExpanded: boolean
  onToggle: () => void
}

function ProjectEntry({ project, date, isExpanded, onToggle }: ProjectEntryProps) {
  const state = useAppState()
  const existingLog = (project.mode === 'daily' || project.mode === 'daily-tag-only')
    ? state.lab?.dailyLogsByProject[project.id]?.[date]
    : null
  const existingMultiChoiceLog = project.mode === 'daily-multi-choice'
    ? state.lab?.multiChoiceLogsByProject?.[project.id]?.[date]
    : null

  const [outcome, setOutcome] = useState(existingLog?.outcome?.toString() || '')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(existingLog?.tags.map((t) => t.tagId) || [])
  )
  const [noTags, setNoTags] = useState(existingLog?.noTags || false)
  const [dailyNote, setDailyNote] = useState(existingLog?.note || '')
  const [eventNote, setEventNote] = useState('')
  const [eventSeverity, setEventSeverity] = useState('')
  const [additionalOutcomes, setAdditionalOutcomes] = useState<Record<string, string>>(() => {
    const ao = existingLog?.additionalOutcomes
    if (!ao) return {}
    const init: Record<string, string> = {}
    for (const [id, val] of Object.entries(ao)) init[id] = String(val)
    return init
  })
  const [tagIntensities, setTagIntensities] = useState<Record<string, number>>(() => {
    const next: Record<string, number> = {}
    for (const t of existingLog?.tags || []) {
      if (t.intensity !== undefined) next[t.tagId] = t.intensity
    }
    return next
  })
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagGroup, setNewTagGroup] = useState('')
  const [newTagTrackIntensity, setNewTagTrackIntensity] = useState(false)
  const [newTagIntensityMax, setNewTagIntensityMax] = useState<3 | 5>(5)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Multi-choice state
  const [mcSelectedOptionIds, setMcSelectedOptionIds] = useState<Set<string>>(
    new Set(existingMultiChoiceLog?.selectedOptionIds ?? [])
  )
  const [mcNote, setMcNote] = useState(existingMultiChoiceLog?.note ?? '')
  const [mcSaved, setMcSaved] = useState(false)
  // Tag-only saved indicator
  const [tagOnlySaved, setTagOnlySaved] = useState(false)

  const projectTags = Object.values(state.lab?.tagsByProject[project.id] || {})
    .sort((a, b) => a.name.localeCompare(b.name, 'lv'))
  const selectedIntensityTags = projectTags.filter((t) => selectedTags.has(t.id) && t.intensity?.enabled)
  const hasLog = !!existingLog || !!existingMultiChoiceLog

  // When the user opens the project (or the log changes), sync the form state from persisted data.
  // This prevents the UI from showing stale defaults even though the checkmark indicates a saved log.
  useEffect(() => {
    if (!isExpanded) return
    if (project.mode !== 'daily') return

    const log = existingLog ?? null
    setOutcome(log?.outcome?.toString() || '')
    setSelectedTags(new Set(log?.tags.map((t) => t.tagId) || []))
    setNoTags(log?.noTags || false)
    setDailyNote(log?.note || '')
    setAdditionalOutcomes(() => {
      const ao = log?.additionalOutcomes
      if (!ao) return {}
      const init: Record<string, string> = {}
      for (const [id, val] of Object.entries(ao)) init[id] = String(val)
      return init
    })
    setTagIntensities(() => {
      const next: Record<string, number> = {}
      for (const t of log?.tags || []) {
        if (t.intensity !== undefined) next[t.tagId] = t.intensity
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, project.mode, existingLog?.updatedAt])

  // Sync tag-only form state when expanded
  useEffect(() => {
    if (!isExpanded) return
    if (project.mode !== 'daily-tag-only') return

    const log = existingLog ?? null
    setSelectedTags(new Set(log?.tags.map((t) => t.tagId) || []))
    setNoTags(log?.noTags || false)
    setDailyNote(log?.note || '')
    setTagIntensities(() => {
      const next: Record<string, number> = {}
      for (const t of log?.tags || []) {
        if (t.intensity !== undefined) next[t.tagId] = t.intensity
      }
      return next
    })
    setTagOnlySaved(false)
    setSaveError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, project.mode, existingLog?.updatedAt])

  // Sync multi-choice form state when expanded
  useEffect(() => {
    if (!isExpanded) return
    if (project.mode !== 'daily-multi-choice') return

    const log = existingMultiChoiceLog ?? null
    setMcSelectedOptionIds(new Set(log?.selectedOptionIds ?? []))
    setMcNote(log?.note ?? '')
    // Restore tag state
    if (log?.tags) {
      setSelectedTags(new Set(log.tags.map((t) => t.tagId)))
      setTagIntensities(() => {
        const next: Record<string, number> = {}
        for (const t of log.tags!) {
          if (t.intensity !== undefined) next[t.tagId] = t.intensity
        }
        return next
      })
    } else {
      setSelectedTags(new Set())
      setTagIntensities({})
    }
    setNoTags(log?.noTags ?? false)
    setMcSaved(false)
    setSaveError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, project.mode, existingMultiChoiceLog?.updatedAt])

  const activeOptions = useMemo(() => {
    if (project.config.kind !== 'daily-multi-choice') return []
    return (project.config as LabDailyMultiChoiceProjectConfig).options.filter((o) => !o.archived)
  }, [project.config])

  const groupOptions = Array.from(
    new Set(
      projectTags
        .map((t) => t.group?.trim())
        .filter((g): g is string => Boolean(g))
    )
  ).sort((a, b) => a.localeCompare(b))

  const groupDatalistId = `lab-tag-group-suggestions-${project.id}`

  const closeNewTagDialog = () => {
    setIsAddingTag(false)
    setNewTagName('')
    setNewTagGroup('')
    setNewTagTrackIntensity(false)
    setNewTagIntensityMax(5)
  }

  const handleCreateTag = () => {
    const trimmedName = newTagName.trim()
    if (!trimmedName) return

    const trimmedGroup = newTagGroup.trim() || undefined

    appStore.actions.addLabTag(project.id, {
      name: trimmedName,
      group: trimmedGroup,
      intensity: newTagTrackIntensity
        ? {
            enabled: true,
            min: 1,
            max: newTagIntensityMax,
            step: 1,
            unitLabel: newTagIntensityMax === 5 ? '1–5' : '1–3',
          }
        : undefined,
    })

    // Auto-select the newly created tag (handy when the tag list was empty).
    const after = appStore.getState()
    const created = Object.values(after.lab?.tagsByProject?.[project.id] || {}).find(
      (t) => t.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (created) {
      setSelectedTags((prev) => {
        const next = new Set(prev)
        next.add(created.id)
        return next
      })
      setNoTags(false)
    }

    setNewTagName('')
    setNewTagGroup('')
    setIsAddingTag(false)
    setNewTagTrackIntensity(false)
    setNewTagIntensityMax(5)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCreateTag()
    } else if (e.key === 'Escape') {
      closeNewTagDialog()
    }
  }

  const handleSave = () => {
    setSaveError(null)

    const tags: LabTagUse[] = Array.from(selectedTags).map((tagId) => {
      const intensity = tagIntensities[tagId]
      return { tagId, intensity }
    })

    for (const tagUse of tags) {
      const tagDef = projectTags.find((t) => t.id === tagUse.tagId)
      if (!tagDef) continue
      const res = appStore.selectors.validateLabTagIntensity(tagDef, tagUse.intensity)
      if (!res.valid) {
        setSaveError(`"${formatTagNameDisplay(tagDef.name)}": ${res.error}`)
        return
      }
    }

    if (project.mode === 'daily' && project.config.kind === 'daily') {
      // Parse additional outcomes
      const addOutcomesParsed: Record<string, number> = {}
      const aoDefs = (project.config as LabDailyProjectConfig).additionalOutcomes || []
      for (const def of aoDefs) {
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

      appStore.actions.setLabDailyLog(project.id, date, {
        outcome: outcome !== '' ? Number(outcome) : undefined,
        additionalOutcomes: Object.keys(addOutcomesParsed).length > 0 ? addOutcomesParsed : undefined,
        tags,
        noTags: noTags && tags.length === 0,
        note: dailyNote.trim() ? dailyNote.trim() : undefined,
      })
    } else if (project.mode === 'event') {
      const severityCfg = project.config.kind === 'event' ? project.config.event.severity : undefined
      const severityEnabled = Boolean(severityCfg?.enabled)
      const severityRequired = Boolean(severityCfg?.enabled && severityCfg?.required)
      const severity = eventSeverity.trim() ? Number(eventSeverity) : undefined

      if (severityRequired && severity === undefined) {
        alert('Severity is required for this project.')
        return
      }

      appStore.actions.addLabEventLog(project.id, {
        timestamp: new Date().toISOString(),
        severity: severityEnabled ? severity : undefined,
        tags,
        note: eventNote.trim() || undefined,
      })
      // Reset form after logging event
      setSelectedTags(new Set())
      setEventNote('')
      setEventSeverity('')
      setTagIntensities({})
    }

    onToggle()
  }

  const handleSaveTagOnly = () => {
    setSaveError(null)

    const tags: LabTagUse[] = Array.from(selectedTags).map((tagId) => {
      const intensity = tagIntensities[tagId]
      return { tagId, intensity }
    })

    for (const tagUse of tags) {
      const tagDef = projectTags.find((t) => t.id === tagUse.tagId)
      if (!tagDef) continue
      const res = appStore.selectors.validateLabTagIntensity(tagDef, tagUse.intensity)
      if (!res.valid) {
        setSaveError(`"${formatTagNameDisplay(tagDef.name)}": ${res.error}`)
        return
      }
    }

    appStore.actions.setLabDailyLog(project.id, date, {
      outcome: undefined,
      tags,
      noTags: noTags && tags.length === 0 ? true : undefined,
      note: dailyNote.trim() || undefined,
    })

    onToggle()
  }

  const handleClearTagOnly = () => {
    if (!existingLog) return
    appStore.actions.deleteLabDailyLog(project.id, date)
    setSelectedTags(new Set())
    setTagIntensities({})
    setNoTags(false)
    setDailyNote('')
    setTagOnlySaved(false)
  }

  const handleSaveMultiChoice = () => {
    setSaveError(null)

    const mcConfig = project.config as LabDailyMultiChoiceProjectConfig
    const mcTagsOn = mcConfig.tagsEnabled === true

    // Build tags if enabled
    let tags: LabTagUse[] | undefined
    if (mcTagsOn && selectedTags.size > 0) {
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

    appStore.actions.setLabMultiChoiceLog(project.id, date, {
      selectedOptionIds: Array.from(mcSelectedOptionIds),
      tags,
      noTags: mcTagsOn && noTags ? true : undefined,
      note: mcNote.trim() || undefined,
    })

    onToggle()
  }

  const handleClearMultiChoice = () => {
    if (!existingMultiChoiceLog) return
    appStore.actions.deleteLabMultiChoiceLog(project.id, date)
    setMcSelectedOptionIds(new Set())
    setMcNote('')
    setSelectedTags(new Set())
    setTagIntensities({})
    setNoTags(false)
    setMcSaved(false)
  }

  const toggleMcOption = (optionId: string) => {
    const isSingleSelect = project.config.kind === 'daily-multi-choice'
      && (project.config as LabDailyMultiChoiceProjectConfig).selectionMode === 'single'
    if (isSingleSelect) {
      setMcSelectedOptionIds((prev) => (prev.has(optionId) ? new Set() : new Set([optionId])))
    } else {
      setMcSelectedOptionIds((prev) => {
        const next = new Set(prev)
        if (next.has(optionId)) next.delete(optionId)
        else next.add(optionId)
        return next
      })
    }
  }

  if (!isExpanded) {
    return (
      <div className={styles.projectRow}>
        <button className={styles.projectButton} onClick={onToggle}>
          <span className={styles.projectName}>
            {project.name}
          </span>
          {hasLog && <span className={styles.badge}>✓</span>}
        </button>
      </div>
    )
  }

  if (project.mode === 'daily' && project.config.kind === 'daily') {
    const { outcome: outcomeConfig } = project.config
    const showTags = project.config.tagsEnabled !== false

    return (
      <div className={styles.projectExpanded}>
        <div className={styles.header}>
          <span className={styles.projectName}>{project.name}</span>
          <button className={styles.closeButton} onClick={onToggle}>
            ✕
          </button>
        </div>

        <div className={styles.form}>
          {saveError && (
            <div className={styles.tagEmptyHint} role="alert">
              {saveError}
            </div>
          )}
          <div className={styles.sliderSection}>
            <div className={styles.sliderHeader}>
              <span className={styles.label}>{outcomeConfig.name}</span>
              <span className={styles.sliderValue}>{outcome}</span>
            </div>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                className={styles.slider}
                value={outcome || outcomeConfig.scale.min}
                onChange={(e) => setOutcome(e.target.value)}
                min={outcomeConfig.scale.min}
                max={outcomeConfig.scale.max}
                step={outcomeConfig.scale.step || 1}
              />
              <div className={styles.sliderLabels}>
                <span>{outcomeConfig.scale.min}</span>
                <span>{outcomeConfig.scale.max}</span>
              </div>
            </div>
          </div>

          {(project.config as LabDailyProjectConfig).additionalOutcomes?.map((def) => (
            <div key={def.id} className={styles.sliderSection}>
              <div className={styles.sliderHeader}>
                <span className={styles.label}>{def.name}</span>
                <span className={styles.sliderValue}>{additionalOutcomes[def.id] ?? ''}</span>
              </div>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  className={styles.slider}
                  value={additionalOutcomes[def.id] || String(def.scale.min)}
                  onChange={(e) => setAdditionalOutcomes(prev => ({ ...prev, [def.id]: e.target.value }))}
                  min={def.scale.min}
                  max={def.scale.max}
                  step={def.scale.step || 1}
                />
                <div className={styles.sliderLabels}>
                  <span>{def.scale.min}</span>
                  <span>{def.scale.max}</span>
                </div>
              </div>
            </div>
          ))}

          {showTags && (
            <>
              <div className={styles.tagsSection}>
                <div className={styles.label}>Tags</div>
                <div className={styles.tagGrid}>
                  {projectTags.length === 0 && (
                    <div className={styles.tagEmptyHint}>No tags yet — add your first tag.</div>
                  )}

                  {projectTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={[
                        styles.tagButton,
                        selectedTags.has(tag.id) && styles.tagButtonActive,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        const next = new Set(selectedTags)
                        if (selectedTags.has(tag.id)) {
                          next.delete(tag.id)
                          setTagIntensities((prev) => {
                            const copy = { ...prev }
                            delete copy[tag.id]
                            return copy
                          })
                        } else {
                          next.add(tag.id)
                          setNoTags(false)
                        }
                        setSelectedTags(next)
                      }}
                    >
                      {formatTagNameDisplay(tag.name)}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={styles.tagAddButton}
                    onClick={() => setIsAddingTag(true)}
                  >
                    + Pievienot jaunu
                  </button>
                </div>
              </div>

              {selectedIntensityTags.length > 0 && (
                <div className={styles.intensityList}>
                  <div className={styles.label}>Intensity</div>
                  {selectedIntensityTags.map((tag) => (
                    <div key={tag.id} className={styles.intensityRow}>
                      <div className={styles.intensityName}>{formatTagNameDisplay(tag.name)}</div>
                      <IntensityPicker
                        min={tag.intensity?.min ?? 1}
                        max={tag.intensity?.max ?? 5}
                        step={tag.intensity?.step ?? 1}
                        value={tagIntensities[tag.id]}
                        onChange={(next) =>
                          setTagIntensities((prev) => ({
                            ...prev,
                            [tag.id]: next,
                          }))
                        }
                        ariaLabel={`Intensity for ${formatTagNameDisplay(tag.name)}`}
                      />
                      {tag.intensity?.unitLabel && (
                        <span className={styles.intensityUnit}>{tag.intensity.unitLabel}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {project.config.allowExplicitNoTags && (
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={noTags}
                    onChange={(e) => {
                      setNoTags(e.target.checked)
                      if (e.target.checked) {
                        setSelectedTags(new Set())
                      }
                    }}
                  />
                  No tags today
                </label>
              )}
            </>
          )}

          <label className={styles.label}>
            Note (optional)
            <textarea
              className={styles.textarea}
              value={dailyNote}
              onChange={(e) => setDailyNote(e.target.value)}
              rows={2}
              placeholder="Anything worth noting about today…"
            />
          </label>

          <Dialog open={isAddingTag} title="New tag" onClose={closeNewTagDialog}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCreateTag()
              }}
            >
              <DialogBody>
                <label className={styles.label}>
                  Tag name
                  <input
                    type="text"
                    className={styles.input}
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Tag name..."
                    autoFocus
                    required
                  />
                </label>

                <label className={styles.label}>
                  Group (optional)
                  <input
                    type="text"
                    className={styles.input}
                    value={newTagGroup}
                    onChange={(e) => setNewTagGroup(e.target.value)}
                    list={groupDatalistId}
                    placeholder="e.g., sleep, food, training"
                  />
                  {groupOptions.length > 0 ? (
                    <datalist id={groupDatalistId}>
                      {groupOptions.map((g) => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  ) : null}
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={newTagTrackIntensity}
                    onChange={(e) => setNewTagTrackIntensity(e.target.checked)}
                  />
                  Track intensity
                </label>

                {newTagTrackIntensity && (
                  <label className={styles.label}>
                    Intensity scale
                    <select
                      className={styles.input}
                      value={String(newTagIntensityMax)}
                      onChange={(e) => setNewTagIntensityMax(Number(e.target.value) as 3 | 5)}
                    >
                      <option value="3">1–3</option>
                      <option value="5">1–5</option>
                    </select>
                  </label>
                )}
              </DialogBody>

              <DialogFooter>
                <button type="button" className={sharedStyles.smallBtn} onClick={closeNewTagDialog}>
                  Cancel
                </button>
                <button type="submit" className={sharedStyles.smallBtn} disabled={!newTagName.trim()}>
                  Create
                </button>
              </DialogFooter>
            </form>
          </Dialog>

          {hasLog && existingLog?.updatedAt ? (
            <div className={styles.savedHint}>
              Last saved: {new Date(existingLog.updatedAt).toLocaleString()}
            </div>
          ) : null}

          <button className={styles.saveButton} onClick={handleSave}>
            {hasLog ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  if (project.mode === 'daily-tag-only' && project.config.kind === 'daily-tag-only') {
    const tagOnlyConfig = project.config as LabDailyTagOnlyProjectConfig
    return (
      <div className={styles.projectExpanded}>
        <div className={styles.header}>
          <span className={styles.projectName}>{project.name}</span>
          <button className={styles.closeButton} onClick={onToggle}>
            ✕
          </button>
        </div>
        <div className={styles.form}>
          {saveError && (
            <div className={styles.tagEmptyHint} role="alert">
              {saveError}
            </div>
          )}

          <div className={styles.tagsSection}>
            <div className={styles.label}>Tags</div>
            <div className={styles.tagGrid}>
              {projectTags.length === 0 && (
                <div className={styles.tagEmptyHint}>No tags yet — add your first tag.</div>
              )}

              {projectTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={[
                    styles.tagButton,
                    selectedTags.has(tag.id) && styles.tagButtonActive,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    const next = new Set(selectedTags)
                    if (selectedTags.has(tag.id)) {
                      next.delete(tag.id)
                      setTagIntensities((prev) => {
                        const copy = { ...prev }
                        delete copy[tag.id]
                        return copy
                      })
                      setNoTags(false)
                    } else {
                      next.add(tag.id)
                      setNoTags(false)
                    }
                    setSelectedTags(next)
                  }}
                >
                  {formatTagNameDisplay(tag.name)}
                </button>
              ))}

              <button
                type="button"
                className={styles.tagAddButton}
                onClick={() => setIsAddingTag(true)}
              >
                + Add tag
              </button>
            </div>

            {tagOnlyConfig.allowExplicitNoTags && (
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={noTags}
                  onChange={(e) => {
                    setNoTags(e.target.checked)
                    if (e.target.checked) {
                      setSelectedTags(new Set())
                      setTagIntensities({})
                    }
                  }}
                />
                No tags today
              </label>
            )}

            {selectedIntensityTags.length > 0 && (
              <div className={styles.intensityList}>
                <div className={styles.label}>Intensity</div>
                {selectedIntensityTags.map((tag) => (
                  <div key={tag.id} className={styles.intensityRow}>
                    <div className={styles.intensityName}>{formatTagNameDisplay(tag.name)}</div>
                    <IntensityPicker
                      min={tag.intensity?.min ?? 1}
                      max={tag.intensity?.max ?? 5}
                      step={tag.intensity?.step ?? 1}
                      value={tagIntensities[tag.id]}
                      onChange={(next) =>
                        setTagIntensities((prev) => ({
                          ...prev,
                          [tag.id]: next,
                        }))
                      }
                      ariaLabel={`Intensity for ${formatTagNameDisplay(tag.name)}`}
                    />
                    {tag.intensity?.unitLabel && (
                      <span className={styles.intensityUnit}>{tag.intensity.unitLabel}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className={styles.label}>
            Note (optional)
            <textarea
              className={styles.textarea}
              value={dailyNote}
              onChange={(e) => setDailyNote(e.target.value)}
              rows={2}
              placeholder="Additional details..."
            />
          </label>

          <Dialog open={isAddingTag} title="New tag" onClose={closeNewTagDialog}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCreateTag()
              }}
            >
              <DialogBody>
                <label className={styles.label}>
                  Tag name
                  <input
                    type="text"
                    className={styles.input}
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="New tag..."
                    autoFocus
                    required
                  />
                </label>

                <label className={styles.label}>
                  Group (optional)
                  <input
                    type="text"
                    className={styles.input}
                    value={newTagGroup}
                    onChange={(e) => setNewTagGroup(e.target.value)}
                    list={groupDatalistId}
                    placeholder="e.g., sleep, food, training"
                  />
                  {groupOptions.length > 0 ? (
                    <datalist id={groupDatalistId}>
                      {groupOptions.map((g) => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  ) : null}
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={newTagTrackIntensity}
                    onChange={(e) => setNewTagTrackIntensity(e.target.checked)}
                  />
                  Track intensity
                </label>

                {newTagTrackIntensity && (
                  <label className={styles.label}>
                    Intensity scale
                    <select
                      className={styles.input}
                      value={String(newTagIntensityMax)}
                      onChange={(e) => setNewTagIntensityMax(Number(e.target.value) as 3 | 5)}
                    >
                      <option value="3">1–3</option>
                      <option value="5">1–5</option>
                    </select>
                  </label>
                )}
              </DialogBody>

              <DialogFooter>
                <button type="button" className={sharedStyles.smallBtn} onClick={closeNewTagDialog}>
                  Cancel
                </button>
                <button type="submit" className={sharedStyles.smallBtn} disabled={!newTagName.trim()}>
                  Create
                </button>
              </DialogFooter>
            </form>
          </Dialog>

          {existingLog?.updatedAt ? (
            <div className={styles.savedHint}>
              Last saved: {new Date(existingLog.updatedAt).toLocaleString()}
            </div>
          ) : null}

          <div className={styles.formActions}>
            <button className={styles.saveButton} onClick={handleSaveTagOnly}>
              {existingLog ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (project.mode === 'daily-multi-choice' && project.config.kind === 'daily-multi-choice') {
    const mcConfig = project.config as LabDailyMultiChoiceProjectConfig
    const isSingleSelect = mcConfig.selectionMode === 'single'
    const mcTagsOn = mcConfig.tagsEnabled === true
    const mcShowTags = mcTagsOn && projectTags.length > 0

    // Choice-dependent tag filtering
    const allLogs = state.lab?.multiChoiceLogsByProject[project.id] ?? {}
    const tagBanks: Record<string, Set<string>> | null = mcConfig.choiceDependentTags
      ? (() => {
          const banks: Record<string, Set<string>> = {}
          for (const log of Object.values(allLogs)) {
            if (!log.tags || log.tags.length === 0) continue
            for (const optId of log.selectedOptionIds) {
              if (!banks[optId]) banks[optId] = new Set()
              for (const t of log.tags) banks[optId].add(t.tagId)
            }
          }
          return banks
        })()
      : null

    // All tag IDs that have appeared in ANY historical log for this project
    const allBankedTagIds: Set<string> | null = tagBanks
      ? (() => {
          const ids = new Set<string>()
          for (const bank of Object.values(tagBanks)) {
            for (const tid of bank) ids.add(tid)
          }
          return ids
        })()
      : null

    const visibleTagIds: Set<string> | null = (() => {
      if (!tagBanks) return null
      if (mcSelectedOptionIds.size === 0) return new Set<string>()
      const hasAnyHistory = Array.from(mcSelectedOptionIds).some((id) => tagBanks[id])
      if (!hasAnyHistory) return null
      const ids = new Set<string>()
      for (const optId of mcSelectedOptionIds) {
        const bank = tagBanks[optId]
        if (bank) for (const tid of bank) ids.add(tid)
      }
      // Include newly created tags (not yet in any log) so they remain visible
      for (const t of projectTags) {
        if (!allBankedTagIds!.has(t.id)) ids.add(t.id)
      }
      return ids
    })()

    const mcDisplayTags = visibleTagIds
      ? projectTags.filter((t) => visibleTagIds.has(t.id))
      : projectTags

    const mcShouldShowTags = mcShowTags && (!mcConfig.choiceDependentTags || mcSelectedOptionIds.size > 0)

    return (
      <div className={styles.projectExpanded}>
        <div className={styles.header}>
          <span className={styles.projectName}>{project.name}</span>
          <button className={styles.closeButton} onClick={onToggle}>
            ✕
          </button>
        </div>
        <div className={styles.form}>
          {saveError && (
            <div className={styles.tagEmptyHint} role="alert">
              {saveError}
            </div>
          )}

          {activeOptions.length === 0 ? (
            <div className={styles.tagEmptyHint}>
              All options are archived. Edit the project to add new options.
            </div>
          ) : (
            <div className={styles.choicesSection}>
              <div className={styles.choicesTitle}>
                {isSingleSelect ? 'Select one' : 'Select all that apply'}
              </div>
              <div className={styles.choicesList}>
                {activeOptions.map((option) => {
                  const isSelected = mcSelectedOptionIds.has(option.id)
                  return (
                    <label
                      key={option.id}
                      className={[
                        styles.choiceLabel,
                        isSelected && styles.choiceLabelSelected,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <input
                        type={isSingleSelect ? 'radio' : 'checkbox'}
                        name={`mc-${project.id}-${date}`}
                        checked={isSelected}
                        onChange={() => {
                          if (!isSingleSelect) toggleMcOption(option.id)
                        }}
                        onClick={() => {
                          if (isSingleSelect) toggleMcOption(option.id)
                        }}
                      />
                      {option.label}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tags (when enabled) */}
          {mcTagsOn && projectTags.length === 0 && (
            <div className={styles.tagsSection}>
              <div className={styles.label}>Tags</div>
              <div className={styles.tagGrid}>
                <button
                  type="button"
                  className={styles.tagAddButton}
                  onClick={() => setIsAddingTag(true)}
                >
                  + Add tag
                </button>
              </div>
            </div>
          )}
          {mcShouldShowTags && (
            <>
              <div className={styles.tagsSection}>
                <div className={styles.label}>Tags</div>
                <div className={styles.tagGrid}>
                  {mcDisplayTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={[
                        styles.tagButton,
                        selectedTags.has(tag.id) && styles.tagButtonActive,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        const next = new Set(selectedTags)
                        if (selectedTags.has(tag.id)) {
                          next.delete(tag.id)
                          setTagIntensities((prev) => {
                            const copy = { ...prev }
                            delete copy[tag.id]
                            return copy
                          })
                        } else {
                          next.add(tag.id)
                          setNoTags(false)
                        }
                        setSelectedTags(next)
                      }}
                    >
                      {formatTagNameDisplay(tag.name)}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={styles.tagAddButton}
                    onClick={() => setIsAddingTag(true)}
                  >
                    + Add tag
                  </button>
                </div>
              </div>

              {selectedIntensityTags.length > 0 && (
                <div className={styles.intensityList}>
                  <div className={styles.label}>Intensity</div>
                  {selectedIntensityTags.map((tag) => (
                    <div key={tag.id} className={styles.intensityRow}>
                      <div className={styles.intensityName}>{formatTagNameDisplay(tag.name)}</div>
                      <IntensityPicker
                        min={tag.intensity?.min ?? 1}
                        max={tag.intensity?.max ?? 5}
                        step={tag.intensity?.step ?? 1}
                        value={tagIntensities[tag.id]}
                        onChange={(next) =>
                          setTagIntensities((prev) => ({
                            ...prev,
                            [tag.id]: next,
                          }))
                        }
                        ariaLabel={`Intensity for ${formatTagNameDisplay(tag.name)}`}
                      />
                      {tag.intensity?.unitLabel && (
                        <span className={styles.intensityUnit}>{tag.intensity.unitLabel}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mcConfig.allowExplicitNoTags && (
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={noTags}
                    onChange={(e) => {
                      setNoTags(e.target.checked)
                      if (e.target.checked) {
                        setSelectedTags(new Set())
                        setTagIntensities({})
                      }
                    }}
                  />
                  No tags today
                </label>
              )}
            </>
          )}

          <Dialog open={isAddingTag} title="New tag" onClose={closeNewTagDialog}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCreateTag()
              }}
            >
              <DialogBody>
                <label className={styles.label}>
                  Tag name
                  <input
                    type="text"
                    className={styles.input}
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="New tag..."
                    autoFocus
                    required
                  />
                </label>

                <label className={styles.label}>
                  Group (optional)
                  <input
                    type="text"
                    className={styles.input}
                    value={newTagGroup}
                    onChange={(e) => setNewTagGroup(e.target.value)}
                    list={groupDatalistId}
                    placeholder="e.g., sleep, food, training"
                  />
                  {groupOptions.length > 0 ? (
                    <datalist id={groupDatalistId}>
                      {groupOptions.map((g) => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  ) : null}
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={newTagTrackIntensity}
                    onChange={(e) => setNewTagTrackIntensity(e.target.checked)}
                  />
                  Track intensity
                </label>

                {newTagTrackIntensity && (
                  <label className={styles.label}>
                    Intensity scale
                    <select
                      className={styles.input}
                      value={String(newTagIntensityMax)}
                      onChange={(e) => setNewTagIntensityMax(Number(e.target.value) as 3 | 5)}
                    >
                      <option value="3">1–3</option>
                      <option value="5">1–5</option>
                    </select>
                  </label>
                )}
              </DialogBody>

              <DialogFooter>
                <button type="button" className={sharedStyles.smallBtn} onClick={closeNewTagDialog}>
                  Cancel
                </button>
                <button type="submit" className={sharedStyles.smallBtn} disabled={!newTagName.trim()}>
                  Create
                </button>
              </DialogFooter>
            </form>
          </Dialog>

          <label className={styles.label}>
            Note (optional)
            <textarea
              className={styles.textarea}
              value={mcNote}
              onChange={(e) => setMcNote(e.target.value)}
              rows={2}
              placeholder="Additional details..."
            />
          </label>

          {existingMultiChoiceLog?.updatedAt ? (
            <div className={styles.savedHint}>
              Last saved: {new Date(existingMultiChoiceLog.updatedAt).toLocaleString()}
            </div>
          ) : null}

          <div className={styles.formActions}>
            <button className={styles.saveButton} onClick={handleSaveMultiChoice}>
              {existingMultiChoiceLog ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (project.mode === 'event' && project.config.kind === 'event') {
    const severityCfg = project.config.event.severity
    const severityEnabled = Boolean(severityCfg?.enabled)
    const severityRequired = Boolean(severityCfg?.enabled && severityCfg?.required)
    const severityScale = severityCfg?.scale || { min: 1, max: 10, step: 1 }

    return (
      <div className={styles.projectExpanded}>
        <div className={styles.header}>
          <span className={styles.projectName}>{project.name}</span>
          <button className={styles.closeButton} onClick={onToggle}>
            ✕
          </button>
        </div>

        <div className={styles.form}>
          {saveError && (
            <div className={styles.tagEmptyHint} role="alert">
              {saveError}
            </div>
          )}
          {severityEnabled && (
            <label className={styles.label}>
              Severity {severityRequired ? '(required)' : '(optional)'}
              <input
                type="number"
                className={styles.input}
                value={eventSeverity}
                onChange={(e) => setEventSeverity(e.target.value)}
                min={severityScale.min}
                max={severityScale.max}
                step={severityScale.step || 1}
                placeholder={`${severityScale.min}–${severityScale.max}`}
              />
            </label>
          )}

          <div className={styles.tagsSection}>
            <div className={styles.label}>Tags</div>
            <div className={styles.tagGrid}>
              {projectTags.length === 0 && (
                <div className={styles.tagEmptyHint}>No tags yet — add your first tag.</div>
              )}

              {projectTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={[
                    styles.tagButton,
                    selectedTags.has(tag.id) && styles.tagButtonActive,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    const next = new Set(selectedTags)
                    if (selectedTags.has(tag.id)) {
                      next.delete(tag.id)
                      setTagIntensities((prev) => {
                        const copy = { ...prev }
                        delete copy[tag.id]
                        return copy
                      })
                    } else {
                      next.add(tag.id)
                    }
                    setSelectedTags(next)
                  }}
                >
                  {formatTagNameDisplay(tag.name)}
                </button>
              ))}

              <button
                type="button"
                className={styles.tagAddButton}
                onClick={() => setIsAddingTag(true)}
              >
                + Add tag
              </button>
            </div>

            {selectedIntensityTags.length > 0 && (
              <div className={styles.intensityList}>
                <div className={styles.label}>Intensity</div>
                {selectedIntensityTags.map((tag) => (
                  <div key={tag.id} className={styles.intensityRow}>
                    <div className={styles.intensityName}>{formatTagNameDisplay(tag.name)}</div>
                    <IntensityPicker
                      min={tag.intensity?.min ?? 1}
                      max={tag.intensity?.max ?? 5}
                      step={tag.intensity?.step ?? 1}
                      value={tagIntensities[tag.id]}
                      onChange={(next) =>
                        setTagIntensities((prev) => ({
                          ...prev,
                          [tag.id]: next,
                        }))
                      }
                      ariaLabel={`Intensity for ${formatTagNameDisplay(tag.name)}`}
                    />
                    {tag.intensity?.unitLabel && (
                      <span className={styles.intensityUnit}>{tag.intensity.unitLabel}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className={styles.label}>
            Note (optional)
            <textarea
              className={styles.textarea}
              value={eventNote}
              onChange={(e) => setEventNote(e.target.value)}
              rows={2}
              placeholder="Additional details..."
            />
          </label>

          <Dialog open={isAddingTag} title="New tag" onClose={closeNewTagDialog}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleCreateTag()
              }}
            >
              <DialogBody>
                <label className={styles.label}>
                  Tag name
                  <input
                    type="text"
                    className={styles.input}
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="New tag..."
                    autoFocus
                    required
                  />
                </label>

                <label className={styles.label}>
                  Group (optional)
                  <input
                    type="text"
                    className={styles.input}
                    value={newTagGroup}
                    onChange={(e) => setNewTagGroup(e.target.value)}
                    list={groupDatalistId}
                    placeholder="e.g., sleep, food, training"
                  />
                  {groupOptions.length > 0 ? (
                    <datalist id={groupDatalistId}>
                      {groupOptions.map((g) => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  ) : null}
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={newTagTrackIntensity}
                    onChange={(e) => setNewTagTrackIntensity(e.target.checked)}
                  />
                  Track intensity
                </label>

                {newTagTrackIntensity && (
                  <label className={styles.label}>
                    Intensity scale
                    <select
                      className={styles.input}
                      value={String(newTagIntensityMax)}
                      onChange={(e) => setNewTagIntensityMax(Number(e.target.value) as 3 | 5)}
                    >
                      <option value="3">1–3</option>
                      <option value="5">1–5</option>
                    </select>
                  </label>
                )}
              </DialogBody>

              <DialogFooter>
                <button type="button" className={sharedStyles.smallBtn} onClick={closeNewTagDialog}>
                  Cancel
                </button>
                <button type="submit" className={sharedStyles.smallBtn} disabled={!newTagName.trim()}>
                  Create
                </button>
              </DialogFooter>
            </form>
          </Dialog>

          <button className={styles.saveButton} onClick={handleSave}>
            Log Event
          </button>
        </div>
      </div>
    )
  }

  return null
}
