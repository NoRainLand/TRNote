// 全局 Toast 容器：自动消失，失败可带「重试」

import type { ToastItem } from '../types'

interface Props {
  toasts: ToastItem[]
  onRetry: () => void
}

export default function ToastView({ toasts, onRetry }: Props) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.ok ? 'success' : 'error'}`}>
          <span>{t.message}</span>
          {t.retry ? (
            <button className="retry" onClick={onRetry}>
              重试
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}
