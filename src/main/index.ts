import { app, BrowserWindow, dialog, ipcMain, screen, session, shell } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as store from './store'
import * as monitor from './monitor'
import * as settings from './settings'
import * as notify from './notify'
import * as tray from './tray'
import * as autostart from './autostart'
import * as history from './history'
import { PARTITION } from './monitor'
import type { AppEntry, AppInput, HistoryRange, ImportResult, NotifyChannel, SettingsInput } from '../shared/types'
import icon from '../../build/icon.png?asset'

const EXPORT_VERSION = 1

let win: BrowserWindow | null = null
let quitting = false

function validateUrl(url: string): void {
  const u = new URL(url)
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('URL must be http(s)')
}

function validate(input: AppInput): void {
  validateUrl(input.url)
  if (input.healthUrl) validateUrl(input.healthUrl)
  if (!input.name.trim()) throw new Error('Name is required')
  if (input.kind !== 'internet' && input.kind !== 'local') throw new Error('Unknown kind')
  // Bounds keep timer delays far below setInterval's 2^31-1 ms limit, past which timers fire immediately.
  const inRange = (n: number | undefined, min: number, max: number, label: string, optional = true) => {
    if (n === undefined && optional) return
    if (!(Number.isInteger(n) && n! >= min && n! <= max)) throw new Error(`${label} must be an integer ${min}–${max}`)
  }
  inRange(input.intervalSec, 5, 86_400, 'Interval', false)
  inRange(input.expectedStatus, 100, 599, 'Expected status')
  inRange(input.slowMs, 0, 600_000, 'Slow threshold')
  inRange(input.failThreshold, 1, 100, 'Fail threshold')
  inRange(input.refreshMin, 0, 1440, 'Refresh period')
}

// Hosts that plausibly belong to a local network, judged by name only (no DNS lookup).
function isPrivateHost(url: string): boolean {
  const h = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || /\.(localhost|local|lan|internal|home\.arpa)$/.test(h)) return true
  const v4 = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  }
  return h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h)
}

// Keeps only known fields of an imported record, so a hand-edited file cannot inject anything else.
function normalize(raw: Record<string, unknown>): AppInput {
  const opt = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v))
  const input: AppInput = {
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    url: String(raw.url ?? ''),
    kind: raw.kind === 'local' ? 'local' : 'internet',
    intervalSec: raw.intervalSec === undefined ? 30 : Number(raw.intervalSec),
    healthUrl: raw.healthUrl ? String(raw.healthUrl) : undefined,
    expectedStatus: opt(raw.expectedStatus),
    slowMs: opt(raw.slowMs),
    failThreshold: opt(raw.failThreshold),
    refreshMin: opt(raw.refreshMin)
  }
  validate(input)
  return input
}

async function exportApps(): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(win!, {
    defaultPath: 'monitor-apps.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePath) return null
  const apps = store.list().map(({ id: _, ...rest }) => rest)
  writeFileSync(filePath, JSON.stringify({ version: EXPORT_VERSION, apps }, null, 2))
  return filePath
}

async function importApps(): Promise<ImportResult | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (canceled || !filePaths[0]) return null
  const data = JSON.parse(readFileSync(filePaths[0], 'utf8'))
  const records: unknown = Array.isArray(data) ? data : data?.apps
  if (!Array.isArray(records)) throw new Error('В файле нет списка приложений')

  const key = (a: { url: string; kind: string }) => `${a.kind} ${a.url}`
  const existing = new Set(store.list().map(key))
  const fresh: AppInput[] = []
  let skipped = 0
  for (const raw of records) {
    let input: AppInput
    try {
      input = normalize(raw)
    } catch {
      skipped++
      continue
    }
    if (existing.has(key(input))) {
      skipped++
      continue
    }
    existing.add(key(input))
    fresh.push(input)
  }
  // "local" disables certificate checks for the host, so a file must not do that silently for public hosts.
  const publicLocal = fresh.filter((a) => a.kind === 'local' && !isPrivateHost(a.url))
  if (publicLocal.length > 0) {
    const hosts = [...new Set(publicLocal.map((a) => new URL(a.url).host))]
    const { response } = await dialog.showMessageBox(win!, {
      type: 'warning',
      message: 'Некоторые Local Apps указывают на внешние адреса',
      detail: `Для Local Apps проверка HTTPS-сертификата отключена. Внешние хосты:\n${hosts.join('\n')}`,
      buttons: ['Импортировать как Internet Apps', 'Оставить Local', 'Отмена'],
      defaultId: 0,
      cancelId: 2
    })
    if (response === 2) return null
    if (response === 0) publicLocal.forEach((a) => (a.kind = 'internet'))
  }
  store.createMany(fresh).forEach(monitor.schedule)
  return { added: fresh.length, skipped }
}

