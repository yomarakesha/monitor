// Rounded down, so a single failure never shows as 100%.
export function formatUptime(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  if (v === 1) return '100%'
  return `${(Math.floor(v * 10_000) / 100).toFixed(2)}%`
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 1) return '< 1 мин'
  if (min < 60) return `${min} мин`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч ${min % 60} мин`
  return `${Math.floor(h / 24)} д ${h % 24} ч`
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
