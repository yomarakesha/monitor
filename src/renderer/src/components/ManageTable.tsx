import { useState } from 'react'
import type { AppEntry, Status } from '../../../shared/types'
import AppForm from './AppForm'
import StatusBadge from './StatusBadge'

interface Props {
  apps: AppEntry[]
  statuses: Record<string, Status>
  onChange: () => void
}

export default function ManageTable({ apps, statuses, onChange }: Props) {
  const [editing, setEditing] = useState<AppEntry | 'new' | null>(null)

  const remove = async (a: AppEntry) => {
    if (!confirm(`Удалить «${a.name}»?`)) return
    await window.api.remove(a.id)
    onChange()
  }

  return (
    <section className="manage">
      <div className="manage-head">
        <h2>Приложения</h2>
        <button className="primary" onClick={() => setEditing('new')}>
          + Добавить
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Тип</th>
            <th>Адрес</th>
            <th>Описание</th>
            <th>Интервал</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.kind === 'internet' ? 'Internet' : 'Local'}</td>
              <td className="mono">{a.url}</td>
              <td className="desc">{a.description}</td>
              <td>{a.intervalSec} с</td>
              <td>
                <StatusBadge status={statuses[a.id]} />
              </td>
              <td className="actions">
                <button onClick={() => setEditing(a)}>Изменить</button>
                <button className="danger" onClick={() => remove(a)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
          {apps.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                Список пуст. Нажмите «Добавить».
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {editing && (
        <AppForm
          initial={editing === 'new' ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChange()
          }}
        />
      )}
    </section>
  )
}
