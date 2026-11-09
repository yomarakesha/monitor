import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import type { Settings, SettingsInput, WindowBounds } from '../shared/types'

// On-disk shape: secrets are encrypted with the OS keychain via safeStorage and base64-encoded.
interface Stored extends Omit<Settings, 'email'> {
  email: Omit<Settings['email'], 'hasPassword'> & { passwordEnc?: string }
  windowBounds?: WindowBounds
}

const DEFAULTS: Stored = {
  closeToTray: false,
  autostart: false,
  startHidden: false,
  notifyDesktop: true,
  email: { enabled: false, address: '' }
}

const file = () => join(app.getPath('userData'), 'settings.json')

let cache: Stored | null = null

function load(): Stored {
  if (cache) return cache
  try {
    // Drop keys left by older versions (Telegram, generic SMTP settings).
    const { telegram: _, ...raw } = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : {}
    const { enabled, address, passwordEnc } = { ...DEFAULTS.email, ...raw.email }
    cache = { ...DEFAULTS, ...raw, email: { enabled, address, passwordEnc } }
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
  const { windowBounds: _, email, ...rest } = load()
  const { passwordEnc, ...mail } = email
  return { ...rest, email: { ...mail, hasPassword: !!passwordEnc } }
}

export function set(input: SettingsInput): Settings {
  const cur = load()
  const mail = input.email
  // Fields are copied one by one so nothing else from the renderer reaches the file.
  cache = {
    ...cur,
    closeToTray: !!input.closeToTray,
    autostart: !!input.autostart,
    startHidden: !!input.startHidden,
    notifyDesktop: !!input.notifyDesktop,
    email: {
      enabled: !!mail.enabled,
      address: String(mail.address).trim(),
      // Google shows app passwords in groups of four separated by spaces.
      passwordEnc: mail.password === undefined ? cur.email.passwordEnc : encrypt(mail.password.replace(/\s+/g, ''))
    }
  }
  save()
  return get()
}

export function gmailAppPassword(): string {
  return decrypt(load().email.passwordEnc)
}

export function windowBounds(): WindowBounds | undefined {
  return load().windowBounds
}

export function setWindowBounds(bounds: WindowBounds): void {
  load().windowBounds = bounds
  save()
}
