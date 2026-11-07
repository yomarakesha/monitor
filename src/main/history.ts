import { app } from 'electron'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { join } from 'path'
import type { History, HistoryRange, Incident, Status, Uptime } from '../shared/types'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const CHECKS_KEEP_MS = 30 * DAY
const INCIDENTS_KEEP_MS = 90 * DAY

const RANGES: Record<HistoryRange, { span: number; bucket: number }> = {
  '24h': { span: DAY, bucket: 10 * 60_000 },
  '7d': { span: 7 * DAY, bucket: HOUR },
  '30d': { span: 30 * DAY, bucket: 6 * HOUR }
}

// node:sqlite binds JS numbers as REAL, so integer arithmetic in SQL needs an explicit CAST.
let db: DatabaseSync
let q: Record<string, StatementSync>

export function open(): void {
  db = new DatabaseSync(join(app.getPath('userData'), 'history.db'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS checks (
      app_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      state TEXT NOT NULL,
      code INTEGER,
      latency_ms INTEGER,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS checks_app_ts ON checks (app_id, ts);
    CREATE INDEX IF NOT EXISTS checks_ts ON checks (ts);
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY,
      app_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS incidents_app ON incidents (app_id, started_at);
  `)
  q = {
    insertCheck: db.prepare('INSERT INTO checks (app_id, ts, state, code, latency_ms, error) VALUES (?, ?, ?, ?, ?, ?)'),
    openIncident: db.prepare('SELECT id FROM incidents WHERE app_id = ? AND ended_at IS NULL'),
    startIncident: db.prepare('INSERT INTO incidents (app_id, started_at, error) VALUES (?, ?, ?)'),
    endIncident: db.prepare('UPDATE incidents SET ended_at = ? WHERE id = ?'),
    uptimes: db.prepare(`
      SELECT app_id,
        SUM(ts >= :d1) AS n1, SUM(ts >= :d1 AND state != 'down') AS u1,
        SUM(ts >= :d7) AS n7, SUM(ts >= :d7 AND state != 'down') AS u7,
        COUNT(*) AS n30, SUM(state != 'down') AS u30
      FROM checks WHERE ts >= :d30 GROUP BY app_id`),
    series: db.prepare(`
      SELECT (ts / CAST(:bucket AS INTEGER)) * CAST(:bucket AS INTEGER) AS t,
        AVG(latency_ms) FILTER (WHERE state != 'down') AS latency,
        COUNT(*) AS checks,
        SUM(state = 'down') AS down
      FROM checks WHERE app_id = :id AND ts >= :from GROUP BY t ORDER BY t`),
    incidents: db.prepare(`
      SELECT started_at, ended_at, error FROM incidents
      WHERE app_id = ? AND (ended_at IS NULL OR ended_at >= ?)
      ORDER BY started_at DESC LIMIT 100`),
    removeChecks: db.prepare('DELETE FROM checks WHERE app_id = ?'),
    removeIncidents: db.prepare('DELETE FROM incidents WHERE app_id = ?'),
    pruneChecks: db.prepare('DELETE FROM checks WHERE ts < ?'),
    pruneIncidents: db.prepare('DELETE FROM incidents WHERE ended_at IS NOT NULL AND ended_at < ?')
  }
  prune()
  setInterval(prune, 6 * HOUR).unref()
}

function prune(): void {
  const now = Date.now()
  q.pruneChecks.run(now - CHECKS_KEEP_MS)
  q.pruneIncidents.run(now - INCIDENTS_KEEP_MS)
}

// Called for every finished check. Uptime counts a check as up unless it was reported DOWN,
// so failures still under the retry threshold do not lower it.
export function record(s: Status): void {
  if (s.state === 'checking') return
  q.insertCheck.run(s.id, s.checkedAt, s.state, s.code ?? null, s.latencyMs ?? null, s.error ?? null)
  // Incidents follow the stored data rather than in-memory transitions, so an outage that
  // spans a restart of Monitor stays one incident.
  const open = q.openIncident.get(s.id) as { id: number } | undefined
  if (s.state === 'down' && !open) q.startIncident.run(s.id, s.checkedAt, s.error ?? (s.code ? `HTTP ${s.code}` : null))
  else if (s.state !== 'down' && open) q.endIncident.run(s.checkedAt, open.id)
}

export function remove(appId: string): void {
  q.removeChecks.run(appId)
  q.removeIncidents.run(appId)
}

const ratio = (up: unknown, n: unknown) => (Number(n) > 0 ? Number(up) / Number(n) : null)

export function uptimes(): Record<string, Uptime> {
  const now = Date.now()
  const rows = q.uptimes.all({ d1: now - DAY, d7: now - 7 * DAY, d30: now - 30 * DAY }) as Record<string, unknown>[]
  return Object.fromEntries(
    rows.map((r) => [
      String(r.app_id),
      { d1: ratio(r.u1, r.n1), d7: ratio(r.u7, r.n7), d30: ratio(r.u30, r.n30) }
    ])
  )
}

export function history(appId: string, range: HistoryRange): History {
  const { span, bucket } = RANGES[range] ?? RANGES['24h']
  const to = Date.now()
  const from = to - span
  const points = (q.series.all({ bucket, id: appId, from }) as Record<string, unknown>[]).map((r) => ({
    t: Number(r.t),
    latencyMs: r.latency === null ? null : Math.round(Number(r.latency)),
    checks: Number(r.checks),
    down: Number(r.down)
  }))
  const incidents: Incident[] = (q.incidents.all(appId, from) as Record<string, unknown>[]).map((r) => ({
    startedAt: Number(r.started_at),
    endedAt: r.ended_at === null ? null : Number(r.ended_at),
    error: r.error === null ? undefined : String(r.error)
  }))
  return { uptime: uptimes()[appId] ?? { d1: null, d7: null, d30: null }, points, incidents, bucketMs: bucket, from, to }
}
