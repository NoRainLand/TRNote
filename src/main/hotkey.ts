// 全局快捷键管理（可自定义，默认 Ctrl+Alt+T）
// 注册前先注销旧的，保证设置变更后即时生效
import { globalShortcut } from 'electron'

let current: string | null = null

/** 注册全局快捷键（先注销旧的） */
export function applyHotkey(shortcut: string, onPress: () => void): void {
  if (current) {
    try {
      globalShortcut.unregister(current)
    } catch {
      /* 忽略旧快捷键注销失败 */
    }
  }
  current = shortcut
  try {
    const ok = globalShortcut.register(shortcut, onPress)
    if (!ok) console.warn(`快捷键注册失败（可能被占用）: ${shortcut}`)
  } catch (e) {
    console.warn(`快捷键注册异常: ${String(e)}`)
  }
}

/** 应用退出时清理 */
export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll()
}
