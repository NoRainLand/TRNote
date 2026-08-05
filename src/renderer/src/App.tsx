// TRNote 主界面：三部分布局
// 左列表(3/10) + 右上搜索框 + 右下详情
// 交互：输入即联想（本地词库）→ 停顿后本地无结果走网络 → 确认后自动收录

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, onOpenSettings, onToast } from './api'
import DetailView from './components/DetailView'
import SettingsWindow from './components/SettingsWindow'
import ToastView from './components/ToastView'
import WordList from './components/WordList'
import type {
  SaveResult,
  Settings,
  Suggestion,
  ToastItem,
  ToastPayload,
  WordDetail,
  WordSummary
} from './types'

export default function App() {
  // ---------- 状态 ----------
  const [words, setWords] = useState<WordSummary[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [detail, setDetail] = useState<WordDetail | null>(null)
  const [sort, setSort] = useState<'new' | 'alpha'>('new')
  const [query, setQuery] = useState('')
  const [suggests, setSuggests] = useState<Suggestion[]>([])
  // 联想下拉当前高亮项索引（-1=无，支持 ↑/↓ 键盘选择）
  const [suggestIndex, setSuggestIndex] = useState(-1)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [firstRun, setFirstRun] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // 待删除确认的单词（应用内确认框，避免原生 confirm 干扰输入焦点）
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  // 窗口可见时播放淡入动画（每次呼出重新触发，见下方 visibilitychange）
  const [appFade, setAppFade] = useState(false)

  // 引用（避免闭包陈旧值）
  const queryRef = useRef('')
  const settingsRef = useRef<Settings | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastIdRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // 左侧单词本容器 ref（←/→ 切换焦点用）
  const wordListRef = useRef<HTMLDivElement>(null)

  // ---------- 工具函数 ----------
  const pushToast = useCallback((p: ToastPayload) => {
    const id = ++toastIdRef.current
    setToasts((t) => [...t, { id, ...p }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }, [])

  /** 更新联想建议并重置键盘高亮 */
  const updateSuggests = useCallback((s: Suggestion[]) => {
    setSuggests(s)
    setSuggestIndex(-1)
  }, [])

  /** 刷新左侧列表（始终展示完整词本，不做搜索过滤） */
  const refreshList = useCallback(async (mode: 'new' | 'alpha') => {
    const all = await api.listWords(mode)
    setWords(all)
    return all
  }, [])

  /** 选中左侧词条 → 右侧展示详情 */
  const selectWord = useCallback(async (word: string) => {
    setActive(word)
    const d = await api.getWord(word)
    if (d) setDetail(d)
  }, [])

  // ---------- 挂载：加载设置、订阅事件、拉取列表 ----------
  useEffect(() => {
    let unToast: (() => void) | undefined
    let unSettings: (() => void) | undefined

    ;(async () => {
      const s = await api.getSettings()
      setSettings(s)
      settingsRef.current = s
      // 首次使用（未配置仓库链接）→ 默认弹出设置
      if (!s.repoUrl) {
        setFirstRun(true)
        setSettingsOpen(true)
      }
      await refreshList('new')
      // 默认打开最新单词
      const all = await api.listWords('new')
      if (all.length > 0) await selectWord(all[0].word)
    })()

    unToast = onToast((p) => pushToast(p))
    unSettings = onOpenSettings(() => {
      setFirstRun(false)
      setSettingsOpen(true)
    })

    return () => {
      unToast?.()
      unSettings?.()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [pushToast, refreshList, selectWord])

  // 全局快捷键：ESC 收起主窗口（设置弹窗/删除确认打开时优先关闭它们）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (pendingDelete) {
        setPendingDelete(null)
      } else if (settingsOpen) {
        setSettingsOpen(false)
      } else {
        void api.hideWindow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingDelete, settingsOpen])

  // 窗口每次显示（呼出）时播放一次淡入动画：隐藏时移除类，显示时重新添加触发
  useEffect(() => {
    const onVis = () => setAppFade(document.visibilityState === 'visible')
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // ---------- 搜索框 ----------
  const onSearchChange = (q: string) => {
    setQuery(q)
    queryRef.current = q
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim() === '') {
      updateSuggests([])
      return
    }
    // 1. 立即：本地联想（词本列表保持完整展示，不做过滤）
    api.lookupLocal(q.trim()).then(updateSuggests)
    // 2. 停顿 400ms 后：本地无结果 → 网络查词 + 自动收录
    debounceRef.current = setTimeout(async () => {
      const sugs = await api.lookupLocal(q.trim())
      updateSuggests(sugs)
      if (sugs.length === 0 && settingsRef.current?.autoSave) {
        try {
          const d = await api.lookupWord(q.trim())
          setDetail(d)
          setActive(d.word)
          await api.saveWord(q.trim())
          // 收录完成后：清空搜索、展示完整词本（旧词不被隐藏）
          setQuery('')
          queryRef.current = ''
          updateSuggests([])
          await refreshList(sort)
          await selectWord(d.word)
        } catch (e) {
          pushToast({ message: String(e), ok: false, retry: false })
        }
      }
    }, 400)
  }

  /** 清除搜索 */
  const clearSearch = () => {
    setQuery('')
    queryRef.current = ''
    updateSuggests([])
    inputRef.current?.focus()
  }

  /** 回车 / 点击联想：确认收录该单词 */
  const confirmSave = async (word: string) => {
    try {
      const r: SaveResult = await api.saveWord(word)
      // 收录完成后：清空搜索、展示完整词本（旧词不被隐藏）
      setQuery('')
      queryRef.current = ''
      updateSuggests([])
      await refreshList(sort)
      await selectWord(word)
      if (!r.saved)
        pushToast({ message: `${word} 已在词库中`, ok: true, retry: false })
    } catch (e) {
      pushToast({ message: String(e), ok: false, retry: false })
    }
  }

  // ---------- 排序 ----------
  const changeSort = (m: 'new' | 'alpha') => {
    setSort(m)
    refreshList(m)
  }

  // ---------- 详情操作 ----------
  const handleUpdateNote = async (word: string, note: string) => {
    try {
      await api.updateNote(word, note)
      pushToast({ message: '备注已保存', ok: true, retry: false })
    } catch (e) {
      pushToast({ message: String(e), ok: false, retry: false })
    }
  }

  /** 请求删除：弹出确认框 */
  const requestDelete = (word: string) => setPendingDelete(word)

  /** 确认删除 */
  const confirmDelete = async () => {
    const word = pendingDelete
    setPendingDelete(null)
    if (!word) return
    try {
      await api.deleteWord(word)
      await refreshList(sort)
      setActive(null)
      setDetail(null)
      inputRef.current?.focus()
      pushToast({ message: `已删除 ${word}`, ok: true, retry: false })
    } catch (e) {
      pushToast({ message: String(e), ok: false, retry: false })
    }
  }

  // ---------- 设置 ----------
  const handleSaveSettings = async (s: Settings) => {
    try {
      await api.saveSettings(s)
      setSettings(s)
      settingsRef.current = s
      setSettingsOpen(false)
      pushToast({ message: '设置已保存', ok: true, retry: false })
    } catch (e) {
      pushToast({ message: String(e), ok: false, retry: false })
    }
  }

  const handleExport = async () => {
    try {
      const p = await api.exportBackup()
      pushToast({ message: `已导出备份：${p}`, ok: true, retry: false })
    } catch (e) {
      pushToast({ message: String(e), ok: false, retry: false })
    }
  }

  const handleImport = async () => {
    try {
      await api.importBackup()
      await refreshList(sort)
      pushToast({ message: '备份导入成功，列表已刷新', ok: true, retry: false })
    } catch (e) {
      pushToast({ message: String(e), ok: false, retry: false })
    }
  }

  const handleSync = () => {
    api.gitSync().then((r) => {
      if (!r.ok) pushToast({ message: r.message, ok: false, retry: true })
    })
  }

  // ---------- 渲染 ----------
  return (
    <div className={`app${appFade ? ' fade-in' : ''}`}>
      {/* 窗体顶部拖动条（无边框圆角窗口） */}
      <div className="drag-strip" />
      {/* 左：单词本记录列表（3/10） */}
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="sidebar-title">
            📒 生词本
            <span className="sidebar-count">· {words.length} 词</span>
          </div>
          <div className="sort-tabs">
            <button
              className={sort === 'new' ? 'active' : ''}
              onClick={() => changeSort('new')}
            >
              最新
            </button>
            <button
              className={sort === 'alpha' ? 'active' : ''}
              onClick={() => changeSort('alpha')}
            >
              字母
            </button>
          </div>
        </div>
        <WordList
          words={words}
          active={active}
          onSelect={selectWord}
          listRef={wordListRef}
          onMoveRight={() => inputRef.current?.focus()}
        />
      </aside>

      {/* 右：上搜索框 / 下详情 */}
      <main className="main">
        <div className="search-wrap">
          <div className="search-bar">
            <span>🔍</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="输入单词 / 释义检索，本地无结果时将走网络查询…"
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  // 下拉联想：向下选择（循环）
                  e.preventDefault()
                  if (suggests.length > 0)
                    setSuggestIndex((i) => (i >= suggests.length - 1 ? 0 : i + 1))
                } else if (e.key === 'ArrowUp') {
                  // 下拉联想：向上选择（循环）
                  e.preventDefault()
                  if (suggests.length > 0)
                    setSuggestIndex((i) => (i <= 0 ? suggests.length - 1 : i - 1))
                } else if (e.key === 'ArrowLeft') {
                  // 左方向键：焦点切到左侧单词本
                  e.preventDefault()
                  wordListRef.current?.focus()
                } else if (e.key === 'Enter') {
                  // 回车：优先确认高亮的联想词，否则按输入词收录
                  if (suggestIndex >= 0 && suggests[suggestIndex]) {
                    confirmSave(suggests[suggestIndex].word)
                  } else if (query.trim()) {
                    confirmSave(query.trim())
                  }
                }
              }}
            />
            <button className="clear-btn" title="清除" onClick={clearSearch}>
              ✕
            </button>
          </div>
          {suggests.length > 0 ? (
            <div className="suggest-drop">
              {suggests.map((s, i) => (
                <div
                  className={`suggest-item ${i === suggestIndex ? 'active' : ''}`}
                  key={s.word}
                  onClick={() => confirmSave(s.word)}
                  onMouseEnter={() => setSuggestIndex(i)}
                >
                  <span className="sw">{s.word}</span>
                  {s.phonetic ? <span className="sph">{s.phonetic}</span> : null}
                  {s.meaning ? <span className="sme">{s.meaning}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <DetailView detail={detail} onUpdateNote={handleUpdateNote} onRequestDelete={requestDelete} />
      </main>

      {/* 底栏快捷入口 */}
      <div className="footer-actions">
        <button
          className="fab"
          onClick={() => {
            setFirstRun(false)
            setSettingsOpen(true)
          }}
        >
          ⚙ 设置
        </button>
        <button className="fab" onClick={handleSync}>
          ⟳ 同步
        </button>
      </div>

      {/* 删除确认框（应用内实现，避免原生 confirm 干扰输入焦点） */}
      {pendingDelete ? (
        <div className="overlay show">
          <div className="settings" style={{ width: 360 }}>
            <div className="settings-title" style={{ marginBottom: 10 }}>
              删除词条
            </div>
            <div style={{ marginBottom: 18, fontSize: 13, color: 'var(--muted)' }}>
              确定删除 <b style={{ color: 'var(--text)' }}>{pendingDelete}</b> 吗？删除后不可恢复。
            </div>
            <div className="settings-foot">
              <button className="btn btn-ghost" onClick={() => setPendingDelete(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--danger)' }}
                onClick={confirmDelete}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 设置窗口 */}
      <SettingsWindow
        open={settingsOpen}
        firstRun={firstRun}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onExport={handleExport}
        onImport={handleImport}
        onSync={handleSync}
      />

      {/* Toast */}
      <ToastView toasts={toasts} onRetry={handleSync} />
    </div>
  )
}
