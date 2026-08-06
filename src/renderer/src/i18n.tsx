// 渲染进程 i18n：I18nProvider 包住根组件，子组件用 useT() 取翻译函数
// 语言来自设置（App 持有 settings.lang），切换保存后自动全局刷新

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { getText, type Lang, type TranslationKey } from '@shared/i18n'

export type T = (key: TranslationKey, params?: Record<string, string | number>) => string

interface I18nCtxValue {
  lang: Lang
  t: T
}

const Ctx = createContext<I18nCtxValue>({
  lang: 'zh',
  t: (key, params) => getText('zh', key, params)
})

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <Ctx.Provider value={{ lang, t: (key, params) => getText(lang, key, params) }}>{children}</Ctx.Provider>
}

/** 取当前语言与翻译函数 */
export function useI18n(): I18nCtxValue {
  return useContext(Ctx)
}

/** 取翻译函数：const t = useT() */
export function useT(): T {
  return useContext(Ctx).t
}
