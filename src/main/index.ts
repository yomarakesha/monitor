import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { join } from 'path'
import * as store from './store'
import * as monitor from './monitor'
import { PARTITION } from './monitor'
import type { AppEntry, AppInput } from '../shared/types'
import icon from '../../build/icon.png?asset'

function validateUrl(url: string): void {
  const u = new URL(url)
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('URL must be http(s)')
}

function validate(input: AppInput): void {
  validateUrl(input.url)
  if (input.healthUrl) validateUrl(input.healthUrl)
  if (!input.name.trim()) throw new Error('Name is required')
  const s = input.expectedStatus
  if (s !== undefined && !(Number.isInteger(s) && s >= 100 && s <= 599)) throw new Error('Expected status must be 100–599')
  for (const n of [input.slowMs, input.failThreshold, input.refreshMin]) {
    if (n !== undefined && !(Number.isFinite(n) && n >= 0)) throw new Error('Numbers must be non-negative')
  }
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
  })
  ipcMain.handle('apps:check', (_e, id: string) => {
    const entry = store.get(id)
    if (entry) return monitor.check(entry)
  })
  ipcMain.handle('status:all', () => monitor.allStatuses())
}

// Webviews accept self-signed certs only for hosts registered as local apps.
function allowLocalCerts(): void {
  session.fromPartition(PARTITION).setCertificateVerifyProc((req, cb) => {
    const isLocal = store.list().some((e) => e.kind === 'local' && new URL(e.url).hostname === req.hostname)
    cb(isLocal ? 0 : -3)
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
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

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
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
  createWindow()
  store.list().forEach(monitor.schedule)
})

app.on('window-all-closed', () => app.quit())
