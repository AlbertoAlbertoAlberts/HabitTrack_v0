import { useState } from 'react'
import { useAppState } from '../../../domain/store/useAppStore'
import { appStore } from '../../../domain/store/appStore'
import type { LabProject, LabEventLog, LabTagUse } from '../../../domain/types'
import { formatTagNameDisplay } from '../../../domain/lab/utils/tagDisplay'
import { IntensityPicker } from '../../../components/ui/IntensityPicker'
import styles from './EventLogList.module.css'

interface EventLogListProps {
  projectId: string
  onEditProject?: () => void
}

export function EventLogList({ projectId, onEditProject }: EventLogListProps) {
  const state = useAppState()
  const [showAddForm, setShowAddForm] = useState(false)

  const project = state.lab?.projects[projectId]
  if (!project || project.mode !== 'event') return null

  const eventConfig = project.config.kind === 'event' ? project.config.event : undefined
  const severityConfig = eventConfig?.severity
  const severityEnabled = Boolean(severityConfig?.enabled)

  const eventLogs = Object.values(state.lab?.eventLogsByProject[projectId] || {}).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>{project.name} Events</h3>
        <button className={styles.addButton} onClick={() => setShowAddForm(true)}>
          + Log Event
        </button>
      </div>

      {!severityEnabled && (
        <div className={styles.severityNudge} role="note" aria-label="Severity disabled">
          <div className={styles.severityNudgeText}>
            Severity is off for this project. Enable it to log event severity (1–10) and unlock severity insights.
          </div>
          {onEditProject && (
            <button type="button" className={styles.severityNudgeBtn} onClick={onEditProject}>
              Enable severity
            </button>
          )}
        </div>
      )}

      {showAddForm && (
        <AddEventForm
          project={project}
          onClose={() => setShowAddForm(false)}
          onSave={() => setShowAddForm(false)}
        />
      )}

      {eventLogs.length === 0 ? (
        <p className={styles.empty}>No events logged yet</p>
      ) : (
        <div className={styles.logList}>
          {eventLogs.map((log) => (
            <EventLogItem key={log.id} projectId={projectId} log={log} />
          ))}
        </div>
      )}
    </div>
  )
}

interface AddEventFormProps {
  project: LabProject
  onClose: () => void
  onSave: () => void
}

function AddEventForm({ project, onClose, onSave }: AddEventFormProps) {
  const state = useAppState()
  const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16))
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [tagIntensities, setTagIntensities] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [severity, setSeverity] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const projectTags = Object.values(state.lab?.tagsByProject[project.id] || {})
  const eventConfig = project.config.kind === 'event' ? project.config.event : undefined
  const severityConfig = eventConfig?.severity
  const severityEnabled = Boolean(severityConfig?.enabled)
  const severityRequired = Boolean(severityConfig?.enabled && severityConfig?.required)
  const severityScale = severityConfig?.scale || { min: 1, max: 10, step: 1 }

  const selectedIntensityTags = projectTags.filter(
    (t) => selectedTags.has(t.id) && t.intensity?.enabled
  )

  const handleSave = () => {
    setSaveError(null)
    if (severityRequired && !severity.trim()) {
      setSaveError('Severity is required for this project.')
      return
    }

    const tags: LabTagUse[] = Array.from(selectedTags).map((tagId) => {
      const intensity = tagIntensities[tagId]
      return { tagId, intensity }
    })

    for (const t of tags) {
      const tagDef = projectTags.find((x) => x.id === t.tagId)
      if (!tagDef) continue
      const res = appStore.selectors.validateLabTagIntensity(tagDef, t.intensity)
      if (!res.valid) {
        setSaveError(`"${formatTagNameDisplay(tagDef.name)}": ${res.error}`)
        return
      }
    }

    const sev = severity.trim() ? Number(severity) : undefined

    appStore.actions.addLabEventLog(project.id, {
      timestamp: new Date(timestamp).toISOString(),
      severity: severityEnabled ? sev : undefined,
      tags,
      note: note.trim() || undefined,
    })

    onSave()
  }

  return (
    <div className={styles.form}>
      <div className={styles.formHeader}>
        <h4>New Event</h4>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>
      </div>

      {saveError && (
        <p className={styles.empty} role="alert" style={{ marginTop: 0 }}>
          {saveError}
        </p>
      )}

      <label className={styles.label}>
        Time
        <input
          type="datetime-local"
          className={styles.input}
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
        />
      </label>

      {severityEnabled && (
        <label className={styles.label}>
          Severity {severityRequired ? '(required)' : '(optional)'}
          <input
            type="number"
            className={styles.input}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            min={severityScale.min}
            max={severityScale.max}
            step={severityScale.step || 1}
            placeholder={`${severityScale.min}–${severityScale.max}`}
          />
        </label>
      )}

      {projectTags.length > 0 && (
        <div className={styles.tagsSection}>
          <div className={styles.label}>Tags</div>
          <div className={styles.tagGrid}>
            {projectTags.map((tag) => (
              <label key={tag.id} className={styles.tagLabel}>
                <input
                  type="checkbox"
                  checked={selectedTags.has(tag.id)}
                  onChange={(e) => {
                    const next = new Set(selectedTags)
                    if (e.target.checked) {
                      next.add(tag.id)
                    } else {
                      next.delete(tag.id)
                      setTagIntensities((prev) => {
                        const nextIntensities = { ...prev }
                        delete nextIntensities[tag.id]
                        return nextIntensities
                      })
                    }
                    setSelectedTags(next)
                  }}
                />
                {formatTagNameDisplay(tag.name)}
              </label>
            ))}
          </div>

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
                      setTagIntensities((prev) => ({
                        ...prev,
                        [tag.id]: next,
                      }))
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
      )}

      <label className={styles.label}>
        Note (optional)
        <textarea
          className={styles.textarea}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Additional details..."
        />
      </label>

      <div className={styles.formActions}>
        <button className={styles.cancelButton} onClick={onClose}>
          Cancel
        </button>
        <button className={styles.saveButton} onClick={handleSave}>
          Save Event
        </button>
      </div>
    </div>
  )
}

