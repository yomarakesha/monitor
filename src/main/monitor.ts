import { session, type WebContents } from 'electron'
import type { AppEntry, State, Status } from '../shared/types'

export const PARTITION = 'persist:monitor'
const TIMEOUT_MS = 10_000

type Confirmed = Exclude<State, 'checking'>
type StatusListener = (s: Status) => void
type TransitionListener = (entry: AppEntry, s: Status) => void

const timers = new Map<string, NodeJS.Timeout>()
const statuses = new Map<string, Status>()
const failures = new Map<string, number>()
// Last state that passed the retry threshold; the baseline for UP/DOWN transitions.
const confirmed = new Map<string, Confirmed>()
const statusListeners: StatusListener[] = []
const transitionListeners: TransitionListener[] = []
let target: WebContents | null = null

export function setTarget(wc: WebContents): void {
  target = wc
}

export function allStatuses(): Status[] {
  return [...statuses.values()]
}

export function onStatus(cb: StatusListener): void {
  statusListeners.push(cb)
}

// Fires when an app goes from up/slow to down or back. The first result after
// scheduling has no baseline and never fires.
export function onTransition(cb: TransitionListener): void {
  transitionListeners.push(cb)
}

function publish(s: Status): void {
  statuses.set(s.id, s)
  if (target && !target.isDestroyed()) target.send('status:update', s)
  statusListeners.forEach((cb) => cb(s))
}

function confirm(entry: AppEntry, s: Status & { state: Confirmed }): void {
  const prev = confirmed.get(entry.id)
  confirmed.set(entry.id, s.state)
  publish(s)
  if (prev && (prev === 'down') !== (s.state === 'down')) transitionListeners.forEach((cb) => cb(entry, s))
}

// Uses Chromium's network stack via the webview session, so system proxy settings and
// the local-only self-signed certificate rule apply to pings exactly as to webviews.
async function request(url: string): Promise<number> {
  const res = await session.fromPartition(PARTITION).fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  await res.body?.cancel()
  return res.status
}

function isUp(entry: AppEntry, code: number): boolean {
  return entry.expectedStatus ? code === entry.expectedStatus : code >= 200 && code < 400
}

function fail(entry: AppEntry, s: Omit<Status, 'state'>): void {
  const count = (failures.get(entry.id) ?? 0) + 1
  const threshold = Math.max(1, entry.failThreshold ?? 1)
  failures.set(entry.id, count)
  if (count >= threshold) {
    confirm(entry, { ...s, state: 'down' })
  } else {
    // Below the threshold the app keeps its last confirmed state; the badge shows the failure count.
    publish({ ...s, state: confirmed.get(entry.id) ?? 'checking', failCount: count, failThreshold: threshold })
  }
}

export async function check(entry: AppEntry): Promise<void> {
  const prev = statuses.get(entry.id)
  publish({ ...prev, id: entry.id, state: 'checking', checkedAt: prev?.checkedAt ?? Date.now() })
  const started = Date.now()
  try {
    const code = await request(entry.healthUrl || entry.url)
    const latencyMs = Date.now() - started
    const base = { id: entry.id, code, latencyMs, checkedAt: Date.now() }
    if (!isUp(entry, code)) {
      fail(entry, { ...base, error: entry.expectedStatus ? `ожидался ${entry.expectedStatus}` : undefined })
      return
    }
    failures.delete(entry.id)
    confirm(entry, { ...base, state: entry.slowMs && latencyMs > entry.slowMs ? 'slow' : 'up' })
  } catch (err) {
    fail(entry, { id: entry.id, checkedAt: Date.now(), error: (err as Error).message })
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
  failures.delete(id)
  confirmed.delete(id)
}
