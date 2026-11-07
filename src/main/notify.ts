import { Notification, net } from 'electron'
import nodemailer from 'nodemailer'
import * as settings from './settings'
import { checkLabel } from '../shared/target'
import type { AppEntry, NotifyChannel, Status } from '../shared/types'

interface Message {
  title: string
  body: string
}

let onClick: () => void = () => {}

export function init(showWindow: () => void): void {
  onClick = showWindow
}

function desktop(msg: Message): void {
  if (!Notification.isSupported()) throw new Error('Системные уведомления не поддерживаются')
  const n = new Notification({ title: msg.title, body: msg.body })
  n.on('click', () => onClick())
  n.show()
}

async function telegram(msg: Message): Promise<void> {
  const token = settings.telegramToken()
  const { chatId } = settings.get().telegram
  if (!token || !chatId) throw new Error('Не заданы token или chat id')
  const res = await net.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: `${msg.title}\n${msg.body}` }),
    signal: AbortSignal.timeout(15_000)
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { description?: string } | null
    throw new Error(`Telegram: ${data?.description ?? `HTTP ${res.status}`}`)
  }
}

async function email(msg: Message): Promise<void> {
  const cfg = settings.get().email
  if (!cfg.host || !cfg.to) throw new Error('Не заданы SMTP host или получатель')
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: settings.smtpPassword() } : undefined
  })
  await transport.sendMail({ from: cfg.from || cfg.user, to: cfg.to, subject: msg.title, text: msg.body })
}

async function send(channel: NotifyChannel, msg: Message): Promise<void> {
  if (channel === 'desktop') return desktop(msg)
  if (channel === 'telegram') return telegram(msg)
  return email(msg)
}

function enabledChannels(): NotifyChannel[] {
  const s = settings.get()
  const channels: NotifyChannel[] = []
  if (s.notifyDesktop) channels.push('desktop')
  if (s.telegram.enabled) channels.push('telegram')
  if (s.email.enabled) channels.push('email')
  return channels
}

// Each channel is independent: one failing channel does not block the others.
export function transition(entry: AppEntry, status: Status): void {
  const down = status.state === 'down'
  const details = [status.code && `HTTP ${status.code}`, status.error].filter(Boolean).join(' · ')
  const msg: Message = {
    title: `${down ? '🔴' : '🟢'} ${entry.name}: ${down ? 'DOWN' : 'UP'}`,
    body: [checkLabel(entry), details].filter(Boolean).join('\n')
  }
  for (const channel of enabledChannels()) {
    Promise.resolve()
      .then(() => send(channel, msg))
      .catch((err) => console.error(`Notification via ${channel} failed:`, err))
  }
}

export function test(channel: NotifyChannel): Promise<void> {
  return send(channel, { title: 'Monitor: тест', body: 'Уведомления работают.' })
}
