// 本地词典引擎（从 Tauri/Rust 版移植）
// 数据来源（按优先级）：
//   1. ECDICT 词库（<userData>/ecdict.db，只读 SQLite，含音标/释义/词形）
//   2. 内置兜底词典（常用 + 编程术语，保证离线可用）
// 前缀联想通过 SQL 范围查询实现（利用 stardict.sw 索引，输入即出）

import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import type { Sense, Suggestion, WordForm } from '@shared/types'

/** 词典查询结果（音标 + 多词性释义 + 词形变化） */
export interface DictResult {
  phonetic: string | null
  senses: Sense[]
  forms: WordForm[]
}

/** 内置兜底词表：常用词 + 编程术语 [word, 音标, 翻译, 词形] */
const FALLBACK: Array<[string, string, string, string]> = [
  ['action', '/ˈækʃn/', '[名] 动作; 行为; 战斗; 处理\n[动] 行动; 起作用; 表演', 'p:acted/d:acted/i:acting/3:acts/0:actions'],
  ['idempotent', '/ˌaɪdəmˈpoʊtənt/', '[形] 幂等的', ''],
  ['deadlock', '/ˈdedlɒk/', '[名] 死锁; 僵局\n[动] 使陷入僵局', 's:deadlocks'],
  ['ephemeral', '/ɪˈfemərəl/', '[形] 短暂的; 瞬息的', ''],
  ['polymorphism', '/ˌpɒliˈmɔːfɪzəm/', '[名] 多态性; 多形性', ''],
  ['concatenate', '/kənˈkætəneɪt/', '[动] 连接; 拼接', 'p:concatenated/d:concatenated/i:concatenating/3:concatenates'],
  ['ubiquitous', '/juːˈbɪkwɪtəs/', '[形] 无处不在的', ''],
  ['pragmatic', '/præɡˈmætɪk/', '[形] 务实的; 实用的', 'r:more pragmatic/t:most pragmatic'],
  ['asynchronous', '/eɪˈsɪŋkrənəs/', '[形] 异步的; 非同步的', ''],
  ['synchronous', '/ˈsɪŋkrənəs/', '[形] 同步的', ''],
  ['latency', '/ˈleɪtənsi/', '[名] 延迟; 潜伏时间', 's:latencies'],
  ['throughput', '/ˈθruːpʊt/', '[名] 吞吐量', ''],
  ['cache', '/kæʃ/', '[名] 缓存; 高速缓存\n[动] 缓存', 's:caches/p:cached/d:cached/i:caching/3:caches'],
  ['thread', '/θred/', '[名] 线程; 线; 线索\n[动] 穿线', 's:threads'],
  ['mutex', '/ˈmjuːteks/', '[名] 互斥锁', 's:mutexes'],
  ['exception', '/ɪkˈsepʃn/', '[名] 异常; 例外', 's:exceptions'],
  ['compile', '/kəmˈpaɪl/', '[动] 编译; 汇编', 'p:compiled/d:compiled/i:compiling/3:compiles'],
  ['deploy', '/dɪˈplɔɪ/', '[动] 部署; 展开', 'p:deployed/d:deployed/i:deploying/3:deploys'],
  ['deprecated', '/ˈdeprəkeɪtɪd/', '[形] 弃用的; 不推荐的', ''],
  ['immutable', '/ɪˈmjuːtəbl/', '[形] 不可变的; 不变的', ''],
  ['mutable', '/ˈmjuːtəbl/', '[形] 可变的; 易变的', ''],
  ['recursion', '/rɪˈkɜːʃn/', '[名] 递归; 循环', 's:recursions'],
  ['closure', '/ˈkləʊʒə(r)/', '[名] 闭包; 关闭; 结束', 's:closures'],
  ['garbage', '/ˈɡɑːbɪdʒ/', '[名] 垃圾; 无用数据', ''],
  ['debug', '/ˌdiːˈbʌɡ/', '[动] 调试; 排除故障', 'p:debugged/d:debugged/i:debugging/3:debugs'],
  ['syntax', '/ˈsɪntæks/', '[名] 语法; 句法', ''],
  ['semantics', '/sɪˈmæntɪks/', '[名] 语义学; 语义', ''],
  ['token', '/ˈtəʊkən/', '[名] 令牌; 标记; 代币', 's:tokens'],
  ['schema', '/ˈskiːmə/', '[名] 模式; 架构; 图式', 's:schemas'],
  ['transaction', '/trænˈzækʃn/', '[名] 事务; 交易; 处理', 's:transactions'],
  ['queue', '/kjuː/', '[名] 队列; 队伍\n[动] 排队', 's:queues'],
  ['stack', '/stæk/', '[名] 栈; 堆; 一叠\n[动] 堆放', 's:stacks'],
  ['buffer', '/ˈbʌfə(r)/', '[名] 缓冲区; 缓冲器\n[动] 缓冲', 's:buffers'],
  ['daemon', '/ˈdiːmən/', '[名] 守护进程; 后台程序', 's:daemons'],
  ['kernel', '/ˈkɜːnl/', '[名] 内核; 核心; 谷粒', 's:kernels'],
  ['pointer', '/ˈpɔɪntə(r)/', '[名] 指针; 指示器', 's:pointers'],
  ['reference', '/ˈrefrəns/', '[名] 引用; 参考; 参照\n[动] 引用', 's:references'],
  ['inherit', '/ɪnˈherɪt/', '[动] 继承; 遗传', 'p:inherited/d:inherited/i:inheriting/3:inherits'],
  ['override', '/ˌəʊvəˈraɪd/', '[动] 重写; 覆盖; 推翻\n[名] 覆盖', 'p:overrode/d:overridden/i:overriding/3:overrides'],
  ['overload', '/ˌəʊvəˈləʊd/', '[动] 重载; 使超载\n[名] 超载', 'p:overloaded/d:overloaded/i:overloading/3:overloads']
]

