import { useState } from 'react'
import { Dialog, DialogBody, DialogFooter } from '../../../components/ui/Dialog'
import { useAppStore } from '../../../domain/store/useAppStore'
import type { LabProjectConfig, LabProjectMode, LabMultiChoiceOption, LabOutcomeDef } from '../../../domain/types'
import { generateId } from '../../../domain/utils/generateId'
import styles from './ProjectDialog.module.css'

interface ProjectDialogProps {
  open: boolean
  onClose: () => void
  projectId?: string | null
}

const MODE_OPTIONS: { value: LabProjectMode; label: string; description: string }[] = [
  { value: 'daily', label: 'Daily – Track outcome', description: 'Rate one or more outcomes per day with optional tags' },
  { value: 'daily-tag-only', label: 'Daily – Tag only', description: 'Log tags each day without a numeric outcome' },
  { value: 'daily-multi-choice', label: 'Daily – Multiple-choice', description: 'Pick from user-defined choices each day' },
  { value: 'event', label: 'Event', description: 'Log sporadic occurrences with optional severity' },
]

export function ProjectDialog({ open, onClose, projectId }: ProjectDialogProps) {
  const store = useAppStore()
  const state = store.getState()
  const existingProject = projectId ? state.lab?.projects[projectId] : null

  const [name, setName] = useState(existingProject?.name || '')
  const [mode, setMode] = useState<LabProjectMode>(
    existingProject?.mode ?? 'daily'
  )

  // --- Daily (Track outcome) config ---
  const [outcomeName, setOutcomeName] = useState(
    existingProject?.config.kind === 'daily' ? existingProject.config.outcome.name : 'Wellbeing'
  )
  const [outcomeMin, setOutcomeMin] = useState(
    existingProject?.config.kind === 'daily' ? existingProject.config.outcome.scale.min : 1
  )
  const [outcomeMax, setOutcomeMax] = useState(
    existingProject?.config.kind === 'daily' ? existingProject.config.outcome.scale.max : 10
  )
  const [exposureWindow, setExposureWindow] = useState<'sameDay' | 'previousEvening'>(
    existingProject?.config.kind === 'daily' ? existingProject.config.alignment.exposureWindow : 'previousEvening'
  )
  const [tagsEnabled, setTagsEnabled] = useState(
    existingProject?.config.kind === 'daily' ? (existingProject.config.tagsEnabled !== false) : true
  )
  const [additionalOutcomes, setAdditionalOutcomes] = useState<LabOutcomeDef[]>(
    existingProject?.config.kind === 'daily' ? (existingProject.config.additionalOutcomes ?? []) : []
  )

  // --- Tag-only config ---
  const [requireAtLeastOneTag, setRequireAtLeastOneTag] = useState(
    existingProject?.config.kind === 'daily-tag-only' ? existingProject.config.completion.requireAtLeastOneTag : false
  )
  const [tagOnlyAllowExplicitNoTags, setTagOnlyAllowExplicitNoTags] = useState(
    existingProject?.config.kind === 'daily-tag-only' ? (existingProject.config.allowExplicitNoTags ?? false) : false
  )

  // --- Multi-choice config ---
  const [selectionMode, setSelectionMode] = useState<'single' | 'multiple'>(
    existingProject?.config.kind === 'daily-multi-choice' ? existingProject.config.selectionMode : 'single'
  )
  const [mcOptions, setMcOptions] = useState<LabMultiChoiceOption[]>(
    existingProject?.config.kind === 'daily-multi-choice'
      ? existingProject.config.options
      : [
          { id: generateId(), label: '', createdAt: new Date().toISOString() },
          { id: generateId(), label: '', createdAt: new Date().toISOString() },
        ]
  )
  const [mcRequireChoice, setMcRequireChoice] = useState(
    existingProject?.config.kind === 'daily-multi-choice' ? existingProject.config.completion.requireAtLeastOneChoice : true
  )

  // --- Event config ---
  const [eventName, setEventName] = useState(
    existingProject?.config.kind === 'event' ? existingProject.config.event.name : 'Episode'
  )
  const [eventSeverityEnabled, setEventSeverityEnabled] = useState(
    existingProject?.config.kind === 'event' ? Boolean(existingProject.config.event.severity?.enabled) : false
  )
  const [eventSeverityRequired, setEventSeverityRequired] = useState(
    existingProject?.config.kind === 'event' ? Boolean(existingProject.config.event.severity?.required) : false
  )
  const existingSeverityScale =
    existingProject?.config.kind === 'event' ? existingProject.config.event.severity?.scale : undefined
  const [eventSeverityMin, setEventSeverityMin] = useState(existingSeverityScale?.min ?? 1)
  const [eventSeverityMax, setEventSeverityMax] = useState(existingSeverityScale?.max ?? 10)
  const [eventSeverityStep, setEventSeverityStep] = useState(existingSeverityScale?.step ?? 1)

  // --- Additional outcomes helpers ---
  const addOutcome = () => {
    setAdditionalOutcomes(prev => [
      ...prev,
      { id: `outcome_${Date.now()}`, name: '', scale: { min: outcomeMin, max: outcomeMax } },
    ])
  }

  const updateOutcomeName = (idx: number, newName: string) => {
    setAdditionalOutcomes(prev => prev.map((o, i) => i === idx ? { ...o, name: newName } : o))
  }

  const updateOutcomeScale = (idx: number, field: 'min' | 'max', value: number) => {
    setAdditionalOutcomes(prev => prev.map((o, i) =>
      i === idx ? { ...o, scale: { ...o.scale, [field]: value } } : o
    ))
  }

  const removeOutcome = (idx: number) => {
    setAdditionalOutcomes(prev => prev.filter((_, i) => i !== idx))
  }

  // --- Multi-choice option helpers ---
  const addMcOption = () => {
    setMcOptions(prev => [
      ...prev,
      { id: generateId(), label: '', createdAt: new Date().toISOString() },
    ])
  }

  const updateMcOptionLabel = (idx: number, label: string) => {
    setMcOptions(prev => prev.map((o, i) => i === idx ? { ...o, label } : o))
  }

  const removeMcOption = (idx: number) => {
    const opt = mcOptions[idx]
    // If editing existing project, check if this option has been used (has data).
    // For safety, archive instead of delete when editing.
    if (projectId && existingProject?.config.kind === 'daily-multi-choice') {
      const existingOpt = existingProject.config.options.find(o => o.id === opt.id)
      if (existingOpt) {
        setMcOptions(prev => prev.map((o, i) => i === idx ? { ...o, archived: true } : o))
        return
      }
    }
    setMcOptions(prev => prev.filter((_, i) => i !== idx))
  }

  // --- Validation ---
  const activeMcOptions = mcOptions.filter(o => !o.archived)

  const isFormValid = (): boolean => {
    if (!name.trim()) return false
    if (mode === 'daily-multi-choice') {
      if (activeMcOptions.length < 2) return false
      if (activeMcOptions.some(o => !o.label.trim())) return false
      // Check uniqueness (case-insensitive)
      const labels = new Set<string>()
      for (const o of activeMcOptions) {
        const norm = o.label.trim().toLowerCase()
        if (labels.has(norm)) return false
        labels.add(norm)
      }
    }
    if (mode === 'daily') {
      // Check additional outcome names are non-empty and unique
      const names = new Set<string>()
      for (const o of additionalOutcomes) {
        if (!o.name.trim()) return false
        const norm = o.name.trim().toLowerCase()
        if (names.has(norm)) return false
        names.add(norm)
        if (!o.scale || o.scale.min >= o.scale.max) return false
      }
    }
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isFormValid()) return

    if (mode === 'event' && eventSeverityEnabled) {
      if (!Number.isFinite(eventSeverityMin) || !Number.isFinite(eventSeverityMax) || !Number.isFinite(eventSeverityStep)) {
        return
      }
      if (eventSeverityMin >= eventSeverityMax) {
        alert('Severity scale: min must be less than max.')
        return
      }
      if (eventSeverityStep <= 0) {
        alert('Severity scale: step must be greater than 0.')
        return
      }
      if (eventSeverityStep > eventSeverityMax - eventSeverityMin) {
        alert('Severity scale: step is too large for the selected range.')
        return
      }
    }

    let config: LabProjectConfig

    switch (mode) {
      case 'daily':
        config = {
          kind: 'daily',
          tagsEnabled,
          outcome: {
            id: 'outcome',
            name: outcomeName,
            scale: { min: outcomeMin, max: outcomeMax },
            required: true,
          },
          additionalOutcomes: additionalOutcomes.length > 0 ? additionalOutcomes : undefined,
          alignment: {
            exposureWindow,
          },
          completion: {
            requireOutcome: true,
            requireAtLeastOneTag: false,
          },
          allowExplicitNoTags: true,
        }
        break

      case 'daily-tag-only':
        config = {
          kind: 'daily-tag-only',
          tagsEnabled: true,
          completion: {
            requireAtLeastOneTag,
          },
          allowExplicitNoTags: tagOnlyAllowExplicitNoTags,
        }
        break

      case 'daily-multi-choice':
        config = {
          kind: 'daily-multi-choice',
          selectionMode,
          options: mcOptions,
          completion: {
            requireAtLeastOneChoice: mcRequireChoice,
          },
        }
        break

      case 'event':
        config = {
          kind: 'event',
          event: {
            name: eventName,
            severity: {
              enabled: eventSeverityEnabled,
              scale: eventSeverityEnabled
                ? { min: eventSeverityMin, max: eventSeverityMax, step: eventSeverityStep }
                : undefined,
              required: eventSeverityEnabled ? eventSeverityRequired : false,
            },
          },
          dailyAbsenceMarker: {
            enabled: true,
            labelTemplate: `No {eventName} today`,
          },
          completion: {
            requireAtLeastOneTag: false,
          },
        }
        break
    }

    if (projectId) {
      store.actions.updateLabProject(projectId, { name: name.trim(), config })
    } else {
      store.actions.addLabProject(name.trim(), mode, config)
    }

    onClose()
  }

  const handleClose = () => {
    onClose()
  }

  const dialogKey = `${projectId ?? 'new'}:${open ? 'open' : 'closed'}`

  return (
    <Dialog key={dialogKey} open={open} title={projectId ? 'Edit Project' : 'New Project'} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <DialogBody>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="project-name">
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Wellbeing"
              autoFocus
              required
            />
          </div>

          {/* Mode selector — locked in edit mode */}
          {!projectId ? (
            <div className={styles.formGroup}>
              <label className={styles.label}>Project Type</label>
              <div className={styles.modeGrid}>
                {MODE_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    className={`${styles.modeCard} ${mode === opt.value ? styles.modeCardActive : ''}`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={opt.value}
                      checked={mode === opt.value}
                      onChange={() => setMode(opt.value)}
                      className={styles.modeRadioHidden}
                    />
                    <span className={styles.modeCardLabel}>{opt.label}</span>
                    <span className={styles.modeCardDesc}>{opt.description}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.formGroup}>
              <label className={styles.label}>Project Type</label>
              <div className={styles.lockedMode}>
                {MODE_OPTIONS.find(o => o.value === mode)?.label ?? mode}
              </div>
            </div>
          )}

          {/* =============== Daily – Track outcome =============== */}
          {mode === 'daily' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="outcome-name">
                  Primary Outcome
                </label>
                <input
                  id="outcome-name"
                  type="text"
                  className={styles.input}
                  value={outcomeName}
                  onChange={(e) => setOutcomeName(e.target.value)}
                  placeholder="e.g., Energy Level, Mood"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="outcome-min">
                    Min
                  </label>
                  <input
                    id="outcome-min"
                    type="number"
                    className={styles.input}
                    value={outcomeMin}
                    onChange={(e) => setOutcomeMin(Number(e.target.value))}
                    min={0}
                    max={outcomeMax - 1}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="outcome-max">
                    Max
                  </label>
                  <input
                    id="outcome-max"
                    type="number"
                    className={styles.input}
                    value={outcomeMax}
                    onChange={(e) => setOutcomeMax(Number(e.target.value))}
                    min={outcomeMin + 1}
                    max={100}
                  />
                </div>
              </div>

              {/* Additional outcomes */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Additional Outcomes
                </label>
                {additionalOutcomes.map((ao, idx) => (
                  <div key={ao.id} className={styles.outcomeBlock}>
                    <div className={styles.listRow}>
                      <input
                        type="text"
                        className={styles.input}
                        value={ao.name}
                        onChange={(e) => updateOutcomeName(idx, e.target.value)}
                        placeholder={`Outcome ${idx + 2}`}
                      />
                      <button
                        type="button"
                        className={styles.btnRemove}
                        onClick={() => removeOutcome(idx)}
                        title="Remove outcome"
                      >
                        ×
                      </button>
                    </div>
                    <div className={styles.scaleRow}>
                      <label className={styles.scaleLabel}>Min</label>
                      <input
                        type="number"
                        className={styles.scaleInput}
                        value={ao.scale?.min ?? 1}
                        onChange={(e) => updateOutcomeScale(idx, 'min', Number(e.target.value))}
                      />
                      <label className={styles.scaleLabel}>Max</label>
                      <input
                        type="number"
                        className={styles.scaleInput}
                        value={ao.scale?.max ?? 10}
                        onChange={(e) => updateOutcomeScale(idx, 'max', Number(e.target.value))}
                      />
                    </div>
                  </div>
                ))}
                {additionalOutcomes.length < 10 && (
                  <button type="button" className={styles.btnAdd} onClick={addOutcome}>
                    + Add outcome
                  </button>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="checkbox"
                    checked={tagsEnabled}
                    onChange={(e) => setTagsEnabled(e.target.checked)}
                  />
                  <span>With tags</span>
                </label>
              </div>

              {tagsEnabled && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tag Window</label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="window"
                        value="sameDay"
                        checked={exposureWindow === 'sameDay'}
                        onChange={() => setExposureWindow('sameDay')}
                      />
                      <span>Same day</span>
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="window"
                        value="previousEvening"
                        checked={exposureWindow === 'previousEvening'}
                        onChange={() => setExposureWindow('previousEvening')}
                      />
                      <span>Previous evening</span>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {/* =============== Daily – Tag only =============== */}
          {mode === 'daily-tag-only' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="checkbox"
                    checked={requireAtLeastOneTag}
                    onChange={(e) => setRequireAtLeastOneTag(e.target.checked)}
                  />
                  <span>Require at least one tag per day</span>
                </label>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="checkbox"
                    checked={tagOnlyAllowExplicitNoTags}
                    onChange={(e) => setTagOnlyAllowExplicitNoTags(e.target.checked)}
                  />
                  <span>Allow explicit "No tags today"</span>
                </label>
              </div>
            </>
          )}

          {/* =============== Daily – Multiple-choice =============== */}
          {mode === 'daily-multi-choice' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Selection Mode</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="selectionMode"
                      value="single"
                      checked={selectionMode === 'single'}
                      onChange={() => setSelectionMode('single')}
                    />
                    <span>Single choice</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="selectionMode"
                      value="multiple"
                      checked={selectionMode === 'multiple'}
                      onChange={() => setSelectionMode('multiple')}
                    />
                    <span>Multiple choices</span>
                  </label>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Options
                  <span className={styles.labelHint}> (min 2 required)</span>
                </label>
                {mcOptions.map((opt, idx) =>
                  opt.archived ? null : (
                    <div key={opt.id} className={styles.listRow}>
                      <input
                        type="text"
                        className={styles.input}
                        value={opt.label}
                        onChange={(e) => updateMcOptionLabel(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                      />
                      {activeMcOptions.length > 2 && (
                        <button
                          type="button"
                          className={styles.btnRemove}
                          onClick={() => removeMcOption(idx)}
                          title="Remove option"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                )}
                <button type="button" className={styles.btnAdd} onClick={addMcOption}>
                  + Add option
                </button>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="checkbox"
                    checked={mcRequireChoice}
                    onChange={(e) => setMcRequireChoice(e.target.checked)}
                  />
                  <span>Require at least one choice per day</span>
                </label>
              </div>
            </>
          )}

          {/* =============== Event =============== */}
          {mode === 'event' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="event-name">
                  Event Name
                </label>
                <input
                  id="event-name"
                  type="text"
                  className={styles.input}
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g., Bloating Episode, Headache"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="checkbox"
                    checked={eventSeverityEnabled}
                    onChange={(e) => setEventSeverityEnabled(e.target.checked)}
                  />
                  <span>Track severity</span>
                </label>
                {eventSeverityEnabled && (
                  <>
                    <div className={styles.formRow3} style={{ marginTop: 10 }}>
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.label} htmlFor="event-severity-min">
                          Severity Min
                        </label>
                        <input
                          id="event-severity-min"
                          type="number"
                          className={styles.input}
                          value={eventSeverityMin}
                          onChange={(e) => setEventSeverityMin(Number(e.target.value))}
                        />
                      </div>
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.label} htmlFor="event-severity-max">
                          Severity Max
                        </label>
                        <input
                          id="event-severity-max"
                          type="number"
                          className={styles.input}
                          value={eventSeverityMax}
                          onChange={(e) => setEventSeverityMax(Number(e.target.value))}
                        />
                      </div>
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label className={styles.label} htmlFor="event-severity-step">
                          Step
                        </label>
                        <input
                          id="event-severity-step"
                          type="number"
                          className={styles.input}
                          value={eventSeverityStep}
                          onChange={(e) => setEventSeverityStep(Number(e.target.value))}
                          min={0}
                        />
                      </div>
                    </div>

                    <label className={styles.radioLabel} style={{ marginTop: 10 }}>
                      <input
                        type="checkbox"
                        checked={eventSeverityRequired}
                        onChange={(e) => setEventSeverityRequired(e.target.checked)}
                      />
                      <span>Require severity on each event</span>
                    </label>
                  </>
                )}
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <button type="button" className={styles.btnSecondary} onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={!isFormValid()}>
            {projectId ? 'Save' : 'Create'}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
