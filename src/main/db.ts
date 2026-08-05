// 数据层：生词库与配置的 SQLite 读写（better-sqlite3，同步 API）
// 表结构与需求文档 §8 一致：
//   words(id, word UNIQUE, phonetic_uk, phonetic_us, note, created_at, updated_at)
//   senses(id, word_id, pos, meaning, example, sort)
//   forms(id, word_id, type, value)
//   settings(key, value)

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type { Sense, Settings, WordDetail, WordForm, WordSummary } from '@shared/types'

export interface DbHandle {
  conn: Database.Database
  path: string
  dataDir: string
}

let handle: DbHandle | null = null

/** 初始化数据库（单例）；数据文件位于 userData 目录 */
export function getDb(): DbHandle {
  if (handle) return handle
  const dataDir = app.getPath('userData')
  const path = join(dataDir, 'trnote.db')
  const conn = new Database(path)
  conn.pragma('journal_mode = WAL')
  conn.pragma('foreign_keys = ON')
  conn.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      phonetic_uk TEXT,
      phonetic_us TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS senses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      pos TEXT NOT NULL,
      meaning TEXT NOT NULL,
      example TEXT,
      sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  handle = { conn, path, dataDir }
  return handle
}

interface WordRow {
  word: string
  summary: string
  created_at: string
}
interface WordDetailRow {
  phonetic_uk: string | null
  phonetic_us: string | null
  note: string | null
  created_at: string
  updated_at: string
}
interface SenseRow {
  pos: string
  meaning: string
  example: string | null
}
interface FormRow {
  type: string
  value: string
}
interface SettingRow {
  value: string
}

/** 列表：new=最新在上，alpha=字母序 */
export function listWords(sort: string): WordSummary[] {
  const { conn } = getDb()
  const order =
    sort === 'alpha' ? 'w.word COLLATE NOCASE ASC, w.id ASC' : 'w.created_at DESC, w.id DESC'
  const sql = `SELECT w.word,
      COALESCE((SELECT s.meaning FROM senses s WHERE s.word_id=w.id ORDER BY s.sort, s.id LIMIT 1), '') AS summary,
      w.created_at
    FROM words w ORDER BY ${order}`
  return (conn.prepare(sql).all() as WordRow[]).map((r) => ({
    word: r.word,
    summary: r.summary,
    createdAt: r.created_at
  }))
}

/** 全文检索：单词 / 释义 / 例句 / 备注 */
export function searchWords(q: string): WordSummary[] {
  const { conn } = getDb()
  const like = `%${q}%`
  const rows = conn
    .prepare(
      `SELECT DISTINCT w.word,
        COALESCE((SELECT s.meaning FROM senses s WHERE s.word_id=w.id ORDER BY s.sort, s.id LIMIT 1), '') AS summary,
        w.created_at
       FROM words w LEFT JOIN senses s ON s.word_id = w.id
       WHERE w.word LIKE ? OR s.meaning LIKE ? OR s.example LIKE ? OR w.note LIKE ?
       ORDER BY w.created_at DESC`
    )
    .all(like, like, like, like) as WordRow[]
  return rows.map((r) => ({ word: r.word, summary: r.summary, createdAt: r.created_at }))
}

function wordId(word: string): number | undefined {
  const r = getDb()
    .conn.prepare('SELECT id FROM words WHERE word=?')
    .get(word) as { id: number } | undefined
  return r?.id
}

