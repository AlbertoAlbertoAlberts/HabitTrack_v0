import { useState } from 'react'
import { Dialog, DialogBody, DialogFooter } from '../../../components/ui/Dialog'
import { useAppStore } from '../../../domain/store/useAppStore'
import type { LabProjectConfig } from '../../../domain/types'
import styles from './ProjectDialog.module.css'

interface ProjectDialogProps {
  open: boolean
  onClose: () => void
  projectId?: string | null
}

export function ProjectDialog({ open, onClose, projectId }: ProjectDialogProps) {
  const store = useAppStore()
  const state = store.getState()
  const existingProject = projectId ? state.lab?.projects[projectId] : null

  const [name, setName] = useState(existingProject?.name || '')
  const [mode, setMode] = useState<'daily' | 'event'>(existingProject?.mode || 'daily')
  
  // Daily config
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

  // Event config
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) return

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

    const config: LabProjectConfig = mode === 'daily' 
      ? {
          kind: 'daily',
          outcome: {
            id: 'outcome',
            name: outcomeName,
            scale: { min: outcomeMin, max: outcomeMax },
            required: true,
          },
          alignment: {
            exposureWindow,
          },
          completion: {
            requireOutcome: true,
            requireAtLeastOneTag: false,
          },
          allowExplicitNoTags: true,
        }
      : {
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

          {!projectId && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Project Type</label>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="mode"
                    value="daily"
                    checked={mode === 'daily'}
                    onChange={() => setMode('daily')}
                  />
                  <span>Daily - Track one outcome per day</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="mode"
                    value="event"
                    checked={mode === 'event'}
                    onChange={() => setMode('event')}
                  />
                  <span>Event - Log sporadic occurrences</span>
                </label>
              </div>
            </div>
          )}

          {mode === 'daily' && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="outcome-name">
                  Outcome Name
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
            </>
          )}

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
          <button type="submit" className={styles.btnPrimary} disabled={!name.trim()}>
            {projectId ? 'Save' : 'Create'}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
