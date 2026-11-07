import { contextBridge, ipcRenderer } from 'electron'
import type { Api, Status } from '../shared/types'

const api: Api = {
  list: () => ipcRenderer.invoke('apps:list'),
  create: (input) => ipcRenderer.invoke('apps:create', input),
  update: (entry) => ipcRenderer.invoke('apps:update', entry),
  remove: (id) => ipcRenderer.invoke('apps:remove', id),
  checkNow: (id) => ipcRenderer.invoke('apps:check', id),
  statuses: () => ipcRenderer.invoke('status:all'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (input) => ipcRenderer.invoke('settings:set', input),
  testNotify: (channel) => ipcRenderer.invoke('notify:test', channel),
  exportApps: () => ipcRenderer.invoke('apps:export'),
  importApps: () => ipcRenderer.invoke('apps:import'),
  onStatus: (cb) => {
    const handler = (_e: unknown, s: Status) => cb(s)
    ipcRenderer.on('status:update', handler)
    return () => ipcRenderer.removeListener('status:update', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
