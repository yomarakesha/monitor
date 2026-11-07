import { app } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import type { AppEntry, AppInput } from '../shared/types'

const file = () => join(app.getPath('userData'), 'apps.json')

let cache: AppEntry[] | null = null

function load(): AppEntry[] {
  if (cache) return cache
  try {
    cache = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : []
  } catch (err) {
    console.error('Failed to read apps.json, starting empty:', err)
    cache = []
  }
  return cache!
}

function save(): void {
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(cache, null, 2))
  renameSync(tmp, file())
}

export function list(): AppEntry[] {
  return load()
}

export function get(id: string): AppEntry | undefined {
  return load().find((e) => e.id === id)
}

export function create(input: AppInput): AppEntry {
  const entry: AppEntry = { ...input, id: randomUUID() }
  load().push(entry)
  save()
  return entry
}

export function update(entry: AppEntry): AppEntry {
  const items = load()
  const i = items.findIndex((e) => e.id === entry.id)
  if (i === -1) throw new Error(`App ${entry.id} not found`)
  items[i] = entry
  save()
  return entry
}

export function remove(id: string): void {
  cache = load().filter((e) => e.id !== id)
  save()
}

export function createMany(inputs: AppInput[]): AppEntry[] {
  const entries = inputs.map((input) => ({ ...input, id: randomUUID() }))
  load().push(...entries)
  save()
  return entries
}
