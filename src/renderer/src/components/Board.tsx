import type { AppEntry, State, Status, Uptime } from '../../../shared/types'
import AppCard from './AppCard'

export interface Filter {
  query: string
  state: State | 'all'
  onlyDown: boolean
}

export const EMPTY_FILTER: Filter = { query: '', state: 'all', onlyDown: false }

interface Props {
  apps: AppEntry[]
  statuses: Record<string, Status>
  uptimes: Record<string, Uptime>
  filter: Filter
  onFilter: (f: Filter) => void
  onAdd: () => void
}

function matches(app: AppEntry, status: Status | undefined, f: Filter): boolean {
  const q = f.query.trim().toLowerCase()
  if (q && ![app.name, app.description, app.url].some((v) => v.toLowerCase().includes(q))) return false
  const state = status?.state ?? 'checking'
  if (f.onlyDown && state !== 'down') return false
  return f.state === 'all' || state === f.state
}

export default function Board({ apps, statuses, uptimes, filter, onFilter, onAdd }: Props) {
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
  const visible = apps.filter((a) => matches(a, statuses[a.id], filter))
  const set = (patch: Partial<Filter>) => onFilter({ ...filter, ...patch })
  return (
    <>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Поиск по названию, адресу, описанию"
          value={filter.query}
          onChange={(e) => set({ query: e.target.value })}
        />
        <select value={filter.state} onChange={(e) => set({ state: e.target.value as Filter['state'] })}>
          <option value="all">Все статусы</option>
          <option value="up">UP</option>
          <option value="slow">SLOW</option>
          <option value="down">DOWN</option>
          <option value="checking">Проверяется</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={filter.onlyDown} onChange={(e) => set({ onlyDown: e.target.checked })} />
          Только упавшие
        </label>
      </div>
      {visible.length === 0 ? (
        <div className="empty">
          <p>Ничего не найдено.</p>
          <button onClick={() => onFilter(EMPTY_FILTER)}>Сбросить фильтр</button>
        </div>
      ) : (
        <div className="board">
          {visible.map((a) => (
            <AppCard key={a.id} app={a} status={statuses[a.id]} uptime={uptimes[a.id]} />
          ))}
        </div>
      )}
    </>
  )
}
