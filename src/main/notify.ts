import { Notification } from 'electron'
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

// Gmail only: the message goes from the address to itself, authenticated with an app password.
async function email(msg: Message): Promise<void> {
  const { address } = settings.get().email
  const pass = settings.gmailAppPassword()
  if (!address || !pass) throw new Error('Не заданы Gmail-адрес или пароль приложения')
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: address, pass } })
  await transport.sendMail({ from: address, to: address, subject: msg.title, text: msg.body })
}

async function send(channel: NotifyChannel, msg: Message): Promise<void> {
  if (channel === 'desktop') return desktop(msg)
  return email(msg)
}

function enabledChannels(): NotifyChannel[] {
  const s = settings.get()
  const channels: NotifyChannel[] = []
  if (s.notifyDesktop) channels.push('desktop')
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
