// preload 注入到 window.api 的接口定义（纯类型，渲染进程与主进程共用契约）

import type {
  SaveResult,
  Settings,
  Suggestion,
  SyncResult,
  ToastPayload,
  WordDetail,
  WordSummary
} from './types'

/** 渲染进程可用的全部 API（由 preload 通过 contextBridge 注入） */
export interface Api {
  listWords(sort: string): Promise<WordSummary[]>
  searchWords(q: string): Promise<WordSummary[]>
  getWord(word: string): Promise<WordDetail | null>
  deleteWord(word: string): Promise<void>
  updateNote(word: string, note: string): Promise<void>
  lookupLocal(word: string): Promise<Suggestion[]>
  lookupWord(word: string): Promise<WordDetail>
  saveWord(word: string): Promise<SaveResult>
  gitSync(): Promise<SyncResult>
  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>
  exportBackup(): Promise<string>
  importBackup(): Promise<void>
  /** ESC 收起主窗口（隐藏到托盘） */
  hideWindow(): Promise<void>
  /** 订阅 Toast，返回取消函数 */
  onToast(cb: (p: ToastPayload) => void): () => void
  /** 订阅托盘「设置」事件，返回取消函数 */
  onOpenSettings(cb: () => void): () => void
}
