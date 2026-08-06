// 系统托盘：左键单击→主界面；右键菜单→主界面/设置/退出
// 独立模块，便于语言切换后重建菜单（ipc.save_settings 调用 refreshTray）

import { app, Menu, nativeImage, Tray } from 'electron'
import trayIcon from '../../resources/icon.png?asset'
import { makeT } from '@shared/i18n'
import * as db from './db'
import { getMainWindow, showMain } from './window'

let tray: Tray | null = null

/** 创建托盘（菜单文案按当前设置语言生成） */
export function createTray(): void {
  const t = makeT(db.loadSettings().lang)
  const icon = nativeImage.createFromPath(trayIcon)
  tray = new Tray(icon)
  tray.setToolTip(t('trayTooltip'))
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t('trayMain'), click: () => showMain() },
      {
        label: t('traySettings'),
        click: () => {
          showMain()
          getMainWindow()?.webContents.send('open-settings')
        }
      },
      { type: 'separator' },
      {
        label: t('trayQuit'),
        click: () => {
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => showMain()) // 左键单击 → 主界面
}

/** 语言切换后重建托盘菜单 */
export function refreshTray(): void {
  if (!tray) return
  tray.destroy()
  tray = null
  createTray()
}