/** 查询单词详情 */
export function getWord(word: string): WordDetail | null {
  const { conn } = getDb()
  const id = wordId(word)
  if (id === undefined) return null
  const row = conn
    .prepare('SELECT phonetic_uk, phonetic_us, note, created_at, updated_at FROM words WHERE id=?')
    .get(id) as WordDetailRow | undefined
  if (!row) return null
  const senses = (
    conn.prepare('SELECT pos, meaning, example FROM senses WHERE word_id=? ORDER BY sort, id').all(id) as SenseRow[]
  ).map((s): Sense => ({ pos: s.pos, meaning: s.meaning, example: s.example }))
  const forms = (
    conn.prepare('SELECT type, value FROM forms WHERE word_id=?').all(id) as FormRow[]
  ).map((f): WordForm => ({ type: f.type, value: f.value }))
  return {
    word,
    phoneticUk: row.phonetic_uk,
    phoneticUs: row.phonetic_us,
    senses,
    forms,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/** 删除单词（级联删除释义与词形） */
export function deleteWord(word: string): void {
  getDb().conn.prepare('DELETE FROM words WHERE word=?').run(word)
}

/** 更新备注 */
export function updateNote(word: string, note: string): void {
  const now = new Date().toISOString()
  getDb().conn.prepare('UPDATE words SET note=?, updated_at=? WHERE word=?').run(note, now, word)
}

/** 收录（新增或更新释义，保留备注）；返回 true=新增 */
export function upsertWord(detail: WordDetail): boolean {
  const { conn } = getDb()
  const now = new Date().toISOString()
  const id = wordId(detail.word)
  const insertSense = conn.prepare(
    'INSERT INTO senses (word_id, pos, meaning, example, sort) VALUES (?,?,?,?,?)'
  )
  const insertForm = conn.prepare('INSERT INTO forms (word_id, type, value) VALUES (?,?,?)')
  const saveParts = (wid: number): void => {
    detail.senses.forEach((s, i) => insertSense.run(wid, s.pos, s.meaning, s.example ?? null, i))
    detail.forms.forEach((f) => insertForm.run(wid, f.type, f.value))
  }

  if (id !== undefined) {
    conn
      .prepare('UPDATE words SET phonetic_uk=?, phonetic_us=?, updated_at=? WHERE id=?')
      .run(detail.phoneticUk ?? null, detail.phoneticUs ?? null, now, id)
    conn.prepare('DELETE FROM senses WHERE word_id=?').run(id)
    conn.prepare('DELETE FROM forms WHERE word_id=?').run(id)
    saveParts(id)
    return false
  }

  const info = conn
    .prepare(
      'INSERT INTO words (word, phonetic_uk, phonetic_us, note, created_at, updated_at) VALUES (?,?,?,?,?,?)'
    )
    .run(detail.word, detail.phoneticUk ?? null, detail.phoneticUs ?? null, detail.note ?? null, now, now)
  saveParts(Number(info.lastInsertRowid))
  return true
}

/* ---------- 设置（settings 表，key-value） ---------- */

export function getSetting(key: string): string | undefined {
  const r = getDb()
    .conn.prepare('SELECT value FROM settings WHERE key=?')
    .get(key) as SettingRow | undefined
  return r?.value
}

export function setSetting(key: string, value: string): void {
  getDb()
    .conn.prepare(
      'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
    )
    .run(key, value)
}

/** 读取全部设置（缺失项使用默认值） */
export function loadSettings(): Settings {
  const s: Settings = {
    repoUrl: null,
    hotkey: 'Ctrl+Alt+T',
    autoSave: true,
    autoSync: true,
    apiOrder: ['google', 'youdao', 'baidu']
  }
  const repo = getSetting('repo_url')
  if (repo && repo.trim()) s.repoUrl = repo
  const hotkey = getSetting('hotkey')
  if (hotkey && hotkey.trim()) s.hotkey = hotkey
  const autoSave = getSetting('auto_save')
  if (autoSave !== undefined) s.autoSave = autoSave === '1'
  const autoSync = getSetting('auto_sync')
  if (autoSync !== undefined) s.autoSync = autoSync === '1'
  const order = getSetting('api_order')
  if (order) {
    try {
      const list = JSON.parse(order) as string[]
      if (list.length) s.apiOrder = list
    } catch {
      /* 忽略坏数据 */
    }
  }
  return s
}

/** 持久化全部设置 */
export function saveSettings(s: Settings): void {
  setSetting('repo_url', s.repoUrl ?? '')
  setSetting('hotkey', s.hotkey)
  setSetting('auto_save', s.autoSave ? '1' : '0')
  setSetting('auto_sync', s.autoSync ? '1' : '0')
  setSetting('api_order', JSON.stringify(s.apiOrder))
}
