import { useEffect, useState } from 'react'
import type { AppEntry, History, HistoryRange } from '../../../shared/types'
import { formatDateTime, formatDuration, formatUptime } from '../format'
import LatencyChart from './LatencyChart'

const RANGES: { id: HistoryRange; label: string }[] = [
  { id: '24h', label: '24 часа' },
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' }
]

interface Props {
  app: AppEntry
  onClose: () => void
}

export default function HistoryModal({ app, onClose }: Props) {
  const [range, setRange] = useState<HistoryRange>('24h')
  const [data, setData] = useState<History | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => window.api.history(app.id, range).then((h) => alive && setData(h))
    load()
    const timer = setInterval(load, 30_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [app.id, range])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal history" onClick={(e) => e.stopPropagation()}>
        <div className="history-head">
          <h2>{app.name}: история</h2>
          <button onClick={onClose}>Закрыть</button>
        </div>

        <div className="tiles">
          {(['d1', 'd7', 'd30'] as const).map((k, i) => (
            <div key={k} className="tile">
              <span className="tile-label">Аптайм, {RANGES[i].label}</span>
              <span className="tile-value">{formatUptime(data?.uptime[k])}</span>
            </div>
          ))}
        </div>

        <div className="history-range">
          <h3>Время ответа</h3>
          <div className="segmented">
            {RANGES.map((r) => (
              <button key={r.id} className={r.id === range ? 'active' : ''} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {data && <LatencyChart points={data.points} from={data.from} to={data.to} bucketMs={data.bucketMs} />}
        <p className="hint">
          Линия — среднее время ответа. <span className="legend-down" /> Красная полоса — были проверки со статусом DOWN.
        </p>

        <h3>Журнал падений</h3>
        {data && data.incidents.length === 0 ? (
          <p className="hint">За выбранный период падений не было.</p>
        ) : (
          <table className="incidents">
            <thead>
              <tr>
                <th>Начало</th>
                <th>Конец</th>
                <th>Длительность</th>
                <th>Причина</th>
              </tr>
            </thead>
            <tbody>
              {data?.incidents.map((i) => (
                <tr key={i.startedAt}>
                  <td>{formatDateTime(i.startedAt)}</td>
                  <td>{i.endedAt ? formatDateTime(i.endedAt) : <span className="still-down">продолжается</span>}</td>
                  <td>{formatDuration((i.endedAt ?? Date.now()) - i.startedAt)}</td>
                  <td className="desc">{i.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
