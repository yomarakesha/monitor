import { useState, type FormEvent } from 'react'
import type { AppEntry, AppInput } from '../../../shared/types'

interface Props {
  initial?: AppEntry
  onCancel: () => void
  onSaved: () => void
}

const EMPTY: AppInput = { name: '', description: '', url: '', kind: 'internet', intervalSec: 30 }

export default function AppForm({ initial, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<AppInput>(initial ?? EMPTY)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof AppInput>(k: K, v: AppInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const u = new URL(form.url)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
    } catch {
      setError('Адрес должен начинаться с http:// или https://')
      return
    }
    try {
      if (initial) await window.api.update({ ...form, id: initial.id })
      else await window.api.create(form)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Редактировать' : 'Новое приложение'}</h2>
        <label>
          Название
          <input required autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          Адрес
          <input
            required
            placeholder="https://example.com или http://localhost:3000"
            value={form.url}
            onChange={(e) => set('url', e.target.value.trim())}
          />
        </label>
        <label>
          Описание
          <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <div className="row">
          <label>
            Тип
            <select value={form.kind} onChange={(e) => set('kind', e.target.value as AppInput['kind'])}>
              <option value="internet">Internet App</option>
              <option value="local">Local App</option>
            </select>
          </label>
          <label>
            Интервал проверки, сек
            <input
              type="number"
              min={5}
              value={form.intervalSec}
              onChange={(e) => set('intervalSec', Number(e.target.value))}
            />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className="primary">
            Сохранить
          </button>
        </div>
      </form>
    </div>
  )
}
