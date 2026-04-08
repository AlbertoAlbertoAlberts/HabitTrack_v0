import type { LabDailyMultiChoiceProjectConfig, LabMultiChoiceOption } from '../../types'
import { appStore } from '../../store/appStore'
import { generateId } from '../../utils/generateId'
import { multiChoiceDummyCsv } from './multiChoiceDummyData'

type ParsedRow = {
  date: string
  choices: string[]
}

function parseMultiChoiceCsv(csv: string): ParsedRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const header = lines[0].split(',')
  const idxDate = header.indexOf('date')
  const idxChoices = header.indexOf('choices_semicolon')

  if (idxDate === -1 || idxChoices === -1) return []

  const rows: ParsedRow[] = []
  for (const line of lines.slice(1)) {
    const parts = line.split(',')
    const date = (parts[idxDate] ?? '').trim()
    if (!date) continue

    const raw = (parts[idxChoices] ?? '').trim()
    const choices = raw ? raw.split(';').map((s) => s.trim()).filter(Boolean) : []
    rows.push({ date, choices })
  }

  return rows
}

export function importMultiChoiceDummyIfNeeded(options?: { select?: boolean }): void {
  const state = appStore.getState()
  if (!state.lab) return

  const existing = Object.values(state.lab.projects).find((p) => p.name === 'Day_type_dummy')
  if (existing) return

  const now = new Date().toISOString()

  const optionLabels = ['VEF', 'Coding', 'Haltura', 'DayOff', 'Family', 'Mix']
  const optionsList: LabMultiChoiceOption[] = optionLabels.map((label) => ({
    id: generateId(),
    label,
    createdAt: now,
  }))

  const optionIdByLabel = new Map<string, string>()
  for (const opt of optionsList) {
    optionIdByLabel.set(opt.label, opt.id)
  }

  const config: LabDailyMultiChoiceProjectConfig = {
    kind: 'daily-multi-choice',
    selectionMode: 'single',
    options: optionsList,
    completion: { requireAtLeastOneChoice: true },
  }

  appStore.actions.addLabProject('Day_type_dummy', 'daily-multi-choice', config)
  const afterAdd = appStore.getState()
  const projectId = afterAdd.lab?.projectOrder[afterAdd.lab.projectOrder.length - 1]
  if (!projectId) return

  const rows = parseMultiChoiceCsv(multiChoiceDummyCsv)

  for (const row of rows) {
    const selectedOptionIds = row.choices
      .map((label) => optionIdByLabel.get(label))
      .filter((id): id is string => id !== undefined)

    if (selectedOptionIds.length > 0) {
      appStore.actions.setLabMultiChoiceLog(projectId, row.date, {
        selectedOptionIds,
      })
    }
  }

  if (options?.select !== false) {
    appStore.actions.setActiveLabProject(projectId)
  }
}
