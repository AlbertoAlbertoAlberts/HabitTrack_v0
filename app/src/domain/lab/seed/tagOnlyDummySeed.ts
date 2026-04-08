import type { LabDailyTagOnlyProjectConfig, LabTagDef } from '../../types'
import { appStore } from '../../store/appStore'
import { tagOnlyDummyCsv } from './tagOnlyDummyData'

type ParsedRow = {
  date: string
  tags: string[]
}

function parseTagOnlyCsv(csv: string): ParsedRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const header = lines[0].split(',')
  const idxDate = header.indexOf('date')
  const idxTags = header.indexOf('tags_semicolon')

  if (idxDate === -1 || idxTags === -1) return []

  const rows: ParsedRow[] = []
  for (const line of lines.slice(1)) {
    const parts = line.split(',')
    const date = (parts[idxDate] ?? '').trim()
    if (!date) continue

    const raw = (parts[idxTags] ?? '').trim()
    const tags = raw ? raw.split(';').map((s) => s.trim()).filter(Boolean) : []
    rows.push({ date, tags })
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

export function importTagOnlyDummyIfNeeded(options?: { select?: boolean }): void {
  const state = appStore.getState()
  if (!state.lab) return

  const existing = Object.values(state.lab.projects).find((p) => p.name === 'Morning_symptoms_dummy')
  if (existing) return

  const config: LabDailyTagOnlyProjectConfig = {
    kind: 'daily-tag-only',
    tagsEnabled: true,
    completion: { requireAtLeastOneTag: false },
    allowExplicitNoTags: true,
  }

  appStore.actions.addLabProject('Morning_symptoms_dummy', 'daily-tag-only', config)
  const afterAdd = appStore.getState()
  const projectId = afterAdd.lab?.projectOrder[afterAdd.lab.projectOrder.length - 1]
  if (!projectId) return

  // Create tag library
  const tagIdByName = new Map<string, string>()
  for (const name of ['headache', 'fatigue', 'nausea', 'brain_fog', 'joint_pain']) {
    tagIdByName.set(name, ensureTag(projectId, { name, group: 'symptom' }))
  }

  const rows = parseTagOnlyCsv(tagOnlyDummyCsv)

  for (const row of rows) {
    const tagUses = row.tags
      .map((name) => {
        const tagId = tagIdByName.get(name)
        return tagId ? { tagId } : null
      })
      .filter((u): u is { tagId: string } => u !== null)

    appStore.actions.setLabDailyLog(projectId, row.date, {
      outcome: undefined,
      tags: tagUses,
      noTags: tagUses.length === 0 ? true : undefined,
    })
  }

  if (options?.select !== false) {
    appStore.actions.setActiveLabProject(projectId)
  }
}
