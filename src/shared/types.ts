// 主进程 / 渲染进程共享类型（camelCase）

/** 词条摘要（左侧列表：单词=标题，首个释义=摘要） */
export interface WordSummary {
  word: string
  summary: string
  createdAt: string
}

/** 释义（多词性） */
export interface Sense {
  pos: string
  meaning: string
  example?: string | null
}

/** 词形变化 */
export interface WordForm {
  type: string
  value: string
}

/** 词条详情 */
export interface WordDetail {
  word: string
  phoneticUk?: string | null
  phoneticUs?: string | null
  senses: Sense[]
  forms: WordForm[]
  note?: string | null
  createdAt: string
  updatedAt: string
}

/** 本地词典联想建议 */
export interface Suggestion {
  word: string
  phonetic?: string | null
  meaning?: string | null
}

/** 应用设置 */
import type { Lang } from './i18n'

export interface Settings {
  repoUrl?: string | null
  hotkey: string
  autoSave: boolean
  autoSync: boolean
  apiOrder: string[]
  /** 删除单词前是否弹出确认面板（默认关闭：直接删除） */
  confirmDelete: boolean
  /** 界面语言（默认中文） */
  lang: Lang
}

/** 收录结果 */
export interface SaveResult {
  saved: boolean
  word: string
  message: string
}

/** 同步结果 */
export interface SyncResult {
  ok: boolean
  message: string
}

/** Toast 事件负载 */
export interface ToastPayload {
  message: string
  ok: boolean
  retry: boolean
}

/** 渲染进程内的 Toast 项 */
export interface ToastItem extends ToastPayload {
  id: number
}

/** 本地完整词库（ECDICT）状态 */
export interface DictStatus {
  installed: boolean
  sizeBytes: number
  wordCount: number | null
}

/** 词库下载进度（主进程推送） */
export interface DictProgress {
  phase: 'connecting' | 'downloading' | 'extracting' | 'done' | 'error'
  percent: number
  receivedMB: number
  totalMB: number
  message?: string
}

/** 词库下载结果 */
export interface DictDownloadResult {
  ok: boolean
  message: string
}
