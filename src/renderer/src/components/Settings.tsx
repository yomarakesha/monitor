import { useEffect, useState, type FormEvent } from 'react'
import type { NotifyChannel, Settings as SettingsData, SettingsInput } from '../../../shared/types'
import { ipcError } from '../ipcError'

function toInput(s: SettingsData): SettingsInput {
  const { hasToken: _t, ...telegram } = s.telegram
  const { hasPassword: _p, ...email } = s.email
  return { ...s, telegram, email }
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
  const setTelegram = (patch: Partial<SettingsInput['telegram']>) => set({ telegram: { ...form.telegram, ...patch } })
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
              checked={form.telegram.enabled}
              onChange={(e) => setTelegram({ enabled: e.target.checked })}
            />
            <h3>Telegram</h3>
          </label>
          <button type="button" onClick={() => test('telegram')}>
            Тест
          </button>
        </div>
        <div className="row">
          <label>
            Bot token
            <input
              type="password"
              autoComplete="off"
              placeholder={secretHint(saved.telegram.hasToken)}
              value={form.telegram.token ?? ''}
              onChange={(e) => setTelegram({ token: e.target.value || undefined })}
            />
          </label>
          <label>
            Chat id
            <input value={form.telegram.chatId} onChange={(e) => setTelegram({ chatId: e.target.value })} />
          </label>
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
            <h3>Email (SMTP)</h3>
          </label>
          <button type="button" onClick={() => test('email')}>
            Тест
          </button>
        </div>
        <div className="row">
          <label>
            SMTP host
            <input value={form.email.host} onChange={(e) => setEmail({ host: e.target.value })} />
          </label>
          <label className="narrow">
            Порт
            <input type="number" value={form.email.port} onChange={(e) => setEmail({ port: Number(e.target.value) })} />
          </label>
          <label className="check narrow">
            <input type="checkbox" checked={form.email.secure} onChange={(e) => setEmail({ secure: e.target.checked })} />
            TLS (465)
          </label>
        </div>
        <div className="row">
          <label>
            Пользователь
            <input value={form.email.user} onChange={(e) => setEmail({ user: e.target.value })} />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete="off"
              placeholder={secretHint(saved.email.hasPassword)}
              value={form.email.password ?? ''}
              onChange={(e) => setEmail({ password: e.target.value || undefined })}
            />
          </label>
        </div>
        <div className="row">
          <label>
            От кого
            <input placeholder="по умолчанию — пользователь" value={form.email.from} onChange={(e) => setEmail({ from: e.target.value })} />
          </label>
          <label>
            Кому
            <input value={form.email.to} onChange={(e) => setEmail({ to: e.target.value })} />
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
