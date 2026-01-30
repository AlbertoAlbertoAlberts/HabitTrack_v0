import type { LabTagId, LabTagDef, LabTagUse } from '../../types'
import { appStore } from '../../store/appStore'
import { bloatingDummyCsv } from './bloatingDummyData'

type CsvRow = {
  date: string
  bloating: number
  exposures: Record<string, number>
}

const PROJECT_NAME = 'bloating_dummy'
const OUTCOME_COL = 'bloating'
const DATE_COL = 'date'

function parseBloatingCsv(csv: string): { headers: string[]; rows: CsvRow[] } {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = lines[0].split(',').map((h) => h.trim())
  const rows: CsvRow[] = []

  for (const line of lines.slice(1)) {
    const parts = line.split(',').map((p) => p.trim())
    if (parts.length !== headers.length) continue

    const raw: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) raw[headers[i]] = parts[i]

    const date = raw[DATE_COL]
    const bloating = Number(raw[OUTCOME_COL] ?? '0')

    const exposures: Record<string, number> = {}
    for (const h of headers) {
      if (h === DATE_COL || h === OUTCOME_COL) continue
      exposures[h] = Number(raw[h] ?? '0')
    }

    rows.push({ date, bloating, exposures })
  }

  return { headers, rows }
}

function makeLocalMiddayTimestamp(dateIso: string): string {
  // dateIso is YYYY-MM-DD.
  const [y, m, d] = dateIso.split('-').map((x) => Number(x))
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  return dt.toISOString()
}

function shouldSkipAsOffDayInLast30Days(dateIso: string): boolean {
  // Create a few intentional “no event” days so occurrence insights have a real baseline.
  // Deterministic pattern based on the UTC day index.
  const [y, m, d] = dateIso.split('-').map((x) => Number(x))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false

  const dateLocal = new Date(y, m - 1, d, 0, 0, 0, 0)
  const now = new Date()

  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 30)

  if (dateLocal.getTime() < cutoff.getTime()) return false
  if (dateLocal.getTime() > now.getTime()) return false

  const utcDayIndex = Math.floor(Date.UTC(y, m - 1, d) / (24 * 60 * 60 * 1000))
  return utcDayIndex % 9 === 0 || utcDayIndex % 13 === 0
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

export function importBloatingDummyIfNeeded(options?: { select?: boolean }): void {
  const state = appStore.getState()
  if (!state.lab) return

  const select = options?.select ?? true

  const existingProject = Object.values(state.lab.projects).find((p) => p.name === PROJECT_NAME)
  if (existingProject?.archived) {
    appStore.actions.unarchiveLabProject(existingProject.id)
  }

  const { headers, rows } = parseBloatingCsv(bloatingDummyCsv)

  const exposureHeaders = headers.filter((h) => h !== DATE_COL && h !== OUTCOME_COL)

  let projectId = existingProject?.id
  if (!projectId) {
    appStore.actions.addLabProject(PROJECT_NAME, 'event', {
      kind: 'event',
      event: {
        name: 'Bloating episode',
        severity: {
          enabled: false,
          scale: { min: 1, max: 10, step: 1 },
          required: false,
        },
      },
      completion: { requireAtLeastOneTag: false },
      dailyAbsenceMarker: { enabled: true },
    })

    const afterAdd = appStore.getState()
    projectId = afterAdd.lab?.projectOrder[afterAdd.lab.projectOrder.length - 1]
    if (!projectId) return
  }

  // Ensure the project is visible in the sidebar (projectOrder drives the list).
  const afterEnsureProject = appStore.getState()
  const order = afterEnsureProject.lab?.projectOrder ?? []
  if (!order.includes(projectId)) {
    appStore.actions.reorderLabProjects([...order, projectId])
  }

  const current = appStore.getState()

  const tagIdsByName = new Map<string, LabTagId>()
  const existingTagsById = current.lab?.tagsByProject[projectId] || {}
  const existingTagsByName = new Map<string, LabTagId>()
  for (const t of Object.values(existingTagsById)) {
    existingTagsByName.set(t.name.trim().toLowerCase(), t.id)
  }

  for (const name of exposureHeaders) {
    const key = name.trim().toLowerCase()
    const existingId = existingTagsByName.get(key)
    tagIdsByName.set(name, existingId ?? ensureTag(projectId, { name, group: 'imported' }))
  }

  // Build the set of timestamps we want to treat as intentional “off days”.
  const offDayTimestamps = new Set<string>()
  for (const row of rows) {
    if (!row.date) continue
    if (!shouldSkipAsOffDayInLast30Days(row.date)) continue
    offDayTimestamps.add(makeLocalMiddayTimestamp(row.date))
  }

  // If this dummy project was already imported, remove previously imported dummy logs for off-days.
  // This keeps the dataset stable across reloads without deleting user-created logs.
  const existingLogsBefore = Object.values(current.lab?.eventLogsByProject[projectId] || {})
  for (const log of existingLogsBefore) {
    if (!offDayTimestamps.has(log.timestamp)) continue
    if (!log.note?.startsWith('Imported dummy row for ')) continue
    appStore.actions.deleteLabEventLog(projectId, log.id)
  }

  // Refresh after deletions.
  const afterDelete = appStore.getState()
  const existingLogs = Object.values(afterDelete.lab?.eventLogsByProject[projectId] || {})
  const existingTimestamps = new Set(existingLogs.map((l) => l.timestamp))

  for (const row of rows) {
    if (!row.date) continue

    const timestamp = makeLocalMiddayTimestamp(row.date)
    if (offDayTimestamps.has(timestamp)) continue
    if (existingTimestamps.has(timestamp)) continue

    const tags: LabTagUse[] = []
    for (const [tagName, v] of Object.entries(row.exposures)) {
      if (v !== 1) continue
      const tagId = tagIdsByName.get(tagName)
      if (tagId) tags.push({ tagId })
    }

    appStore.actions.addLabEventLog(projectId, {
      timestamp,
      tags,
      note: `Imported dummy row for ${row.date} (bloating=${row.bloating})`,
    })
  }

  if (select) appStore.actions.setActiveLabProject(projectId)
}
