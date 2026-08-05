// Git 自动同步：个人单机场景，直接调用系统 git 命令
// 流程：checkpoint（把 WAL 写入主文件）→ git init(如需) → 配置远程 → add/commit → push
// 失败不阻塞，返回结果由前端 Toast 提示（可重试）

import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import type { SyncResult } from '@shared/types'
import { getDb } from './db'

const exec = promisify(execFile)

/** 在指定目录执行 git 命令，返回输出或抛错 */
async function runGit(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec('git', args, { cwd })
    return stdout.trim()
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    const detail = err.stderr?.trim() || err.stdout?.trim() || String(err.message)
    throw new Error(detail)
  }
}

/** 执行一次同步 */
export async function gitSync(repoUrl: string): Promise<SyncResult> {
  const { conn, dataDir } = getDb()
  const url = repoUrl.trim().replace(/\/+$/, '')
  if (!url) return { ok: false, message: '未配置 Git 仓库链接，请在设置中填写' }

  try {
    // 1. checkpoint：把 WAL 写入主文件，确保 git 提交的是最新数据
    conn.pragma('wal_checkpoint(TRUNCATE)')

    // 2. 首次使用：初始化本地仓库
    if (!existsSync(join(dataDir, '.git'))) {
      await runGit(dataDir, ['init', '-b', 'main'])
      await runGit(dataDir, ['config', 'user.name', 'TRNote'])
      await runGit(dataDir, ['config', 'user.email', 'trnote@local'])
    }

    // 3. 配置远程仓库地址（与上次不同则更新）
    let origin = ''
    try {
      origin = await runGit(dataDir, ['remote', 'get-url', 'origin'])
    } catch {
      /* 尚无远程 */
    }
    if (origin && origin !== url) {
      try {
        await runGit(dataDir, ['remote', 'remove', 'origin'])
      } catch {
        /* 忽略 */
      }
    }
    try {
      await runGit(dataDir, ['remote', 'get-url', 'origin'])
    } catch {
      await runGit(dataDir, ['remote', 'add', 'origin', url])
    }

    // 4. 提交（无改动时 commit 失败，忽略）
    await runGit(dataDir, ['add', '-A'])
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    try {
      await runGit(dataDir, ['commit', '-m', `TRNote 自动同步 ${ts}`])
    } catch {
      /* 无改动 */
    }

    // 5. 推送
    await runGit(dataDir, ['push', '-u', 'origin', 'main'])
    return { ok: true, message: '已自动同步到 Git' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `push 失败：${msg}（可在设置中重试）` }
  }
}
