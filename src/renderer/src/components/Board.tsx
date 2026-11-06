import type { AppEntry, Status } from '../../../shared/types'
import AppCard from './AppCard'

interface Props {
  apps: AppEntry[]
  statuses: Record<string, Status>
  onAdd: () => void
}

export default function Board({ apps, statuses, onAdd }: Props) {
  if (apps.length === 0) {
    return (
      <div className="empty">
        <p>Здесь пока ничего нет.</p>
        <button className="primary" onClick={onAdd}>
          Добавить приложение
        </button>
      </div>
    )
  }
  return (
    <div className="board">
      {apps.map((a) => (
        <AppCard key={a.id} app={a} status={statuses[a.id]} />
      ))}
    </div>
  )
}
