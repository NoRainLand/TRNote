// 在线翻译服务：本地词库未命中时按配置顺序走免费 API 兜底
// 默认顺序：google(非官方免费接口) → youdao → baidu；任一成功即返回

import type { Sense } from '@shared/types'
import type { DictResult } from './dict'

const UA = { 'User-Agent': 'Mozilla/5.0' }
const TIMEOUT_MS = 6000

/** 带超时的 JSON 请求 */
async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as unknown
  } finally {
    clearTimeout(timer)
  }
}

/** 在线接口无词性结构：归为一个空词性释义 */
function singleSense(meaning: string): DictResult {
  return {
    phonetic: null,
    senses: [{ pos: '', meaning, example: null } satisfies Sense],
    forms: []
  }
}

/** Google 翻译非官方免费接口 */
async function google(word: string): Promise<DictResult> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(word)}`
  const body = (await fetchJson(url)) as unknown[][]
  const arr = body[0]
  if (!Array.isArray(arr)) throw new Error('Google 返回格式异常')
  const text = arr
    .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
    .join('')
  if (!text.trim()) throw new Error('Google 无结果')
  return singleSense(text.trim())
}

/** 有道翻译免费接口 */
async function youdao(word: string): Promise<DictResult> {
  const url = `https://fanyi.youdao.com/translate?&doctype=json&type=EN2ZH_CN&i=${encodeURIComponent(word)}`
  const body = (await fetchJson(url)) as { translateResult?: unknown[][] }
  const arr = body.translateResult?.[0]
  if (!Array.isArray(arr)) throw new Error('有道返回格式异常')
  const text = arr
    .map((seg) => {
      const s = seg as { tgt?: unknown }
      return typeof s.tgt === 'string' ? s.tgt : ''
    })
    .join('')
  if (!text.trim()) throw new Error('有道无结果')
  return singleSense(text.trim())
}

/** 百度翻译免费接口（sug 建议接口） */
async function baidu(word: string): Promise<DictResult> {
  const url = `https://fanyi.baidu.com/sug?kw=${encodeURIComponent(word)}`
  const body = (await fetchJson(url)) as { data?: Array<{ v?: unknown }> }
  const data = body.data
  if (!Array.isArray(data)) throw new Error('百度返回格式异常')
  const meanings = data
    .map((item) => (typeof item.v === 'string' ? item.v : ''))
    .filter(Boolean)
  if (!meanings.length) throw new Error('百度无结果')
  return singleSense(meanings.join('; '))
}

/** 按兜底顺序查询在线翻译 */
export async function lookupOnline(word: string, order: string[]): Promise<DictResult> {
  for (const api of order) {
    try {
      const dr =
        api === 'google'
          ? await google(word)
          : api === 'youdao'
            ? await youdao(word)
            : api === 'baidu'
              ? await baidu(word)
              : null
      if (dr && dr.senses.length) return dr
    } catch {
      /* 尝试下一个接口 */
    }
  }
  throw new Error('所有翻译接口均不可用，请检查网络或稍后重试')
}
