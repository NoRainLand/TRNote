// 打包后精简体积（electron-builder afterPack 钩子）
// 1) 删除多余语言包（只保留 中文简/繁 + 英文），可省 ~38MB
// 2) 删除 better-sqlite3 自带的 sqlite 源码（运行时只用到编译好的 .node），可省 ~8.8MB
// 注意：本脚本在 electron-builder 的 Node 环境运行（CommonJS）

const fs = require('fs')
const path = require('path')

/** 保留的语言包：中文简体、中文繁体、英文（其余全部删除） */
const KEEP_LOCALES = new Set(['zh-CN.pak', 'zh-TW.pak', 'en-US.pak'])

function trimLocales(appOutDir) {
  const localesDir = path.join(appOutDir, 'locales')
  if (!fs.existsSync(localesDir)) return
  for (const f of fs.readdirSync(localesDir)) {
    if (f.endsWith('.pak') && !KEEP_LOCALES.has(f)) {
      try {
        fs.unlinkSync(path.join(localesDir, f))
      } catch {
        /* 忽略删除失败 */
      }
    }
  }
}

function trimSqliteSource(appOutDir) {
  const depsDir = path.join(
    appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'better-sqlite3',
    'deps'
  )
  if (fs.existsSync(depsDir)) {
    try {
      fs.rmSync(depsDir, { recursive: true, force: true })
    } catch {
      /* 忽略删除失败 */
    }
  }
}

module.exports = async function afterPack(context) {
  const { appOutDir, electronPlatformName } = context
  if (!appOutDir) return
  if (electronPlatformName !== 'win32' && electronPlatformName !== 'linux' && electronPlatformName !== 'darwin') {
    return
  }
  trimLocales(appOutDir)
  trimSqliteSource(appOutDir)
  console.log('[after-pack] 已精简包体：删除多余语言包 + better-sqlite3 源码')
}
