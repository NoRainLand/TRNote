// 主窗口管理：保存引用、显示/聚焦、向渲染进程发事件
import { BrowserWindow } from 'electron'

let win: BrowserWindow | null = null

export function setMainWindow(w: BrowserWindow | null): void {
  win = w
}

export function getMainWindow(): BrowserWindow | null {
  return win
}

/** 显示并聚焦主窗口（托盘/快捷键呼出用） */
export function showMain(): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

/** 向渲染进程发送事件 */
export function sendToRenderer(channel: string, ...args: unknown[]): void {
  win?.webContents.send(channel, ...args)
}
