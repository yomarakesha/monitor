export type AppKind = 'internet' | 'local'

export interface AppEntry {
  id: string
  name: string
  description: string
  url: string
  kind: AppKind
  intervalSec: number
}

export type AppInput = Omit<AppEntry, 'id'>

export interface Status {
  id: string
  state: 'up' | 'down' | 'checking'
  code?: number
  latencyMs?: number
  checkedAt: number
  error?: string
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
