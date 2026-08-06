// 设置窗口（独立弹出）
// 首次使用默认弹出并引导填写 Git 仓库链接；翻译 API 兜底顺序可拖动排序

import { useEffect, useState } from 'react'
import { api } from '../api'
import { useT } from '../i18n'
import { LANG_NAMES, SUPPORTED_LANGS } from '@shared/i18n'
import type { Lang } from '@shared/i18n'
import type { DictProgress, DictStatus, Settings } from '../types'

/** 字节数格式化为可读文本 */
function fmtSize(b: number): string {
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lang, setLang] = useState<Lang>('zh')
  const [apiOrder, setApiOrder] = useState<string[]>(['google', 'youdao', 'baidu'])
  // 拖动排序状态（必须与其它 Hook 一起声明，不能在早退语句之后）
  const [dragging, setDragging] = useState<number | null>(null)
  // 本地完整词库：状态 / 下载进度 / 是否下载中
  const [dictStatus, setDictStatus] = useState<DictStatus | null>(null)
  const [dictProgress, setDictProgress] = useState<DictProgress | null>(null)
  const [downloading, setDownloading] = useState(false)
  // 删除词库的两步确认状态
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // 打开时同步外部设置（仅打开时同步一次；App 更新 settings 不回写表单，避免覆盖正在编辑的内容）
  useEffect(() => {
    if (settings) {
      setRepoUrl(settings.repoUrl ?? '')
      setHotkey(settings.hotkey)
      setAutoSave(settings.autoSave)
      setAutoSync(settings.autoSync)
      setConfirmDelete(settings.confirmDelete ?? false)
      setLang(settings.lang ?? 'zh')
      setApiOrder(settings.apiOrder.length ? settings.apiOrder : ['google', 'youdao', 'baidu'])
    }
  }, [open])

  // 打开时读取词库状态，并订阅下载进度
  useEffect(() => {
    if (!open) return
    api.dictStatus().then(setDictStatus).catch(() => {})
    const un = api.onDictProgress((p) => setDictProgress(p))
    return () => un()
  }, [open])

  // 翻译函数（Hook 必须在 early return 之前声明）
  const t = useT()

  if (!open) return null

  /** 变更即存：合并当前表单值与改动项，立即保存（即时生效，无需点保存） */
  const commit = (
    partial: Partial<
      Pick<Settings, 'repoUrl' | 'hotkey' | 'autoSave' | 'autoSync' | 'confirmDelete' | 'lang' | 'apiOrder'>
    >
  ) => {
    onSave({
      repoUrl: repoUrl.trim() || null,
      hotkey: hotkey.trim() || 'Ctrl+Alt+T',
      autoSave,
      autoSync,
      apiOrder,
      confirmDelete,
      lang,
      ...partial
    })
  }

  /** 下载 / 重新下载完整词库 */
  const handleDownloadDict = async () => {
    setDownloading(true)
    setDictProgress(null)
    try {
      const res = await api.downloadDict()
      const st = await api.dictStatus()
      setDictStatus(st)
      setDictProgress(
        res.ok
          ? { phase: 'done', percent: 100, receivedMB: 0, totalMB: 0, message: res.message }
          : { phase: 'error', percent: 0, receivedMB: 0, totalMB: 0, message: res.message }
      )
    } catch (e) {
      setDictProgress({ phase: 'error', percent: 0, receivedMB: 0, totalMB: 0, message: String(e) })
    } finally {
      setDownloading(false)
    }
  }

  /** 打开本地词典文件夹 */
  const handleOpenDictFolder = async () => {
    const r = await api.openDictFolder()
    if (r && !r.ok) {
      setDictProgress({ phase: 'error', percent: 0, receivedMB: 0, totalMB: 0, message: r.message ?? '无法打开文件夹' })
    }
  }

  /** 删除本地完整词库（两步确认后执行） */
  const handleDeleteDict = async () => {
    setConfirmingDelete(false)
    try {
      const res = await api.deleteDict()
      const st = await api.dictStatus()
      setDictStatus(st)
      setDictProgress(
        res.ok
          ? { phase: 'done', percent: 100, receivedMB: 0, totalMB: 0, message: res.message }
          : { phase: 'error', percent: 0, receivedMB: 0, totalMB: 0, message: res.message }
      )
    } catch (e) {
      setDictProgress({ phase: 'error', percent: 0, receivedMB: 0, totalMB: 0, message: String(e) })
    }
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
          <span className="settings-title">{t('settingsTitle')}</span>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-body">
        {firstRun ? (
          <div className="firstrun-banner">
            <b>{t('firstRunBadge')}</b>
            {t('firstRunText')}
            <br />
            {t('firstRunNote')}
          </div>
        ) : null}

        <div className="field">
          <label>{t('language')}</label>
          <div className="lang-options">
            {SUPPORTED_LANGS.map((l) => (
              <label key={l} className="radio">
                <input
                  type="radio"
                  name="lang"
                  value={l}
                  checked={lang === l}
                  onChange={() => {
                    setLang(l)
                    commit({ lang: l })
                  }}
                />
                {LANG_NAMES[l]}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{t('gitRepo')}</label>
          <input
            type="text"
            placeholder={t('gitRepoPlaceholder')}
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            onBlur={() => commit({ repoUrl: repoUrl.trim() || null })}
          />
        </div>

        <div className="field">
          <label>{t('hotkey')}</label>
          <input
            type="text"
            value={hotkey}
            onChange={(e) => setHotkey(e.target.value)}
            onBlur={() => commit({ hotkey: hotkey.trim() || 'Ctrl+Alt+T' })}
            placeholder="Ctrl+Alt+T"
          />
        </div>

        <div className="row">
          <div>
            <div className="lab">{t('autoSave')}</div>
            <div className="desc">{t('autoSaveDesc')}</div>
          </div>
          <div
            className={`switch ${autoSave ? 'on' : ''}`}
            onClick={() => {
              const next = !autoSave
              setAutoSave(next)
              commit({ autoSave: next })
            }}
          />
        </div>
        <div className="row">
          <div>
            <div className="lab">{t('autoSync')}</div>
            <div className="desc">{t('autoSyncDesc')}</div>
          </div>
          <div
            className={`switch ${autoSync ? 'on' : ''}`}
            onClick={() => {
              const next = !autoSync
              setAutoSync(next)
              commit({ autoSync: next })
            }}
          />
        </div>
        <div className="row">
          <div>
            <div className="lab">{t('confirmDelete')}</div>
            <div className="desc">{t('confirmDeleteDesc')}</div>
          </div>
          <div
            className={`switch ${confirmDelete ? 'on' : ''}`}
            onClick={() => {
              const next = !confirmDelete
              setConfirmDelete(next)
              commit({ confirmDelete: next })
            }}
          />
        </div>

        <div className="field">
          <label>{t('apiOrder')}</label>
          <ul className="drag-list">
            {apiOrder.map((id, i) => (
              <li
                key={id}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDragEnd={() => {
                  setDragging(null)
                  commit({ apiOrder })
                }}
              >
                <span className="grip">⠿</span>
                <span className="name">
                  {id === 'google'
                    ? t('apiGoogle')
                    : id === 'youdao'
                      ? t('apiYoudao')
                      : t('apiBaidu')}
                </span>
                <span className="badge">{i === 0 ? t('apiFirst') : t('apiFallback')}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="field">
          <label>{t('keyHelp')}</label>
          <div className="key-help">
            <div className="key-row">
              <span className="keys"><kbd>←</kbd></span>
              <span>{t('keyLeft')}</span>
            </div>
            <div className="key-row">
              <span className="keys"><kbd>→</kbd></span>
              <span>{t('keyRight')}</span>
            </div>
            <div className="key-row">
              <span className="keys"><kbd>↑</kbd><kbd>↓</kbd></span>
              <span>{t('keyUpDown')}</span>
            </div>
            <div className="key-row">
              <span className="keys"><kbd>Enter</kbd></span>
              <span>{t('keyEnter')}</span>
            </div>
            <div className="key-row">
              <span className="keys"><kbd>Del</kbd></span>
              <span>{t('keyDel')}</span>
            </div>
            <div className="key-row">
              <span className="keys"><kbd>ESC</kbd></span>
              <span>{t('keyEsc')}</span>
            </div>
          </div>
        </div>

        <div className="field">
          <label>{t('dictField')}</label>
          <div className="dict-status">
            <span className="desc">
              {dictStatus?.installed
                ? t('dictInstalled', { size: fmtSize(dictStatus.sizeBytes) })
                : t('dictNotInstalled')}
            </span>
          </div>
          <div className="data-actions">
            <button className="btn btn-ghost" disabled={downloading} onClick={handleDownloadDict}>
              {downloading ? t('downloading') : dictStatus?.installed ? t('reDownloadDict') : t('downloadDict')}
            </button>
            <button className="btn btn-ghost" disabled={downloading} onClick={handleOpenDictFolder}>
              {t('openDictFolder')}
            </button>
            <button
              className={`btn ${confirmingDelete ? 'btn-danger' : 'btn-ghost danger'}`}
              disabled={downloading}
              onClick={() => (confirmingDelete ? handleDeleteDict() : setConfirmingDelete(true))}
            >
              {confirmingDelete ? t('confirmDeleteDict') : t('deleteDict')}
            </button>
            {confirmingDelete ? (
              <button className="btn btn-ghost" onClick={() => setConfirmingDelete(false)}>
                {t('cancel')}
              </button>
            ) : null}
          </div>
          {downloading ? (
            <div className="dl-progress">
              <div className="dl-bar">
                <div className="dl-fill" style={{ width: `${dictProgress?.percent ?? 0}%` }} />
              </div>
              <div className="dl-text">
                {dictProgress?.message ?? t('dlConnecting')}
                {dictProgress && dictProgress.phase === 'downloading'
                  ? `  ${dictProgress.receivedMB.toFixed(0)} / ${dictProgress.totalMB.toFixed(0)} MB（${dictProgress.percent}%）`
                  : ''}
              </div>
            </div>
          ) : null}
        </div>

        <div className="field">
          <label>{t('dataManage')}</label>
          <div className="data-actions">
            <button className="btn btn-ghost" onClick={onExport}>
              {t('exportBackup')}
            </button>
            <button className="btn btn-ghost" onClick={onImport}>
              {t('importRestore')}
            </button>
            <button className="btn btn-ghost" onClick={onSync}>
              {t('syncNow')}
            </button>
          </div>
        </div>

        <div className="field">
          <label>{t('about')}</label>
          <div className="desc">TRNote · Translate & Record · v1.0.0</div>
        </div>
        </div>
      </div>
    </div>
  )
}
