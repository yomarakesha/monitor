import { useEffect, useState, type FormEvent } from 'react'
import type { NotifyChannel, Settings as SettingsData, SettingsInput } from '../../../shared/types'
import { ipcError } from '../ipcError'

function toInput(s: SettingsData): SettingsInput {
  const { hasPassword: _p, ...email } = s.email
  return { ...s, email }
}

export default function Settings() {
  const [saved, setSaved] = useState<SettingsData | null>(null)
  const [form, setForm] = useState<SettingsInput | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSaved(s)
      setForm(toInput(s))
    })
  }, [])

  if (!form || !saved) return null

  const set = (patch: Partial<SettingsInput>) => setForm({ ...form, ...patch })
  const setEmail = (patch: Partial<SettingsInput['email']>) => set({ email: { ...form.email, ...patch } })

  const save = async () => {
    const s = await window.api.setSettings(form)
    setSaved(s)
    // Secrets are write-only: clear the inputs once stored.
    setForm(toInput(s))
    return s
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await save()
      setMessage({ text: 'Сохранено' })
    } catch (err) {
      setMessage({ text: ipcError(err), error: true })
    }
  }

  // Tests run against saved settings, so unsaved edits are stored first.
  const test = async (channel: NotifyChannel) => {
    setMessage(null)
    try {
      await save()
      await window.api.testNotify(channel)
      setMessage({ text: 'Тестовое уведомление отправлено' })
    } catch (err) {
      setMessage({ text: ipcError(err), error: true })
    }
  }

  const secretHint = (stored: boolean) => (stored ? 'сохранён; введите новый, чтобы заменить' : '')

  return (
    <form className="settings" onSubmit={submit}>
      <section>
        <h2>Окно и запуск</h2>
        <label className="check">
          <input type="checkbox" checked={form.closeToTray} onChange={(e) => set({ closeToTray: e.target.checked })} />
          Сворачивать в трей при закрытии окна
        </label>
        <label className="check">
          <input type="checkbox" checked={form.autostart} onChange={(e) => set({ autostart: e.target.checked })} />
          Запускать вместе с системой
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.startHidden}
            disabled={!form.closeToTray}
            onChange={(e) => set({ startHidden: e.target.checked })}
          />
          Всегда запускать свёрнутым в трей
        </label>
      </section>

      <section>
        <h2>Уведомления</h2>
        <p className="hint">Приходят, когда приложение падает (DOWN) и когда снова работает (UP).</p>
        <div className="check-row">
          <label className="check">
            <input
              type="checkbox"
              checked={form.notifyDesktop}
              onChange={(e) => set({ notifyDesktop: e.target.checked })}
            />
            Системные уведомления
          </label>
          <button type="button" onClick={() => test('desktop')}>
            Тест
          </button>
        </div>
      </section>

      <section>
        <div className="check-row">
          <label className="check">
            <input
              type="checkbox"
              checked={form.email.enabled}
              onChange={(e) => setEmail({ enabled: e.target.checked })}
            />
            <h3>Gmail</h3>
          </label>
          <button type="button" onClick={() => test('email')}>
            Тест
          </button>
        </div>
        <p className="hint">
          Письмо приходит с адреса на него же. Нужен пароль приложения: включите двухэтапную аутентификацию и создайте
          пароль на myaccount.google.com/apppasswords.
        </p>
        <div className="row">
          <label>
            Gmail-адрес
            <input
              type="email"
              placeholder="you@gmail.com"
              value={form.email.address}
              onChange={(e) => setEmail({ address: e.target.value })}
            />
          </label>
          <label>
            Пароль приложения
            <input
              type="password"
              autoComplete="off"
              placeholder={secretHint(saved.email.hasPassword) || 'xxxx xxxx xxxx xxxx'}
              value={form.email.password ?? ''}
              onChange={(e) => setEmail({ password: e.target.value || undefined })}
            />
          </label>
        </div>
      </section>

      <div className="settings-actions">
        {message && <span className={message.error ? 'form-error' : 'form-ok'}>{message.text}</span>}
        <button type="submit" className="primary">
          Сохранить
        </button>
      </div>
    </form>
  )
}
