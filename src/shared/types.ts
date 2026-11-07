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

export interface Api {
  list(): Promise<AppEntry[]>
  create(input: AppInput): Promise<AppEntry>
  update(entry: AppEntry): Promise<AppEntry>
  remove(id: string): Promise<void>
  checkNow(id: string): Promise<void>
  statuses(): Promise<Status[]>
  onStatus(cb: (s: Status) => void): () => void
}
