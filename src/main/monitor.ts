import http from 'http'
import https from 'https'
import type { WebContents } from 'electron'
import type { AppEntry, Status } from '../shared/types'

const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5

const timers = new Map<string, NodeJS.Timeout>()
const statuses = new Map<string, Status>()
let target: WebContents | null = null

export function setTarget(wc: WebContents): void {
  target = wc
}

export function allStatuses(): Status[] {
  return [...statuses.values()]
}

function publish(s: Status): void {
  statuses.set(s.id, s)
  if (target && !target.isDestroyed()) target.send('status:update', s)
}

// Local apps often use self-signed certs, so TLS verification is relaxed only for them.
function request(url: string, insecure: boolean, redirects = 0): Promise<number> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const mod = u.protocol === 'https:' ? https : http
    const req = mod.request(
      u,
      { method: 'GET', timeout: TIMEOUT_MS, rejectUnauthorized: !insecure, headers: { 'User-Agent': 'Monitor/0.1' } },
      (res) => {
        res.resume()
        const code = res.statusCode ?? 0
        if (code >= 300 && code < 400 && res.headers.location && redirects < MAX_REDIRECTS) {
          resolve(request(new URL(res.headers.location, u).toString(), insecure, redirects + 1))
        } else {
          resolve(code)
        }
      }
    )
    req.on('timeout', () => req.destroy(new Error('Timeout')))
    req.on('error', reject)
    req.end()
  })
}

export async function check(entry: AppEntry): Promise<void> {
  const prev = statuses.get(entry.id)
  publish({ ...prev, id: entry.id, state: 'checking', checkedAt: prev?.checkedAt ?? Date.now() })
  const started = Date.now()
  try {
    const code = await request(entry.url, entry.kind === 'local')
    publish({
      id: entry.id,
      state: code >= 200 && code < 400 ? 'up' : 'down',
      code,
      latencyMs: Date.now() - started,
      checkedAt: Date.now()
    })
  } catch (err) {
    publish({ id: entry.id, state: 'down', checkedAt: Date.now(), error: (err as Error).message })
  }
}

export function schedule(entry: AppEntry): void {
  unschedule(entry.id)
  check(entry)
  const ms = Math.max(5, entry.intervalSec) * 1000
  timers.set(entry.id, setInterval(() => check(entry), ms))
}

export function unschedule(id: string): void {
  clearInterval(timers.get(id))
  timers.delete(id)
  statuses.delete(id)
}
