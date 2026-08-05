// IPC 命令层：注册全部主进程处理器（渲染进程通过 preload 的 window.api 调用）

import { dialog, ipcMain } from 'electron'
import type { Settings, WordDetail } from '@shared/types'
import * as db from './db'
import * as backup from './backup'
import type { DictResult } from './dict'
import { getDict } from './dict'
import { gitSync } from './gitSync'
import { applyHotkey } from './hotkey'
import * as translate from './translate'
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
  const opts = {
    title: '导出备份',
    defaultPath,
    filters: [{ name: 'SQLite 数据库', extensions: ['db'] }]
  }
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (r.canceled || !r.filePath) throw new Error('已取消导出')
  return r.filePath
}

/** 导入打开对话框 */
async function pickOpenPath(): Promise<string> {
  const win = getMainWindow()
  const opts = {
    title: '导入备份',
    filters: [{ name: 'SQLite 数据库', extensions: ['db'] }],
    properties: ['openFile'] as Array<'openFile'>
  }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (r.canceled || !r.filePaths.length) throw new Error('已取消导入')
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
    if (!w) throw new Error('请输入单词')
    const dr = getDict().lookup(w) ?? (await translate.lookupOnline(w, db.loadSettings().apiOrder))
    return detailFromDict(w, dr)
  })

  // 收录单词：查词 → 入库 → 自动 Git 同步 → Toast 提示
  ipcMain.handle('save_word', async (_e, word: string) => {
    const w = word.trim().toLowerCase()
    if (!w) throw new Error('请输入单词')
    const dr = getDict().lookup(w) ?? (await translate.lookupOnline(w, db.loadSettings().apiOrder))
    const inserted = db.upsertWord(detailFromDict(w, dr))
    const settings = db.loadSettings()

    let msg = `已收录 ${w}`
    let ok = true
    if (settings.autoSync && settings.repoUrl) {
      const res = await gitSync(settings.repoUrl)
      ok = res.ok
      msg = res.ok ? `已收录 ${w}，已自动同步` : `已收录 ${w}，Git 同步失败`
    }
    toast(msg, ok, !ok)
    return {
      saved: inserted,
      word: w,
      message: inserted ? '已收录' : '已存在（已更新释义）'
    }
  })

  // 手动同步（设置页「立即同步」按钮）
  ipcMain.handle('git_sync', async () => {
    const settings = db.loadSettings()
    const res = settings.repoUrl
      ? await gitSync(settings.repoUrl)
      : { ok: false, message: '未配置 Git 仓库链接，请在设置中填写' }
    toast(res.message, res.ok, !res.ok)
    return res
  })

  ipcMain.handle('get_settings', () => db.loadSettings())

  // 保存设置：快捷键变更时即时重新注册
  ipcMain.handle('save_settings', (_e, s: Settings) => {
    db.saveSettings(s)
    applyHotkey(s.hotkey, showMain)
  })

  ipcMain.handle('export_backup', async () => {
    const path = await pickSavePath()
    return backup.exportBackup(path)
  })

  ipcMain.handle('import_backup', async () => {
    const path = await pickOpenPath()
    await backup.importBackup(path)
    toast('备份导入成功', true, false)
  })
}
