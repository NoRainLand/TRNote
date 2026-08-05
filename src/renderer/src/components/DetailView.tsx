// 右侧详情区：参考词典排版
// 单词+音标 → 词性分区块（释义用 ; 分隔）→ 词形变化 → 备注编辑

import { useEffect, useState } from 'react'
import type { WordDetail } from '../types'

interface Props {
  detail: WordDetail | null
  onUpdateNote: (word: string, note: string) => void
  onRequestDelete: (word: string) => void
}

export default function DetailView({ detail, onUpdateNote, onRequestDelete }: Props) {
  // 备注本地编辑状态（切换词条时重置）
  const [note, setNote] = useState(detail?.note ?? '')
  useEffect(() => {
    setNote(detail?.note ?? '')
  }, [detail?.word, detail?.note])

  if (!detail) {
    return (
      <div className="detail">
        <div className="empty" style={{ marginTop: 60 }}>
          在左侧选择单词，或在搜索框输入新词
        </div>
      </div>
    )
  }

  const posHtml = detail.senses.map((s, i) => (
    <div className="sense" key={i}>
      <div className="pos">{s.pos || '释义'}</div>
      <div className="meaning">
        {s.meaning}
        {s.example ? <div className="example">“{s.example}”</div> : null}
      </div>
    </div>
  ))

  const formsHtml =
    detail.forms.length > 0 ? (
      detail.forms.map((f, i) => (
        <span className="form-chip" key={i}>
          <b>{f.type}</b>
          {f.value}
        </span>
      ))
    ) : (
      <span style={{ color: '#b6c0cc', fontSize: '12.5px' }}>（无词形变化）</span>
    )

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <div className="detail-word">{detail.word}</div>
          <div className="detail-phonetic">
            <span>
              英 <b>{detail.phoneticUk ?? '—'}</b>
            </span>
            <span style={{ marginLeft: 14 }}>
              美 <b>{detail.phoneticUs ?? '—'}</b>
            </span>
          </div>
        </div>
        <div className="detail-actions">
          <button
            className="delete-btn"
            title="删除该词条"
            onClick={() => onRequestDelete(detail.word)}
          >
            🗑 删除
          </button>
        </div>
      </div>

      <div className="block">
        <div className="block-title">释义</div>
        {posHtml}
      </div>

      <div className="block">
        <div className="block-title">词形变化</div>
        <div className="forms-grid">{formsHtml}</div>
      </div>

      <div className="block">
        <div className="block-title">备注</div>
        <textarea
          className="note-box"
          placeholder="添加个人备注…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (detail.note ?? '')) onUpdateNote(detail.word, note)
          }}
        />
      </div>
    </div>
  )
}
