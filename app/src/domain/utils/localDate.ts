import type { LocalDateString } from '../types'

export function toLocalDateString(date: Date): LocalDateString {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDateString(date: LocalDateString): Date {
  const [y, m, d] = date.split('-').map((v) => Number(v))
  return new Date(y, m - 1, d)
}

export function addDays(date: LocalDateString, deltaDays: number): LocalDateString {
  const dt = parseLocalDateString(date)
  dt.setDate(dt.getDate() + deltaDays)
  return toLocalDateString(dt)
}

export function todayLocalDateString(now: Date = new Date()): LocalDateString {
  return toLocalDateString(now)
}

export function isToday(date: LocalDateString, now: Date = new Date()): boolean {
  return date === todayLocalDateString(now)
}
