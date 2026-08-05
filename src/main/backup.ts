// 备份与恢复：基于 better-sqlite3 的在线备份 API，可热备份/恢复

import Database from 'better-sqlite3'
import { getDb } from './db'

/** 导出备份：把当前数据库完整复制到目标路径 */
export async function exportBackup(dest: string): Promise<string> {
  const { conn } = getDb()
  await conn.backup(dest)
  return dest
}

/** 导入备份：校验后把备份内容整体覆盖到当前数据库 */
export async function importBackup(src: string): Promise<void> {
  const srcDb = new Database(src)
  try {
    // 校验：备份中必须包含本应用的 words 表
    const row = srcDb
      .prepare("SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name='words'")
      .get() as { c: number }
    if (!row || row.c === 0) throw new Error('所选文件不是有效的 TRNote 备份')

    // 先 checkpoint 当前库，再把备份内容覆盖到主库文件
    const { conn, path } = getDb()
    conn.pragma('wal_checkpoint(TRUNCATE)')
    await srcDb.backup(path)
  } finally {
    srcDb.close()
  }
}
