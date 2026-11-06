import type { Status } from '../../../shared/types'

const LABELS = { up: 'UP', down: 'DOWN', checking: 'CHECK…' } as const

export default function StatusBadge({ status }: { status?: Status }) {
  const state = status?.state ?? 'checking'
  const details = [
    status?.code && `HTTP ${status.code}`,
    status?.latencyMs !== undefined && `${status.latencyMs} ms`,
    status?.error
  ]
    .filter(Boolean)
    .join(' · ')
  const time = status?.checkedAt ? new Date(status.checkedAt).toLocaleTimeString() : ''

  return (
    <span className={`badge badge-${state}`} title={time && `Проверено: ${time}`}>
      <span className="dot" />
      {LABELS[state]}
      {details && <span className="badge-details">{details}</span>}
    </span>
  )
}
