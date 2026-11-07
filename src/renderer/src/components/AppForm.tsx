import { useState, type FormEvent } from 'react'
import type { AppEntry, AppInput, CheckType } from '../../../shared/types'
import { isValidHost, parseTcpTarget } from '../../../shared/target'

interface Props {
  initial?: AppEntry
  onCancel: () => void
  onSaved: () => void
}

const EMPTY: AppInput = { name: '', description: '', url: '', kind: 'internet', intervalSec: 30, failThreshold: 2 }

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// Empty optional number inputs mean "not set".
const optNum = (v: string) => (v === '' ? undefined : Number(v))

export default function AppForm({ initial, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<AppInput>(initial ?? EMPTY)
  const [error, setError] = useState<string | null>(null)
  const type = form.checkType ?? 'http'
  const set = <K extends keyof AppInput>(k: K, v: AppInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const type = form.checkType ?? 'http'
    if ((type === 'http' || form.url) && !isHttpUrl(form.url)) {
      setError('Адрес должен начинаться с http:// или https://')
      return
    }
    if (type === 'http' && form.healthUrl && !isHttpUrl(form.healthUrl)) {
      setError('Адрес проверки должен начинаться с http:// или https://')
      return
    }
    if (type === 'tcp' && !parseTcpTarget(form.target ?? '')) {
      setError('Для TCP укажите хост и порт, например 10.0.0.5:6379')
      return
    }
    if (type === 'ping' && !isValidHost(form.target ?? '')) {
      setError('Для ping укажите имя хоста или IP')
      return
    }
    // Fields of other check types are dropped so they do not linger in apps.json.
    const clean: AppInput =
      type === 'http'
        ? { ...form, checkType: undefined, target: undefined }
        : { ...form, healthUrl: undefined, expectedStatus: undefined }
    try {
      if (initial) await window.api.update({ ...clean, id: initial.id })
      else await window.api.create(clean)
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
          Вид проверки
          <select
            value={form.checkType ?? 'http'}
            onChange={(e) => set('checkType', e.target.value === 'http' ? undefined : (e.target.value as CheckType))}
          >
            <option value="http">HTTP — сайт или API</option>
            <option value="tcp">TCP-порт — база, Redis, SSH</option>
            <option value="ping">Ping — хост или роутер</option>
          </select>
        </label>
        {type !== 'http' && (
          <label>
            {type === 'tcp' ? 'Хост и порт' : 'Хост'}
            <input
              required
              placeholder={type === 'tcp' ? '10.0.0.5:6379' : '10.0.0.1 или router.lan'}
              value={form.target ?? ''}
              onChange={(e) => set('target', e.target.value.trim() || undefined)}
            />
          </label>
        )}
        <label>
          {type === 'http' ? 'Адрес' : 'Адрес страницы для веб-вью (необязательно)'}
          <input
            required={type === 'http'}
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
            Вкладка
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
              max={86400}
              value={form.intervalSec}
              onChange={(e) => set('intervalSec', Number(e.target.value))}
            />
          </label>
        </div>
        <h3 className="form-section">Проверка</h3>
        {type === 'http' && (
          <label>
            Адрес проверки (health), если отличается
            <input
              placeholder="https://example.com/health"
              value={form.healthUrl ?? ''}
              onChange={(e) => set('healthUrl', e.target.value.trim() || undefined)}
            />
          </label>
        )}
        <div className="row">
          {type === 'http' && (
            <label>
              Ожидаемый код
              <input
                type="number"
                min={100}
                max={599}
                placeholder="2xx/3xx"
                value={form.expectedStatus ?? ''}
                onChange={(e) => set('expectedStatus', optNum(e.target.value))}
              />
            </label>
          )}
          <label>
            Медленно, если дольше, мс
            <input
              type="number"
              min={0}
              placeholder="не задано"
              value={form.slowMs ?? ''}
              onChange={(e) => set('slowMs', optNum(e.target.value))}
            />
          </label>
        </div>
        <div className="row">
          <label>
            Сбоев подряд до DOWN
            <input
              type="number"
              min={1}
              max={100}
              placeholder="1"
              value={form.failThreshold ?? ''}
              onChange={(e) => set('failThreshold', optNum(e.target.value))}
            />
          </label>
          <label>
            Обновлять вид каждые, мин
            <input
              type="number"
              min={0}
              max={1440}
              placeholder="не обновлять"
              value={form.refreshMin ?? ''}
              onChange={(e) => set('refreshMin', optNum(e.target.value))}
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
