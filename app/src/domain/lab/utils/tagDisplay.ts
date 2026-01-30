export function formatTagNameDisplay(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''

  const first = trimmed[0]
  return first.toUpperCase() + trimmed.slice(1)
}
