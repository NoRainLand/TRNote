// 全局 Toast 容器：自动消失，失败可带「重试」

import type { ToastItem } from '../types'
import { useT } from '../i18n'

interface Props {
  toasts: ToastItem[]
  onRetry: () => void
}

export default function ToastView({ toasts, onRetry }: Props) {
  const t = useT()
  return (
    <div className="toast-container">
      {toasts.map((t0) => (
        <div key={t0.id} className={`toast ${t0.ok ? 'success' : 'error'}`}>
          <span>{t0.message}</span>
          {t0.retry ? (
            <button className="retry" onClick={onRetry}>
              {t('retry')}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