interface EventLogItemProps {
  projectId: string
  log: LabEventLog
}

function EventLogItem({ projectId, log }: EventLogItemProps) {
  const state = useAppState()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const project = state.lab?.projects[projectId]
  const eventConfig = project?.config.kind === 'event' ? project.config.event : undefined
  const severityConfig = eventConfig?.severity
  const severityEnabled = Boolean(severityConfig?.enabled)
  const severityRequired = Boolean(severityConfig?.enabled && severityConfig?.required)
  const severityScale = severityConfig?.scale || { min: 1, max: 10, step: 1 }

  const projectTagsList = Object.values(state.lab?.tagsByProject[projectId] || {})
  const projectTagsById = state.lab?.tagsByProject[projectId] || {}

  const tagNames = log.tags
    .map((t) => formatTagNameDisplay(projectTagsById[t.tagId]?.name || 'Unknown'))
    .join(', ')

  const [editTimestamp, setEditTimestamp] = useState(log.timestamp.slice(0, 16))
  const [editSelectedTags, setEditSelectedTags] = useState<Set<string>>(
    new Set(log.tags.map((t) => t.tagId))
  )
  const [editTagIntensities, setEditTagIntensities] = useState<Record<string, number>>(() => {
    const next: Record<string, number> = {}
    for (const t of log.tags) {
      if (t.intensity !== undefined) next[t.tagId] = t.intensity
    }
    return next
  })
  const [editNote, setEditNote] = useState(log.note || '')
  const [editSeverity, setEditSeverity] = useState(log.severity !== undefined ? String(log.severity) : '')
  const [saveError, setSaveError] = useState<string | null>(null)

  const editSelectedIntensityTags = projectTagsList.filter(
    (t) => editSelectedTags.has(t.id) && t.intensity?.enabled
  )

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const handleDelete = () => {
    if (confirm('Delete this event log?')) {
      appStore.actions.deleteLabEventLog(projectId, log.id)
    }
  }

  const handleSaveEdit = () => {
    setSaveError(null)
    if (severityRequired && !editSeverity.trim()) {
      setSaveError('Severity is required for this project.')
      return
    }

    const tags: LabTagUse[] = Array.from(editSelectedTags).map((tagId) => {
      const intensity = editTagIntensities[tagId]
      return { tagId, intensity }
    })

    for (const t of tags) {
      const tagDef = projectTagsList.find((x) => x.id === t.tagId)
      if (!tagDef) continue
      const res = appStore.selectors.validateLabTagIntensity(tagDef, t.intensity)
      if (!res.valid) {
        setSaveError(`"${formatTagNameDisplay(tagDef.name)}": ${res.error}`)
        return
      }
    }

    const sev = editSeverity.trim() ? Number(editSeverity) : undefined

    appStore.actions.updateLabEventLog(projectId, log.id, {
      timestamp: new Date(editTimestamp).toISOString(),
      severity: severityEnabled ? sev : undefined,
      tags,
      note: editNote.trim() || undefined,
    })

    setIsEditing(false)
  }

  return (
    <div className={styles.logItem}>
      <div
        className={styles.logHeader}
        onClick={() => {
          if (isEditing) return
          setIsExpanded(!isExpanded)
        }}
      >
        <div className={styles.logTime}>{formatTimestamp(log.timestamp)}</div>
        <div className={styles.logTags}>{tagNames || 'No tags'}</div>
        {severityEnabled && log.severity !== undefined && (
          <div className={styles.severityBadge}>sev {log.severity}</div>
        )}
        <button
          className={styles.deleteButton}
          onClick={(e) => {
            e.stopPropagation()
            handleDelete()
          }}
        >
          ✕
        </button>
      </div>

      {isExpanded && !isEditing && (
        <div className={styles.logDetails}>
          {log.note && <div className={styles.logNote}>{log.note}</div>}
          <div className={styles.logActions}>
            <button
              className={styles.editButton}
              onClick={() => {
                setEditTimestamp(log.timestamp.slice(0, 16))
                setEditSelectedTags(new Set(log.tags.map((t) => t.tagId)))
                setEditTagIntensities(() => {
                  const next: Record<string, number> = {}
                  for (const t of log.tags) {
                    if (t.intensity !== undefined) next[t.tagId] = t.intensity
                  }
                  return next
                })
                setEditNote(log.note || '')
                setEditSeverity(log.severity !== undefined ? String(log.severity) : '')
                setSaveError(null)
                setIsEditing(true)
              }}
            >
              Edit
            </button>
          </div>
        </div>
      )}

      {isExpanded && isEditing && (
        <div className={styles.form}>
          <div className={styles.formHeader}>
            <h4>Edit Event</h4>
            <button className={styles.closeButton} onClick={() => setIsEditing(false)}>
              ✕
            </button>
          </div>

          {saveError && (
            <p className={styles.empty} role="alert" style={{ marginTop: 0 }}>
              {saveError}
            </p>
          )}

          <label className={styles.label}>
            Time
            <input
              type="datetime-local"
              className={styles.input}
              value={editTimestamp}
              onChange={(e) => setEditTimestamp(e.target.value)}
            />
          </label>

          {severityEnabled && (
            <label className={styles.label}>
              Severity {severityRequired ? '(required)' : '(optional)'}
              <input
                type="number"
                className={styles.input}
                value={editSeverity}
                onChange={(e) => setEditSeverity(e.target.value)}
                min={severityScale.min}
                max={severityScale.max}
                step={severityScale.step || 1}
                placeholder={`${severityScale.min}–${severityScale.max}`}
              />
            </label>
          )}

          {projectTagsList.length > 0 && (
            <div className={styles.tagsSection}>
              <div className={styles.label}>Tags</div>
              <div className={styles.tagGrid}>
                {projectTagsList.map((tag) => (
                  <label key={tag.id} className={styles.tagLabel}>
                    <input
                      type="checkbox"
                      checked={editSelectedTags.has(tag.id)}
                      onChange={(e) => {
                        const next = new Set(editSelectedTags)
                        if (e.target.checked) {
                          next.add(tag.id)
                        } else {
                          next.delete(tag.id)
                          setEditTagIntensities((prev) => {
                            const nextIntensities = { ...prev }
                            delete nextIntensities[tag.id]
                            return nextIntensities
                          })
                        }
                        setEditSelectedTags(next)
                      }}
                    />
                    {formatTagNameDisplay(tag.name)}
                  </label>
                ))}
              </div>

              {editSelectedIntensityTags.length > 0 && (
                <div className={styles.intensityList}>
                  <div className={styles.intensityTitle}>Intensity</div>
                  {editSelectedIntensityTags.map((tag) => (
                    <div key={tag.id} className={styles.intensityRow}>
                      <div className={styles.intensityName}>{formatTagNameDisplay(tag.name)}</div>
                      <IntensityPicker
                        min={tag.intensity?.min ?? 1}
                        max={tag.intensity?.max ?? 5}
                        step={tag.intensity?.step ?? 1}
                        value={editTagIntensities[tag.id]}
                        onChange={(next) =>
                          setEditTagIntensities((prev) => ({
                            ...prev,
                            [tag.id]: next,
                          }))
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
          )}

          <label className={styles.label}>
            Note (optional)
            <textarea
              className={styles.textarea}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              rows={3}
              placeholder="Additional details..."
            />
          </label>

          <div className={styles.formActions}>
            <button className={styles.cancelButton} onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button className={styles.saveButton} onClick={handleSaveEdit}>
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
