import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import type { Settings, SettingsInput, WindowBounds } from '../shared/types'

// On-disk shape: secrets are encrypted with the OS keychain via safeStorage and base64-encoded.
interface Stored extends Omit<Settings, 'telegram' | 'email'> {
  telegram: Omit<Settings['telegram'], 'hasToken'> & { tokenEnc?: string }
  email: Omit<Settings['email'], 'hasPassword'> & { passwordEnc?: string }
  windowBounds?: WindowBounds
}

const DEFAULTS: Stored = {
  closeToTray: false,
  autostart: false,
  startHidden: false,
  notifyDesktop: true,
  telegram: { enabled: false, chatId: '' },
  email: { enabled: false, host: '', port: 587, secure: false, user: '', from: '', to: '' }
}

const file = () => join(app.getPath('userData'), 'settings.json')

let cache: Stored | null = null

function load(): Stored {
  if (cache) return cache
  try {
    const raw = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : {}
    cache = {
      ...DEFAULTS,
      ...raw,
      telegram: { ...DEFAULTS.telegram, ...raw.telegram },
      email: { ...DEFAULTS.email, ...raw.email }
    }
  } catch (err) {
    console.error('Failed to read settings.json, using defaults:', err)
    cache = structuredClone(DEFAULTS)
  }
  return cache!
}

function save(): void {
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(cache, null, 2))
  renameSync(tmp, file())
}

function encrypt(value: string): string | undefined {
  if (!value) return undefined
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Системное хранилище секретов недоступно')
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(value?: string): string {
  if (!value) return ''
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  } catch (err) {
    console.error('Failed to decrypt secret:', err)
    return ''
  }
}

export function get(): Settings {
  const { windowBounds: _, telegram, email, ...rest } = load()
  const { tokenEnc, ...tg } = telegram
  const { passwordEnc, ...mail } = email
  return { ...rest, telegram: { ...tg, hasToken: !!tokenEnc }, email: { ...mail, hasPassword: !!passwordEnc } }
}

export function set(input: SettingsInput): Settings {
  const cur = load()
  const { telegram: tg, email: mail } = input
  // Fields are copied one by one so nothing else from the renderer reaches the file.
  cache = {
    ...cur,
    closeToTray: !!input.closeToTray,
    autostart: !!input.autostart,
    startHidden: !!input.startHidden,
    notifyDesktop: !!input.notifyDesktop,
    telegram: {
      enabled: !!tg.enabled,
      chatId: String(tg.chatId).trim(),
      tokenEnc: tg.token === undefined ? cur.telegram.tokenEnc : encrypt(tg.token.trim())
    },
    email: {
      enabled: !!mail.enabled,
      host: String(mail.host).trim(),
      port: Number(mail.port) || 587,
      secure: !!mail.secure,
      user: String(mail.user).trim(),
      from: String(mail.from).trim(),
      to: String(mail.to).trim(),
      passwordEnc: mail.password === undefined ? cur.email.passwordEnc : encrypt(mail.password)
    }
  }
  save()
  return get()
}

export function telegramToken(): string {
  return decrypt(load().telegram.tokenEnc)
}

export function smtpPassword(): string {
  return decrypt(load().email.passwordEnc)
}

export function windowBounds(): WindowBounds | undefined {
  return load().windowBounds
}

export function setWindowBounds(bounds: WindowBounds): void {
  load().windowBounds = bounds
  save()
}
