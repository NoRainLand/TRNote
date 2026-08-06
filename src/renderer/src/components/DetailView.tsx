// 右侧详情区：参考词典排版
// 单词+音标 → 词性分区块（释义用 ; 分隔）→ 词形变化 → 备注编辑

import { useEffect, useState } from 'react'
import type { WordDetail } from '../types'
import { useT } from '../i18n'

interface Props {
  detail: WordDetail | null
  onUpdateNote: (word: string, note: string) => void
  onRequestDelete: (word: string) => void
}

export default function DetailView({ detail, onUpdateNote, onRequestDelete }: Props) {
  const t = useT()
  // 备注本地编辑状态（切换词条时重置）
  const [note, setNote] = useState(detail?.note ?? '')
  useEffect(() => {
    setNote(detail?.note ?? '')
  }, [detail?.word, detail?.note])

  if (!detail) {
    return (
      <div className="detail">
        <div className="empty" style={{ marginTop: 60 }}>
          {t('emptyDetail')}
        </div>
      </div>
    )
  }

  const posHtml = detail.senses.map((s, i) => (
    <div className="sense" key={i}>
      <div className="pos">{s.pos || t('senseDefault')}</div>
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
      <span style={{ color: '#b6c0cc', fontSize: '12.5px' }}>{t('noForms')}</span>
    )

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <div className="detail-word">{detail.word}</div>
          <div className="detail-phonetic">
            <span>
              {t('uk')} <b>{detail.phoneticUk ?? '—'}</b>
            </span>
            <span style={{ marginLeft: 14 }}>
              {t('us')} <b>{detail.phoneticUs ?? '—'}</b>
            </span>
          </div>
        </div>
        <div className="detail-actions">
          <button
            className="delete-btn"
            title={t('deleteEntryTitle')}
            onClick={() => onRequestDelete(detail.word)}
          >
            {t('deleteEntry')}
          </button>
        </div>
      </div>

      <div className="block">
        <div className="block-title">{t('senses')}</div>
        {posHtml}
      </div>

      <div className="block">
        <div className="block-title">{t('forms')}</div>
        <div className="forms-grid">{formsHtml}</div>
      </div>

      <div className="block">
        <div className="block-title">{t('note')}</div>
        <textarea
          className="note-box"
          placeholder={t('notePlaceholder')}
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
