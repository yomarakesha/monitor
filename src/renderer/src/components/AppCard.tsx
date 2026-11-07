import { useEffect, useRef, useState } from 'react'
import type { WebviewTag } from 'electron'
import type { AppEntry, Status, Uptime } from '../../../shared/types'
import { formatUptime } from '../format'
import { checkLabel } from '../../../shared/target'
import HistoryModal from './HistoryModal'
import StatusBadge from './StatusBadge'

interface Props {
  app: AppEntry
  status?: Status
  uptime?: Uptime
}

export default function AppCard({ app, status, uptime }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<WebviewTag | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // The webview is created imperatively so `partition` is set before the first navigation.
  useEffect(() => {
    if (!app.url) return
    const wv = document.createElement('webview') as WebviewTag
    wv.setAttribute('partition', 'persist:monitor')
    wv.setAttribute('src', app.url)
    wv.className = 'webview'
    const onFail = (e: Electron.DidFailLoadEvent) => {
      // -3 is ERR_ABORTED (e.g. a redirect); not a real failure.
      if (e.isMainFrame && e.errorCode !== -3) setLoadError(`${e.errorDescription} (${e.errorCode})`)
    }
    const onStart = () => setLoadError(null)
    wv.addEventListener('did-fail-load', onFail)
    wv.addEventListener('did-start-loading', onStart)
    host.current!.appendChild(wv)
    view.current = wv
    return () => {
      wv.remove()
      view.current = null
    }
  }, [app.url])

  useEffect(() => {
    if (!app.refreshMin || !(app.refreshMin > 0 && app.refreshMin <= 1440)) return
    const timer = setInterval(() => view.current?.reload(), app.refreshMin * 60_000)
    return () => clearInterval(timer)
  }, [app.refreshMin])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  return (
    <article className={expanded ? 'card expanded' : 'card'}>
      <header className="card-head">
        <div className="card-title">
          <h3>{app.name}</h3>
          {(app.checkType ?? 'http') !== 'http' && <span className="card-target">{checkLabel(app)}</span>}
          {app.url && (
            <a className="card-url" href={app.url} target="_blank" rel="noreferrer">
              {app.url}
            </a>
          )}
        </div>
        <StatusBadge status={status} />
      </header>
      <div className="card-actions">
        <button onClick={() => window.api.checkNow(app.id)}>Проверить</button>
        {app.url && (
          <>
            <button onClick={() => view.current?.reload()}>Обновить вид</button>
            <button onClick={() => setExpanded((v) => !v)}>{expanded ? 'Свернуть' : 'Развернуть'}</button>
          </>
        )}
        <button onClick={() => setShowHistory(true)}>История</button>
        <span className="uptime" title="Аптайм за 24 часа / 7 дней / 30 дней">
          {formatUptime(uptime?.d1)} · {formatUptime(uptime?.d7)} · {formatUptime(uptime?.d30)}
        </span>
      </div>
      {app.url && (
        <div className="card-view" ref={host}>
          {loadError && <div className="view-error">Не удалось загрузить: {loadError}</div>}
        </div>
      )}
      {app.description && <p className="card-desc">{app.description}</p>}
      {showHistory && <HistoryModal app={app} onClose={() => setShowHistory(false)} />}
    </article>
  )
}