function applySettings(input: SettingsInput) {
  const before = settings.get()
  const saved = settings.set(input)
  if (saved.autostart !== before.autostart) autostart.apply(saved.autostart)
  return saved
}

function registerIpc(): void {
  ipcMain.handle('apps:list', () => store.list())
  ipcMain.handle('apps:create', (_e, input: AppInput) => {
    validate(input)
    const entry = store.create(input)
    monitor.schedule(entry)
    return entry
  })
  ipcMain.handle('apps:update', (_e, entry: AppEntry) => {
    validate(entry)
    const saved = store.update(entry)
    monitor.schedule(saved)
    return saved
  })
  ipcMain.handle('apps:remove', (_e, id: string) => {
    store.remove(id)
    monitor.unschedule(id)
    history.remove(id)
    tray.update()
  })
  ipcMain.handle('apps:check', (_e, id: string) => {
    const entry = store.get(id)
    if (entry) return monitor.check(entry)
  })
  ipcMain.handle('apps:export', () => exportApps())
  ipcMain.handle('apps:import', () => importApps())
  ipcMain.handle('status:all', () => monitor.allStatuses())
  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:set', (_e, input: SettingsInput) => applySettings(input))
  ipcMain.handle('history:uptimes', () => history.uptimes())
  ipcMain.handle('history:get', (_e, id: string, range: HistoryRange) => history.history(id, range))
  ipcMain.handle('notify:test', (_e, channel: NotifyChannel) => notify.test(channel))
}

// Webviews accept self-signed certs only for hosts registered as local apps.
function allowLocalCerts(): void {
  session.fromPartition(PARTITION).setCertificateVerifyProc((req, cb) => {
    const isLocal = store.list().some((e) => e.kind === 'local' && new URL(e.url).hostname === req.hostname)
    cb(isLocal ? 0 : -3)
  })
}

function showWindow(): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// Saved bounds are dropped if the display they were on is gone or no longer contains them.
function initialBounds() {
  const saved = settings.windowBounds()
  if (!saved) return { width: 1400, height: 900 }
  const area = screen.getDisplayMatching(saved).workArea
  const visible =
    saved.x < area.x + area.width && saved.x + saved.width > area.x && saved.y < area.y + area.height && saved.y + saved.height > area.y
  return visible ? saved : { width: saved.width, height: saved.height }
}

function trackBounds(w: BrowserWindow): void {
  let timer: NodeJS.Timeout | undefined
  const persist = () => {
    clearTimeout(timer)
    if (w.isDestroyed() || w.isMinimized()) return
    // While maximized, keep the normal bounds so un-maximizing after restart restores them.
    const b = w.isMaximized() ? w.getNormalBounds() : w.getBounds()
    settings.setWindowBounds({ x: b.x, y: b.y, width: b.width, height: b.height, maximized: w.isMaximized() })
  }
  const debounced = () => {
    clearTimeout(timer)
    timer = setTimeout(persist, 500)
  }
  w.on('resize', debounced)
  w.on('move', debounced)
  w.on('maximize', persist)
  w.on('unmaximize', persist)
  w.on('close', persist)
}

function createWindow(hidden: boolean): void {
  const bounds = initialBounds()
  win = new BrowserWindow({
    ...bounds,
    show: false,
    backgroundColor: '#0f1115',
    title: 'Monitor',
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      webviewTag: true
    }
  })
  monitor.setTarget(win.webContents)
  trackBounds(win)
  // maximize() also shows the window, so it waits until the window is meant to be visible.
  if (settings.windowBounds()?.maximized) win.once('show', () => win?.maximize())
  if (!hidden) win.once('ready-to-show', () => win?.show())

  win.on('close', (e) => {
    if (!quitting && settings.get().closeToTray) {
      e.preventDefault()
      win?.hide()
    }
  })
  win.on('closed', () => (win = null))

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function quit(): void {
  quitting = true
  app.quit()
}

// A second launch (e.g. from the menu while hidden in the tray) focuses the running instance.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)

  app.whenReady().then(() => {
    history.open()
    monitor.onStatus(history.record)
    registerIpc()
    allowLocalCerts()
    // Links opened from inside monitored apps go to the system browser.
    app.on('web-contents-created', (_e, wc) => {
      if (wc.getType() === 'webview') {
        wc.setWindowOpenHandler(({ url }) => {
          shell.openExternal(url)
          return { action: 'deny' }
        })
      }
    })
    const s = settings.get()
    // Starting hidden only makes sense when the tray can bring the window back.
    const hidden = s.closeToTray && (s.startHidden || process.argv.includes(autostart.HIDDEN_ARG))
    createWindow(hidden)
    notify.init(showWindow)
    monitor.onTransition(notify.transition)
    tray.create({ show: showWindow, checkAll: () => store.list().forEach(monitor.check), quit })
    store.list().forEach(monitor.schedule)
  })

  app.on('before-quit', () => (quitting = true))
  app.on('window-all-closed', () => app.quit())
}
