// 设置窗口（独立弹出）
// 首次使用默认弹出并引导填写 Git 仓库链接；翻译 API 兜底顺序可拖动排序

import { useEffect, useState } from 'react'
import type { Settings } from '../types'

/** 翻译 API 显示名 */
const API_LABELS: Record<string, string> = {
  google: 'Google 翻译',
  youdao: '有道翻译',
  baidu: '百度翻译'
}

interface Props {
  open: boolean
  firstRun: boolean
  settings: Settings | null
  onClose: () => void
  onSave: (s: Settings) => void
  onExport: () => void
  onImport: () => void
  onSync: () => void
}

export default function SettingsWindow({
  open,
  firstRun,
  settings,
  onClose,
  onSave,
  onExport,
  onImport,
  onSync
}: Props) {
  // 表单本地状态
  const [repoUrl, setRepoUrl] = useState('')
  const [hotkey, setHotkey] = useState('Ctrl+Alt+T')
  const [autoSave, setAutoSave] = useState(true)
  const [autoSync, setAutoSync] = useState(true)
  const [apiOrder, setApiOrder] = useState<string[]>(['google', 'youdao', 'baidu'])
  // 拖动排序状态（必须与其它 Hook 一起声明，不能在早退语句之后）
  const [dragging, setDragging] = useState<number | null>(null)

  // 打开时同步外部设置
  useEffect(() => {
    if (settings) {
      setRepoUrl(settings.repoUrl ?? '')
      setHotkey(settings.hotkey)
      setAutoSave(settings.autoSave)
      setAutoSync(settings.autoSync)
      setApiOrder(settings.apiOrder.length ? settings.apiOrder : ['google', 'youdao', 'baidu'])
    }
  }, [open, settings])

  if (!open) return null

  const handleSave = () => {
    onSave({
      repoUrl: repoUrl.trim() || null,
      hotkey: hotkey.trim() || 'Ctrl+Alt+T',
      autoSave,
      autoSync,
      apiOrder
    })
  }

  /* ---- API 兜底顺序：拖动排序 ---- */
  const onDragStart = (i: number) => setDragging(i)
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (dragging === null || dragging === i) return
    setApiOrder((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragging, 1)
      next.splice(i, 0, moved)
      return next
    })
    setDragging(i)
  }

  return (
    <div className={`overlay ${open ? 'show' : ''}`}>
      <div className="settings">
        <div className="settings-head">
          <span className="settings-title">设置</span>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {firstRun ? (
          <div className="firstrun-banner">
            🎉 <b>首次使用</b>：请先填写 Git 仓库链接，之后每次收录新词都会自动同步备份到该仓库。
            <br />
            （可先关闭稍后再填）
          </div>
        ) : null}

        <div className="field">
          <label>Git 仓库链接</label>
          <input
            type="text"
            placeholder="https://github.com/you/trnote-backup.git"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
        </div>

        <div className="field">
          <label>全局快捷键（呼出主界面）</label>
          <input
            type="text"
            value={hotkey}
            onChange={(e) => setHotkey(e.target.value)}
            placeholder="Ctrl+Alt+T"
          />
        </div>

        <div className="row">
          <div>
            <div className="lab">自动收录</div>
            <div className="desc">搜索完成后自动保存单词</div>
          </div>
          <div className={`switch ${autoSave ? 'on' : ''}`} onClick={() => setAutoSave(!autoSave)} />
        </div>
        <div className="row">
          <div>
            <div className="lab">自动 Git 同步</div>
            <div className="desc">收录新词后自动 commit + push</div>
          </div>
          <div className={`switch ${autoSync ? 'on' : ''}`} onClick={() => setAutoSync(!autoSync)} />
        </div>

        <div className="field">
          <label>翻译 API 兜底顺序（拖动排序）</label>
          <ul className="drag-list">
            {apiOrder.map((id, i) => (
              <li
                key={id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDragEnd={() => setDragging(null)}
              >
                <span className="grip">⠿</span>
                <span className="name">{API_LABELS[id] ?? id}</span>
                <span className="badge">{i === 0 ? '优先' : '兜底'}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="field">
          <label>数据管理</label>
          <div className="data-actions">
            <button className="btn btn-ghost" onClick={onExport}>
              导出备份
            </button>
            <button className="btn btn-ghost" onClick={onImport}>
              导入恢复
            </button>
            <button className="btn btn-ghost" onClick={onSync}>
              立即同步
            </button>
          </div>
        </div>

        <div className="field">
          <label>关于</label>
          <div className="desc">TRNote · Translate & Record · v0.1.0</div>
        </div>

        <div className="settings-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
