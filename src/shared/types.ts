export type AppKind = 'internet' | 'local'

export interface AppEntry {
  id: string
  name: string
  description: string
  url: string
  kind: AppKind
  intervalSec: number
  // Address used for checks instead of `url`; the webview always shows `url`.
  healthUrl?: string
  // Exact HTTP code that means UP; when unset, any 2xx/3xx is UP.
  expectedStatus?: number
  // Latency above this threshold marks the app as slow.
  slowMs?: number
  // Consecutive failed checks before the app is reported DOWN; unset means 1.
  failThreshold?: number
  // Webview reload period in minutes; unset or 0 disables it.
  refreshMin?: number
}

export type AppInput = Omit<AppEntry, 'id'>

export type State = 'up' | 'slow' | 'down' | 'checking'

export interface Status {
  id: string
  state: State
  code?: number
  latencyMs?: number
  checkedAt: number
  error?: string
  // Failed checks in a row that have not yet reached `failThreshold`.
  failCount?: number
  failThreshold?: number
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

export interface TelegramSettings {
  enabled: boolean
  chatId: string
  hasToken: boolean
}

export interface EmailSettings {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  from: string
  to: string
  hasPassword: boolean
}

// What the renderer sees: secrets are reported only as `has*` flags.
export interface Settings {
  closeToTray: boolean
  autostart: boolean
  startHidden: boolean
  notifyDesktop: boolean
  telegram: TelegramSettings
  email: EmailSettings
}

// Secret fields: undefined keeps the stored value, '' clears it.
export interface SettingsInput {
  closeToTray: boolean
  autostart: boolean
  startHidden: boolean
  notifyDesktop: boolean
  telegram: Omit<TelegramSettings, 'hasToken'> & { token?: string }
  email: Omit<EmailSettings, 'hasPassword'> & { password?: string }
}

export type NotifyChannel = 'desktop' | 'telegram' | 'email'

export interface ImportResult {
  added: number
  skipped: number
}

// Share of checks not reported DOWN, 0..1; null when there are no checks in the period.
export interface Uptime {
  d1: number | null
  d7: number | null
  d30: number | null
}

export type HistoryRange = '24h' | '7d' | '30d'

export interface HistoryPoint {
  t: number
  // Average over checks that were not DOWN; null when every check in the bucket was DOWN.
  latencyMs: number | null
  checks: number
  down: number
}

export interface Incident {
  startedAt: number
  // null while the app is still DOWN.
  endedAt: number | null
  error?: string
}

export interface History {
  uptime: Uptime
  points: HistoryPoint[]
  incidents: Incident[]
  bucketMs: number
  from: number
  to: number
}

export interface Api {
  list(): Promise<AppEntry[]>
  create(input: AppInput): Promise<AppEntry>
  update(entry: AppEntry): Promise<AppEntry>
  remove(id: string): Promise<void>
  checkNow(id: string): Promise<void>
  statuses(): Promise<Status[]>
  onStatus(cb: (s: Status) => void): () => void
  getSettings(): Promise<Settings>
  setSettings(input: SettingsInput): Promise<Settings>
  testNotify(channel: NotifyChannel): Promise<void>
  // Resolve to null when the user cancels the file dialog.
  exportApps(): Promise<string | null>
  importApps(): Promise<ImportResult | null>
  uptimes(): Promise<Record<string, Uptime>>
  history(id: string, range: HistoryRange): Promise<History>
}
