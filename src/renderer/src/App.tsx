import { useCallback, useEffect, useState } from 'react'
import type { AppEntry, AppKind, Status } from '../../shared/types'
import Board, { EMPTY_FILTER, type Filter } from './components/Board'
import ManageTable from './components/ManageTable'
import Settings from './components/Settings'

type Tab = AppKind | 'manage' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'internet', label: 'Internet Apps' },
  { id: 'local', label: 'Local Apps' },
  { id: 'manage', label: 'Управление' },
  { id: 'settings', label: 'Настройки' }
]

const isBoard = (t: Tab): t is AppKind => t === 'internet' || t === 'local'

export default function App() {
  const [tab, setTab] = useState<Tab>('internet')
  const [apps, setApps] = useState<AppEntry[]>([])
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER)

  const reload = useCallback(() => window.api.list().then(setApps), [])

  useEffect(() => {
    reload()
    window.api.statuses().then((all) => setStatuses(Object.fromEntries(all.map((s) => [s.id, s]))))
    return window.api.onStatus((s) => setStatuses((prev) => ({ ...prev, [s.id]: s })))
  }, [reload])

  const count = (kind: AppKind) => {
    const items = apps.filter((a) => a.kind === kind)
    const down = items.filter((a) => statuses[a.id]?.state === 'down').length
    return { total: items.length, down }
  }

  return (
    <div className="app">
      <nav className="tabs">
        {TABS.map((t) => {
          const c = isBoard(t.id) ? count(t.id) : null
          return (
            <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
              {t.label}
              {c && <span className="tab-count">{c.total}</span>}
              {c && c.down > 0 && <span className="tab-down">{c.down} down</span>}
            </button>
          )
        })}
      </nav>
      <main className="content">
        {tab === 'manage' && <ManageTable apps={apps} statuses={statuses} onChange={reload} />}
        {tab === 'settings' && <Settings />}
        {isBoard(tab) && (
          <Board
            apps={apps.filter((a) => a.kind === tab)}
            statuses={statuses}
            filter={filter}
            onFilter={setFilter}
            onAdd={() => setTab('manage')}
          />
        )}
      </main>
    </div>
  )
}
