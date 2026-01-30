import type { LabDailyProjectConfig, LabTagDef, LabTagUse } from '../../types'
import { appStore } from '../../store/appStore'
import { morningDummyCsv } from './morningDummyData'

type ParsedTag = { name: string; intensity?: number }

type ParsedRow = {
  date: string
  outcome: number
  tags: ParsedTag[]
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

function parseTags(tagsStr: string): ParsedTag[] {
  const trimmed = tagsStr.trim()
  if (!trimmed) return []

  const out: ParsedTag[] = []
  for (const raw of trimmed.split(';')) {
    const s = raw.trim()
    if (!s) continue

    const m = s.match(/^([^:]+):(\d+(?:\.\d+)?)$/)
    if (m) out.push({ name: m[1].trim(), intensity: Number(m[2]) })
    else out.push({ name: s })
  }
  return out
}

function parseMorningDummyCsv(csv: string): ParsedRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const header = lines[0].split(',')
  const idxDate = header.indexOf('date')
  const idxScore = header.indexOf('morning_wellbeing_1_10')
  const idxTags = header.indexOf('tags_semicolon')

  if (idxDate === -1 || idxScore === -1 || idxTags === -1) return []

  const rows: ParsedRow[] = []
  for (const line of lines.slice(1)) {
    const parts = line.split(',')
    const date = (parts[idxDate] ?? '').trim()
    if (!date) continue

    const rawScore = Number(parts[idxScore])
    const rounded = Math.round(rawScore)
    const outcome = clampInt(rounded, 1, 10)

    const tags = parseTags(String(parts[idxTags] ?? ''))
    rows.push({ date, outcome, tags })
  }

  return rows
}

function ensureTag(projectId: string, tagDef: Omit<LabTagDef, 'id' | 'createdAt' | 'updatedAt'>): string {
  appStore.actions.addLabTag(projectId, tagDef)
  const tags = appStore.getState().lab?.tagsByProject[projectId] || {}
  const found = Object.values(tags).find((t) => t.name.toLowerCase() === tagDef.name.trim().toLowerCase())
  if (!found) {
    throw new Error(`Failed to create/find tag: ${tagDef.name}`)
  }
  return found.id
}

export function seedMorningDummyIfNeeded(): void {
  const state = appStore.getState()
  if (!state.lab) return

  const existing = Object.values(state.lab.projects).find((p) => p.name === 'Morning_dummy')
  if (existing) return

  const config: LabDailyProjectConfig = {
    kind: 'daily',
    outcome: {
      id: 'outcome',
      name: 'Morning wellbeing',
      scale: { min: 1, max: 10, step: 1 },
      required: true,
    },
    exposureLabel: 'Previous evening',
    alignment: { exposureWindow: 'previousEvening' },
    completion: { requireOutcome: true, requireAtLeastOneTag: false },
    allowExplicitNoTags: true,
  }

  appStore.actions.addLabProject('Morning_dummy', 'daily', config)
  const afterAdd = appStore.getState()
  const projectId = afterAdd.lab?.projectOrder[afterAdd.lab.projectOrder.length - 1]
  if (!projectId) return

  // Create tag library
  const tagIdByName = new Map<string, string>()

  tagIdByName.set(
    'alcohol',
    ensureTag(projectId, {
      name: 'alcohol',
      group: 'food',
      intensity: { enabled: true, min: 0, max: 3, step: 1, unitLabel: '0–3' },
    })
  )

  for (const name of ['late_screen', 'gym', 'social', 'cold_shower', 'spicy_food'] as const) {
    tagIdByName.set(name, ensureTag(projectId, { name, group: name === 'gym' ? 'activity' : 'context' }))
  }

  const rows = parseMorningDummyCsv(morningDummyCsv)

  for (const row of rows) {
    const tagUses: LabTagUse[] = []

    for (const t of row.tags) {
      const key = t.name.trim()
      const norm = key.toLowerCase()

      // If a new/unknown tag appears, add it as binary so the import is resilient.
      let tagId = tagIdByName.get(norm)
      if (!tagId) {
        tagId = ensureTag(projectId, { name: norm, group: 'imported' })
        tagIdByName.set(norm, tagId)
      }

      tagUses.push({ tagId, intensity: t.intensity })
    }

    // De-dupe tagId within the log
    const seen = new Set<string>()
    const deduped = tagUses.filter((u) => {
      if (seen.has(u.tagId)) return false
      seen.add(u.tagId)
      return true
    })

    appStore.actions.setLabDailyLog(projectId, row.date, {
      outcome: row.outcome,
      tags: deduped,
      noTags: deduped.length === 0 ? true : undefined,
    })
  }

  appStore.actions.setActiveLabProject(projectId)
}