class Dict {
  private conn: Database.Database | null = null

  constructor(dataDir: string) {
    const p = join(dataDir, 'ecdict.db')
    if (existsSync(p)) {
      try {
        this.conn = new Database(p, { readonly: true })
        const cnt = this.conn.prepare('SELECT count(*) c FROM stardict').get() as { c: number }
        console.log(`[dict] ECDICT 词库已加载: ${p}（${cnt.c} 词条）`)
      } catch (e) {
        console.warn('[dict] 加载 ecdict.db 失败，使用内置词表：', e)
      }
    } else {
      console.log(`[dict] 未找到 ecdict.db（${p}），使用内置词表`)
    }
  }

  /** 关闭底层连接（覆盖安装新词库前调用） */
  close(): void {
    try {
      this.conn?.close()
    } catch {
      /* 忽略 */
    }
    this.conn = null
  }

  /** 前缀联想（输入即出） */
  suggest(prefix: string, limit: number): Suggestion[] {
    const q = prefix.trim().toLowerCase()
    if (!q) return []
    const out: Suggestion[] = []
    const seen = new Set<string>()

    // 1. 内置兜底（编程术语优先命中）
    for (const [w, ph, tr] of FALLBACK) {
      if (w.startsWith(q) && !seen.has(w)) {
        seen.add(w)
        const r = parseEntry(ph, tr, '')
        out.push({ word: w, phonetic: r.phonetic, meaning: r.senses[0]?.meaning ?? null })
        if (out.length >= limit) return out
      }
    }

    // 2. ECDICT（SQL 范围查询，命中索引）
    if (this.conn) {
      const upper = q.slice(0, -1) + String.fromCharCode(q.charCodeAt(q.length - 1) + 1)
      const rows = this.conn
        .prepare(
          'SELECT sw, phonetic, translation, exchange FROM stardict WHERE sw >= ? AND sw < ? ORDER BY sw LIMIT ?'
        )
        .all(q, upper, limit - out.length) as Array<{
        sw: string
        phonetic: string | null
        translation: string | null
        exchange: string | null
      }>
      for (const r of rows) {
        if (seen.has(r.sw)) continue
        seen.add(r.sw)
        const dr = parseEntry(r.phonetic, r.translation, r.exchange)
        out.push({ word: r.sw, phonetic: dr.phonetic, meaning: dr.senses[0]?.meaning ?? null })
        if (out.length >= limit) break
      }
    }
    return out
  }

  /** 精确查词：内置兜底优先，再查 ECDICT */
  lookup(word: string): DictResult | null {
    const w = word.trim().toLowerCase()
    const fb = FALLBACK.find(([k]) => k === w)
    if (fb) return parseEntry(fb[1], fb[2], fb[3])
    if (this.conn) {
      const r = this.conn
        .prepare('SELECT phonetic, translation, exchange FROM stardict WHERE word=?')
        .get(w) as
        | { phonetic: string | null; translation: string | null; exchange: string | null }
        | undefined
      if (r) return parseEntry(r.phonetic, r.translation, r.exchange)
    }
    return null
  }
}

