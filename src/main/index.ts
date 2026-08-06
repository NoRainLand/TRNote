// TRNote 主进程入口（Electron）
// 装配：数据库/词典 → IPC → 主窗口 → 系统托盘 → 全局快捷键
// 行为：关闭窗口隐藏到托盘（不退出）；托盘左键/快捷键呼出主界面

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import trayIcon from '../../resources/icon.png?asset'
import * as db from './db'
import { initDict } from './dict'
import { applyHotkey } from './hotkey'
import { registerIpc } from './ipc'
import { createTray } from './tray'
import { getMainWindow, setMainWindow, showMain } from './window'

let quitting = false

/** 创建主窗口 */
function createWindow(): void {
  const win = new BrowserWindow({
    width: 1000,
    height: 680,
    // 无边框 + 透明：配合 CSS 圆角形成圆角窗体（弹窗式查词）
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false, // 透明窗口在 Windows 不可缩放，使用固定尺寸
    hasShadow: true,
    show: false, // 由 ready-to-show 后统一走 showMain（含防闪烁淡入）
    title: 'TRNote - 生词本',
    icon: trayIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      // 窗口隐藏到托盘时仍保持渲染：避免快捷键呼出时重新绘制导致闪烁
      backgroundThrottling: false
    }
  })
  setMainWindow(win)

  // 内容就绪后再显示（走 showMain 的防闪烁淡入），避免启动时白屏/闪一下
  win.once('ready-to-show', () => showMain())

  // 关闭按钮 → 隐藏到托盘（而非退出），保留后台查词能力
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => setMainWindow(null))

  // 开发模式加载 dev server，否则加载打包后的渲染进程
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 透明窗口在部分 GPU/驱动上会导致渲染进程崩溃，这里统一禁用硬件加速（本应用 UI 简单，软件渲染足够）
app.disableHardwareAcceleration()

app.whenReady().then(() => {
  // 1. 初始化数据层与词典
  db.getDb()
  initDict()
  // 2. 注册 IPC
  registerIpc()
  // 3. 窗口与托盘
  createWindow()
  createTray()
  // 4. 全局快捷键（依据设置）
  applyHotkey(db.loadSettings().hotkey, showMain)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  quitting = true
})

// 窗口全部关闭时不退出（保留托盘），由托盘「退出」结束进程
app.on('window-all-closed', () => {
  /* 保持后台运行 */
})
