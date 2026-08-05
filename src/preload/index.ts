// 预加载脚本：通过 contextBridge 安全暴露主进程 API 给渲染进程
import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '@shared/api'
import type { Settings, ToastPayload } from '@shared/types'

const api: Api = {
  listWords: (sort) => ipcRenderer.invoke('list_words', sort),
  searchWords: (q) => ipcRenderer.invoke('search_words', q),
  getWord: (word) => ipcRenderer.invoke('get_word', word),
  deleteWord: (word) => ipcRenderer.invoke('delete_word', word),
  updateNote: (word, note) => ipcRenderer.invoke('update_note', word, note),
  lookupLocal: (word) => ipcRenderer.invoke('lookup_local', word),
  lookupWord: (word) => ipcRenderer.invoke('lookup_word', word),
  saveWord: (word) => ipcRenderer.invoke('save_word', word),
  gitSync: () => ipcRenderer.invoke('git_sync'),
  getSettings: () => ipcRenderer.invoke('get_settings'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('save_settings', settings),
  exportBackup: () => ipcRenderer.invoke('export_backup'),
  importBackup: () => ipcRenderer.invoke('import_backup'),
  hideWindow: () => ipcRenderer.invoke('hide_window'),

  onToast: (cb: (p: ToastPayload) => void) => {
    const listener = (_e: unknown, payload: ToastPayload): void => cb(payload)
    ipcRenderer.on('toast', listener)
    return () => ipcRenderer.removeListener('toast', listener)
  },
  onOpenSettings: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('open-settings', listener)
    return () => ipcRenderer.removeListener('open-settings', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