let dict: Dict | null = null

/** 词库存放目录：安装目录（exe 旁，便携）；开发模式回退用户目录 */
export function dictDataDir(): string {
  return app.isPackaged ? dirname(app.getPath('exe')) : app.getPath('userData')
}

/** 初始化词典（在 app ready 时调用） */
export function initDict(): void {
  dict = new Dict(dictDataDir())
}

/** 获取词典（未初始化则懒加载） */
export function getDict(): Dict {
  if (!dict) dict = new Dict(dictDataDir())
  return dict
}

/** 关闭当前词典连接（覆盖安装新词库前调用，避免 Windows 文件占用） */
export function closeDict(): void {
  dict?.close()
  dict = null
}

/** 重新加载词典（下载安装新词库后调用，无需重启应用） */
export function reloadDict(): void {
  closeDict()
  dict = new Dict(dictDataDir())
}

/* ---------- 解析工具 ---------- */

/** 把 ECDICT 翻译文本解析为多词性释义。
 *  支持两种格式：
 *    [名] 动作; 行为           （旧式）
 *    n. 公众, 民众            （ECDICT 实际格式，英文词性缩写） */
function parseTranslation(text: string): Sense[] {
  const senses: Sense[] = []
  for (const line of text.split('\n')) {
    const l = line.trim()
    if (!l) continue
    // 形式1：[名] 释义
    const m1 = /^\[([^\]]+)\]\s*(.*)$/.exec(l)
    if (m1) {
      senses.push({ pos: mapPos(m1[1]), meaning: m1[2].trim(), example: null })
      continue
    }
    // 形式2：n. 释义 / a. 释义 / vt. 释义 …
    const m2 = /^([a-zA-Z]+)\.\s*(.*)$/.exec(l)
    if (m2 && m2[2].trim()) {
      senses.push({ pos: mapPos(m2[1] + '.'), meaning: m2[2].trim(), example: null })
      continue
    }
    senses.push({ pos: '', meaning: l, example: null })
  }
  if (senses.length === 0 && text.trim()) {
    senses.push({ pos: '', meaning: text.trim(), example: null })
  }
  return senses
}

/** 词性 → 英文缩写（兼容中文标注与英文缩写两种输入） */
function mapPos(raw: string): string {
  const key = raw.trim().replace(/\.$/, '')
  const map: Record<string, string> = {
    名: 'n.',
    动: 'v.',
    形: 'adj.',
    副: 'adv.',
    代: 'pron.',
    介: 'prep.',
    连: 'conj.',
    叹: 'int.',
    数: 'num.',
    及物动词: 'v.t.',
    不及物动词: 'v.i.',
    词组: 'phr.',
    n: 'n.',
    a: 'adj.',
    adj: 'adj.',
    ad: 'adv.',
    adv: 'adv.',
    v: 'v.',
    vt: 'v.t.',
    vi: 'v.i.',
    pron: 'pron.',
    prep: 'prep.',
    conj: 'conj.',
    int: 'int.',
    num: 'num.',
    art: 'art.',
    aux: 'aux.',
    phr: 'phr.',
    pl: 'pl.'
  }
  const mapped = map[key]
  if (mapped) return mapped
  // 未知标注：原样返回（补上点号）
  return raw.trim().endsWith('.') ? raw.trim() : raw.trim() + '.'
}

/** 解析 exchange 字段为词形变化；约定 p=过去式 d=过去分词 i=现在分词 3=三单 s=复数 r=比较级 t=最高级 */
function parseExchange(exchange: string): WordForm[] {
  const forms: WordForm[] = []
  const labels: Record<string, string> = {
    p: '过去式',
    d: '过去分词',
    i: '现在分词',
    '3': '第三人称单数',
    s: '复数',
    r: '比较级',
    t: '最高级'
  }
  for (const item of exchange.split('/')) {
    const [k, ...rest] = item.split(':')
    const v = rest.join(':')
    if (!k || !v) continue
    const label = labels[k]
    if (!label) continue
    forms.push({ type: label, value: v })
  }
  return forms
}

/** 组合成词典查询结果（兼容 null 字段：ECDICT 部分行 exchange/translation 为空） */
function parseEntry(
  phonetic: string | null,
  translation: string | null,
  exchange: string | null
): DictResult {
  return {
    phonetic: phonetic?.trim() ? phonetic.trim() : null,
    senses: parseTranslation(translation ?? ''),
    forms: parseExchange(exchange ?? '')
  }
}
