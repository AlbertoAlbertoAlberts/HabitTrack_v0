import { useState } from 'react'
import { Dialog, DialogBody, DialogFooter } from '../../../components/ui/Dialog'
import { useAppState, useAppStore } from '../../../domain/store/useAppStore'
import type { LabTagDef } from '../../../domain/types'
import styles from './TagDialog.module.css'

interface TagDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  tagId?: string | null
}

type IntensityPreset = '1-3' | '1-5' | 'custom'

function presetFromIntensity(intensity: LabTagDef['intensity'] | undefined): IntensityPreset {
  const min = intensity?.min ?? 1
  const max = intensity?.max ?? 5
  const step = intensity?.step ?? 1
  if (min === 1 && max === 3 && step === 1) return '1-3'
  if (min === 1 && max === 5 && step === 1) return '1-5'
  return 'custom'
}

export function TagDialog({ open, onClose, projectId, tagId }: TagDialogProps) {
  const store = useAppStore()
  const state = useAppState()
  const existingTag = tagId ? state.lab?.tagsByProject[projectId]?.[tagId] ?? null : null

  const groupOptions = Array.from(
    new Set(
      Object.values(state.lab?.tagsByProject?.[projectId] || {})
        .map((t) => t.group?.trim())
        .filter((g): g is string => Boolean(g))
    )
  ).sort((a, b) => a.localeCompare(b))

  const [name, setName] = useState(existingTag?.name || '')
  const [group, setGroup] = useState(existingTag?.group || '')

  const [intensityEnabled, setIntensityEnabled] = useState(Boolean(existingTag?.intensity?.enabled))
  const [intensityPreset, setIntensityPreset] = useState<IntensityPreset>(() =>
    presetFromIntensity(existingTag?.intensity)
  )
  const [intensityMin, setIntensityMin] = useState(existingTag?.intensity?.min ?? 1)
  const [intensityMax, setIntensityMax] = useState(existingTag?.intensity?.max ?? 5)
  const [intensityStep, setIntensityStep] = useState(existingTag?.intensity?.step ?? 1)
  const [intensityLabel, setIntensityLabel] = useState(existingTag?.intensity?.unitLabel || '')

  const applyPreset = (preset: IntensityPreset) => {
    setIntensityPreset(preset)
    if (preset === '1-3') {
      setIntensityMin(1)
      setIntensityMax(3)
      setIntensityStep(1)
    } else if (preset === '1-5') {
      setIntensityMin(1)
      setIntensityMax(5)
      setIntensityStep(1)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const tagDef: Omit<LabTagDef, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      group: group.trim() || undefined,
      intensity: intensityEnabled
        ? {
            enabled: true,
            min: intensityMin,
            max: intensityMax,
            step: intensityStep || undefined,
            unitLabel: intensityLabel || undefined,
          }
        : undefined,
    }

    if (tagId) {
      store.actions.updateLabTag(projectId, tagId, tagDef)
    } else {
      store.actions.addLabTag(projectId, tagDef)
    }

    onClose()
  }

  const handleClose = () => {
    setName(existingTag?.name || '')
    setGroup(existingTag?.group || '')

    const enabled = Boolean(existingTag?.intensity?.enabled)
    setIntensityEnabled(enabled)
    applyPreset(presetFromIntensity(existingTag?.intensity))
    setIntensityMin(existingTag?.intensity?.min ?? 1)
    setIntensityMax(existingTag?.intensity?.max ?? 5)
    setIntensityStep(existingTag?.intensity?.step ?? 1)
    setIntensityLabel(existingTag?.intensity?.unitLabel ?? '')

    onClose()
  }

  return (
    <Dialog open={open} title={tagId ? 'Edit Tag' : 'New Tag'} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <DialogBody>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="tag-name">
              Tag Name
            </label>
            <input
              id="tag-name"
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Alcohol, Exercise"
              autoFocus
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="tag-group">
              Group (optional)
            </label>
            <input
              id="tag-group"
              type="text"
              className={styles.input}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              list="tag-group-suggestions"
              placeholder="e.g., substances, sleep, food"
            />
            {groupOptions.length > 0 ? (
              <datalist id="tag-group-suggestions">
                {groupOptions.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            ) : null}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={intensityEnabled}
                onChange={(e) => {
                  const checked = e.target.checked
                  setIntensityEnabled(checked)
                  if (checked) {
                    applyPreset('1-5')
                    setIntensityLabel(intensityLabel || '')
                  }
                }}
              />
              <span>Track intensity</span>
            </label>
          </div>

          {intensityEnabled && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="intensity-preset">
                  Intensity scale
                </label>
                <select
                  id="intensity-preset"
                  className={styles.input}
                  value={intensityPreset}
                  onChange={(e) => applyPreset(e.target.value as IntensityPreset)}
                >
                  <option value="1-3">1–3</option>
                  <option value="1-5">1–5</option>
                  <option value="custom">Custom…</option>
                </select>
              </div>

              {intensityPreset === 'custom' ? (
                <>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="intensity-min">
                        Min
                      </label>
                      <input
                        id="intensity-min"
                        type="number"
                        className={styles.input}
                        value={intensityMin}
                        onChange={(e) => setIntensityMin(Number(e.target.value))}
                        step="any"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="intensity-max">
                        Max
                      </label>
                      <input
                        id="intensity-max"
                        type="number"
                        className={styles.input}
                        value={intensityMax}
                        onChange={(e) => setIntensityMax(Number(e.target.value))}
                        step="any"
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="intensity-step">
                        Step (optional)
                      </label>
                      <input
                        id="intensity-step"
                        type="number"
                        className={styles.input}
                        value={intensityStep}
                        onChange={(e) => setIntensityStep(Number(e.target.value))}
                        step="any"
                        min={0}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label} htmlFor="intensity-label">
                        Unit (optional)
                      </label>
                      <input
                        id="intensity-label"
                        type="text"
                        className={styles.input}
                        value={intensityLabel}
                        onChange={(e) => setIntensityLabel(e.target.value)}
                        placeholder="e.g., drinks, hours"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="intensity-label">
                    Unit (optional)
                  </label>
                  <input
                    id="intensity-label"
                    type="text"
                    className={styles.input}
                    value={intensityLabel}
                    onChange={(e) => setIntensityLabel(e.target.value)}
                    placeholder="e.g., kg, sets, hours"
                  />
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <button type="button" className={styles.btnSecondary} onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={!name.trim()}>
            {tagId ? 'Save' : 'Create'}
          </button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
