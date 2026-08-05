// 渲染进程桥接：preload 注入的 window.api（见 src/preload/index.ts）
import type { Api } from '@shared/api'

declare global {
  interface Window {
    api: Api
  }
}

/** 主进程 API（由 preload 注入） */
export const api = window.api

/** 订阅 Toast 事件（自动消失提示），返回取消函数 */
export function onToast(cb: Parameters<Api['onToast']>[0]): () => void {
  return window.api.onToast(cb)
}

/** 订阅托盘「设置」事件，返回取消函数 */
export function onOpenSettings(cb: () => void): () => void {
  return window.api.onOpenSettings(cb)
}
