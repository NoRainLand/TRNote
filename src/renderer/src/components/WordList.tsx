// 左侧单词本记录列表（3/10）
// 每项：单词为标题 + 首个释义为摘要；点击显示对应单词
// 支持键盘导航：焦点在列表时 ↑/↓ 切换选中，自动滚动跟随

import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { WordSummary } from '../types'

interface Props {
  words: WordSummary[]
  active: string | null
  onSelect: (word: string) => void
  /** 列表容器 ref（由 App 持有，用于 ← 从输入框切回时聚焦） */
  listRef: RefObject<HTMLDivElement>
  /** 按 → 时请求聚焦右侧搜索框 */
  onMoveRight: () => void
  /** 列表获得焦点时通知 App（用于切换左右栏比例） */
  onFocusList: () => void
}

export default function WordList({ words, active, onSelect, listRef, onMoveRight, onFocusList }: Props) {
  // 选中变化时，把高亮项滚动到可视区域（键盘/鼠标均生效）
  useEffect(() => {
    if (!active || !listRef.current) return
    const el = listRef.current.querySelector(`[data-word="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, listRef])

  // 点击词条：选中并聚焦列表容器，便于直接继续用 ↑/↓ 切换
  const handleClick = (word: string) => {
    onSelect(word)
    listRef.current?.focus()
  }

  // 键盘导航：↑/↓ 移动选中（循环）；→ 切回右侧搜索框
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onMoveRight()
      return
    }
    if (words.length === 0) return
    const idx = words.findIndex((w) => w.word === active)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onSelect(words[(idx + 1) % words.length].word)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onSelect(words[(idx - 1 + words.length) % words.length].word)
    }
  }

  if (words.length === 0) {
    return (
      <div
        className="word-list"
        ref={listRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={onFocusList}
      >
        <div className="empty">还没有生词，去搜索框查一个吧～</div>
      </div>
    )
  }
  return (
    <div
      className="word-list"
      ref={listRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={onFocusList}
    >
      {words.map((w) => (
        <div
          key={w.word}
          data-word={w.word}
          className={`word-item ${w.word === active ? 'active' : ''}`}
          onClick={() => handleClick(w.word)}
        >
          <div className="w">{w.word}</div>
          <div className="s">{w.summary}</div>
        </div>
      ))}
    </div>
  )
}
