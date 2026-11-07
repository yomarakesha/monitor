import type { AppEntry } from './types'

// Hostname, IPv4 or bracket-less IPv6. A leading '-' is rejected so the value can never
// be read as an option by the system `ping`.
const HOST = /^(?!-)[A-Za-z0-9.\-:]{1,253}$/

export function isValidHost(host: string): boolean {
  return HOST.test(host)
}

// Accepts "host:port" and "[ipv6]:port".
export function parseTcpTarget(target: string): { host: string; port: number } | null {
  const m = target.trim().match(/^\[([^\]]+)\]:(\d+)$/) ?? target.trim().match(/^([^:]+):(\d+)$/)
  if (!m) return null
  const port = Number(m[2])
  if (!isValidHost(m[1]) || !(port >= 1 && port <= 65535)) return null
  return { host: m[1], port }
}

// What a check actually hits, for labels and notifications.
export function checkLabel(entry: Pick<AppEntry, 'checkType' | 'target' | 'url' | 'healthUrl'>): string {
  const type = entry.checkType ?? 'http'
  if (type === 'tcp') return `tcp://${entry.target}`
  if (type === 'ping') return `ping ${entry.target}`
  return entry.healthUrl || entry.url
}
