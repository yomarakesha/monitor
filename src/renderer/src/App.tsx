import { useCallback, useEffect, useState } from 'react'
import type { AppEntry, AppKind, Status } from '../../shared/types'
import Board from './components/Board'
import ManageTable from './components/ManageTable'

type Tab = AppKind | 'manage'

const TABS: { id: Tab; label: string }[] = [
  { id: 'internet', label: 'Internet Apps' },
  { id: 'local', label: 'Local Apps' },
  { id: 'manage', label: 'Управление' }
]

export default function App() {
  const [tab, setTab] = useState<Tab>('internet')
  const [apps, setApps] = useState<AppEntry[]>([])
  const [statuses, setStatuses] = useState<Record<string, Status>>({})

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
          const c = t.id !== 'manage' ? count(t.id) : null
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
        {tab === 'manage' ? (
          <ManageTable apps={apps} statuses={statuses} onChange={reload} />
        ) : (
          <Board
            apps={apps.filter((a) => a.kind === tab)}
            statuses={statuses}
            onAdd={() => setTab('manage')}
          />
        )}
      </main>
    </div>
  )
}
