// 下载并安装 ECDICT 完整词库
// 流程：从国内可达的镜像下载压缩包 → 解压（Win10 自带 bsdtar/tar 支持 zip）→
//       找到 .db → 覆盖安装到 <userData>/ecdict.db → 重新加载词典（无需重启）
// 进度通过回调上报，由 IPC 层转发给渲染进程

import { execFile } from 'child_process'
import { get as httpsGet } from 'https'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync
} from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import type { DictDownloadResult, DictProgress } from '@shared/types'
import { makeT } from '@shared/i18n'
import * as db from './db'
import { closeDict, dictDataDir, initDict } from './dict'

const execFileAsync = promisify(execFile)

/** 下载源：国内可达的 GitHub 加速镜像优先，最后回退 GitHub 官方（境外网络直连可用） */
const SOURCES = [
  'https://ghfast.top/https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip',
  'https://gh-proxy.com/https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip',
  'https://ghproxy.net/https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip',
  'https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip'
]

let downloading = false

/**
 * 下载单个文件到 destPath（自动跟随重定向，最多 5 跳），
 * 回调 onProgress(receivedBytes, totalBytes)
 */
function downloadFile(
  url: string,
  destPath: string,
  onProgress: (received: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, redirects: number): void => {
      httpsGet(u, { headers: { 'User-Agent': 'TRNote' } }, (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location && redirects > 0) {
          res.resume()
          follow(new URL(res.headers.location, u).toString(), redirects - 1)
          return
        }
        if (status !== 200) {
          res.resume()
          reject(new Error(`HTTP ${status}`))
          return
        }
        const total = Number(res.headers['content-length']) || 0
        let received = 0
        const out = createWriteStream(destPath)
        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          onProgress(received, total)
        })
        res.pipe(out)
        out.on('finish', () => out.close(() => resolve()))
        out.on('error', reject)
        res.on('error', reject)
      }).on('error', reject)
    }
    follow(url, 5)
  })
}

/** 在目录（含子目录）里找一个体积最大的 .db / .sqlite 文件 */
function findDbFile(dir: string): string | null {
  let bestPath: string | null = null
  let bestSize = -1
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(db|sqlite)$/i.test(name)) {
        const s = statSync(p).size
        if (s > bestSize) {
          bestSize = s
          bestPath = p
        }
      }
    }
  }
  walk(dir)
  return bestPath
}

/**
 * 下载并安装完整词库。onProgress 用于上报各阶段进度。
 */
export async function downloadDict(onProgress: (p: DictProgress) => void): Promise<DictDownloadResult> {
  const t = makeT(db.loadSettings().lang)
  if (downloading) return { ok: false, message: t('errDownloading') }
  downloading = true
  const dataDir = dictDataDir()
  const tmpDir = join(dataDir, '.dict-download')
  const zipPath = join(tmpDir, 'ecdict-sqlite-28.zip')
  const finalPath = join(dataDir, 'ecdict.db')
  try {
    mkdirSync(tmpDir, { recursive: true })

    // 1) 下载（逐个源尝试）
    let lastErr: unknown = null
    for (const url of SOURCES) {
      try {
        onProgress({ phase: 'connecting', percent: 0, receivedMB: 0, totalMB: 0, message: t('dlConnectingMsg') })
        await downloadFile(url, zipPath, (received, total) => {
          onProgress({
            phase: 'downloading',
            percent: total ? Math.min(100, Math.round((received / total) * 100)) : 0,
            receivedMB: received / 1048576,
            totalMB: total / 1048576
          })
        })
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        try {
          rmSync(zipPath, { force: true })
        } catch {
          /* 忽略 */
        }
      }
    }
    if (lastErr) throw lastErr

    // 2) 解压
    onProgress({ phase: 'extracting', percent: 100, receivedMB: 0, totalMB: 0, message: t('dlExtracting') })
    await execFileAsync('tar', ['-xf', zipPath, '-C', tmpDir])

    // 3) 找到数据库并覆盖安装（先关闭旧连接，避免 Windows 文件占用导致失败）
    const dbFile = findDbFile(tmpDir)
    if (!dbFile) throw new Error(t('errNoDb'))
    closeDict()
    renameSync(dbFile, finalPath)

    // 4) 清理临时文件并重新加载词典
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* 忽略 */
    }
    initDict()

    onProgress({ phase: 'done', percent: 100, receivedMB: 0, totalMB: 0, message: t('dlDone') })
    return { ok: true, message: t('dictInstalledMsg', { mb: (statSync(finalPath).size / 1048576).toFixed(1) }) }
  } catch (e) {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* 忽略 */
    }
    onProgress({ phase: 'error', percent: 0, receivedMB: 0, totalMB: 0, message: String(e) })
    return { ok: false, message: `词库下载失败：${String(e)}` }
  } finally {
    downloading = false
  }
}
