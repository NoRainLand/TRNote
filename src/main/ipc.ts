// IPC 命令层：注册全部主进程处理器（渲染进程通过 preload 的 window.api 调用）

import { dialog, ipcMain, shell } from 'electron'
import { existsSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import type { Settings, WordDetail } from '@shared/types'
import { makeT } from '@shared/i18n'
import * as db from './db'
import * as backup from './backup'
import type { DictResult } from './dict'
import { closeDict, dictDataDir, getDict, initDict } from './dict'
import { gitSync } from './gitSync'
import { applyHotkey } from './hotkey'
import * as translate from './translate'
import { downloadDict } from './dictDownload'
import { refreshTray } from './tray'
import { getMainWindow, sendToRenderer, showMain } from './window'

/** 由词典结果构造词条详情 */
function detailFromDict(word: string, dr: DictResult): WordDetail {
  const now = new Date().toISOString()
  return {
    word,
    phoneticUk: dr.phonetic,
    phoneticUs: null,
    senses: dr.senses,
    forms: dr.forms,
    note: null,
    createdAt: now,
    updatedAt: now
  }
}

/** 向前端推送 Toast */
function toast(message: string, ok = true, retry = false): void {
  sendToRenderer('toast', { message, ok, retry })
}

/** 导出保存对话框 */
async function pickSavePath(): Promise<string> {
  const win = getMainWindow()
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const defaultPath = `trnote_backup_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.db`
  const t = makeT(db.loadSettings().lang)
  const opts = {
    title: t('exportTitle'),
    defaultPath,
    filters: [{ name: t('dbFilter'), extensions: ['db'] }]
  }
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (r.canceled || !r.filePath) throw new Error(t('errCancelExport'))
  return r.filePath
}

/** 导入打开对话框 */
async function pickOpenPath(): Promise<string> {
  const win = getMainWindow()
  const t = makeT(db.loadSettings().lang)
  const opts = {
    title: t('importTitle'),
    filters: [{ name: t('dbFilter'), extensions: ['db'] }],
    properties: ['openFile'] as Array<'openFile'>
  }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths.length) throw new Error(t('errCancelImport'))
  return r.filePaths[0]
}

/** 注册全部 IPC 处理器 */
export function registerIpc(): void {
  ipcMain.handle('ping', () => 'pong')

  // ESC 快捷键收起主窗口（渲染进程监听 ESC 后调用）
  ipcMain.handle('hide_window', () => {
    getMainWindow()?.hide()
  })

  ipcMain.handle('list_words', (_e, sort: string) => db.listWords(sort))
  ipcMain.handle('search_words', (_e, q: string) => db.searchWords(q))
  ipcMain.handle('get_word', (_e, word: string) => db.getWord(word))
  ipcMain.handle('delete_word', (_e, word: string) => db.deleteWord(word))
  ipcMain.handle('update_note', (_e, word: string, note: string) => db.updateNote(word, note))
  ipcMain.handle('lookup_local', (_e, word: string) => getDict().suggest(word, 10))

  // 完整查词：本地优先，未命中走网络兜底（不保存）
  ipcMain.handle('lookup_word', async (_e, word: string) => {
    const w = word.trim().toLowerCase()
    const t = makeT(db.loadSettings().lang)
    if (!w) throw new Error(t('errNeedWord'))
    const dr = getDict().lookup(w) ?? (await translate.lookupOnline(w, db.loadSettings().apiOrder))
    return detailFromDict(w, dr)
  })

  // 收录单词：查词 → 入库 → 自动 Git 同步 → Toast 提示
  ipcMain.handle('save_word', async (_e, word: string) => {
    const w = word.trim().toLowerCase()
    const t = makeT(db.loadSettings().lang)
    if (!w) throw new Error(t('errNeedWord'))
    const dr = getDict().lookup(w) ?? (await translate.lookupOnline(w, db.loadSettings().apiOrder))
    const inserted = db.upsertWord(detailFromDict(w, dr))
    const settings = db.loadSettings()

    let msg = t('toastSaved', { word: w })
    let ok = true
    if (settings.autoSync && settings.repoUrl) {
      const res = await gitSync(settings.repoUrl)
      ok = res.ok
      msg = res.ok ? t('toastSavedSynced', { word: w }) : t('toastSavedSyncFail', { word: w })
    }
    toast(msg, ok, !ok)
    return {
      saved: inserted,
      word: w,
      message: inserted ? t('saveSaved') : t('saveExists')
    }
  })

  // 手动同步（设置页「立即同步」按钮）
  ipcMain.handle('git_sync', async () => {
    const settings = db.loadSettings()
    const t = makeT(settings.lang)
    const res = settings.repoUrl
      ? await gitSync(settings.repoUrl)
      : { ok: false, message: t('errNoGit') }
    toast(res.message, res.ok, !res.ok)
    return res
  })

  ipcMain.handle('get_settings', () => db.loadSettings())

  // 保存设置：快捷键变更时即时重新注册；语言变化时重建托盘菜单
  ipcMain.handle('save_settings', (_e, s: Settings) => {
    db.saveSettings(s)
    applyHotkey(s.hotkey, showMain)
    refreshTray()
  })

  ipcMain.handle('export_backup', async () => {
    const path = await pickSavePath()
    return backup.exportBackup(path)
  })

  ipcMain.handle('import_backup', async () => {
    const path = await pickOpenPath()
    await backup.importBackup(path)
    toast(makeT(db.loadSettings().lang)('toastImported'), true, false)
  })

  // 本地完整词库（ECDICT）状态
  ipcMain.handle('dict_status', () => {
    const p = join(dictDataDir(), 'ecdict.db')
    if (!existsSync(p)) return { installed: false, sizeBytes: 0, wordCount: null }
    return { installed: true, sizeBytes: statSync(p).size, wordCount: null }
  })

  // 下载并安装完整词库（进度经 dict-progress 事件推送）
  ipcMain.handle('download_dict', async () => {
    const res = await downloadDict((prog) => sendToRenderer('dict-progress', prog))
    toast(res.message, res.ok, !res.ok)
    return res
  })

  // 打开本地词典文件夹（资源管理器）
  ipcMain.handle('open_dict_folder', async () => {
    const dir = dictDataDir()
    const err = await shell.openPath(dir)
    return { ok: !err, message: err || dir }
  })

  // 删除本地完整词库（先关连接再删文件，恢复内置小词表）
  ipcMain.handle('delete_dict', () => {
    const dir = dictDataDir()
    closeDict()
    let freed = 0
    for (const name of ['ecdict.db', 'ecdict.db-shm', 'ecdict.db-wal']) {
      const p = join(dir, name)
      if (existsSync(p)) {
        freed += statSync(p).size
        try {
          rmSync(p, { force: true })
        } catch {
          /* 忽略 */
        }
      }
    }
    initDict()
    const t = makeT(db.loadSettings().lang)
    const msg = t('dictDeleted', { mb: (freed / 1048576).toFixed(0) })
    toast(msg, true, false)
    return { ok: true, message: msg }
  })
}
