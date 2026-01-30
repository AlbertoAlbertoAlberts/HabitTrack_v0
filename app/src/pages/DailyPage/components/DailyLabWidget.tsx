import { useEffect, useState } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import type { LabProject, LabTagUse } from '../../../domain/types'
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

  const projects = Object.values(state.lab?.projects || {}).filter((p) => !p.archived)

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
  const existingLog = project.mode === 'daily'
    ? state.lab?.dailyLogsByProject[project.id]?.[date]
    : null

  const [outcome, setOutcome] = useState(existingLog?.outcome?.toString() || '')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(existingLog?.tags.map((t) => t.tagId) || [])
  )
  const [noTags, setNoTags] = useState(existingLog?.noTags || false)
  const [dailyNote, setDailyNote] = useState(existingLog?.note || '')
  const [eventNote, setEventNote] = useState('')
  const [eventSeverity, setEventSeverity] = useState('')
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

  const projectTags = Object.values(state.lab?.tagsByProject[project.id] || {})
  const selectedIntensityTags = projectTags.filter((t) => selectedTags.has(t.id) && t.intensity?.enabled)
  const hasLog = !!existingLog

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
    setTagIntensities(() => {
      const next: Record<string, number> = {}
      for (const t of log?.tags || []) {
        if (t.intensity !== undefined) next[t.tagId] = t.intensity
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, project.mode, existingLog?.updatedAt])

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
      appStore.actions.setLabDailyLog(project.id, date, {
        outcome: outcome ? Number(outcome) : undefined,
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

  if (!isExpanded) {
    return (
      <div className={styles.projectRow}>
        <button className={styles.projectButton} onClick={onToggle}>
          <span className={styles.projectName}>
            {project.name}
            {project.mode === 'event' && <span className={styles.modeBadge}>event</span>}
          </span>
          {hasLog && <span className={styles.badge}>✓</span>}
        </button>
      </div>
    )
  }

  if (project.mode === 'daily' && project.config.kind === 'daily') {
    const { outcome: outcomeConfig } = project.config

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
