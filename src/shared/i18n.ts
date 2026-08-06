// ============================================================================
// 多语言支持（i18n）
// ----------------------------------------------------------------------------
// 【如何添加新语言】（方便其他开发者扩展，共 3 步）
//   1. 复制下方 `zh` 对象作为模板，把每个字符串翻译成你的语言；
//   2. 在 `translations` 中注册：translations 里新增一项，如  ja: { ... }
//   3. 把新语言加入 `Lang` 类型、`LANG_NAMES`、`SUPPORTED_LANGS` 三处。
//   之后「设置 → 界面语言」下拉会自动出现新语言，无需改动其它代码。
//
// 使用方式：
//   渲染进程组件：const t = useT()（见 renderer/src/i18n.tsx）
//   主进程：const t = makeT(db.loadSettings().lang)（ipc/dictDownload/translate/tray）
//   支持 {占位符} 参数替换，如 t('wordCount', { n: 12 })
// ============================================================================

/** 语言标识 */
export type Lang = 'zh' | 'en'

/** 全部界面文案 key（扁平结构；新增 key 需在 zh 与 en 同时补充） */
export interface Translation {
  // ---- 通用 ----
  cancel: string
  save: string
  close: string
  delete: string
  retry: string

  // ---- 主界面（App.tsx）----
  wordbook: string
  wordCount: string // '· {n} 词'
  sort: string
  sortNew: string
  sortAlpha: string
  searchPlaceholder: string
  clear: string
  settings: string
  sync: string
  deleteTitle: string
  deleteConfirm: string // '确定删除 {word} 吗？删除后不可恢复。'
  alreadyInDict: string // '{word} 已在词库中'
  noteSaved: string
  deleted: string // '已删除 {word}'
  settingsSaved: string
  exported: string // '已导出备份：{path}'
  imported: string // '备份导入成功，列表已刷新'

  // ---- 词本列表（WordList.tsx）----
  emptyList: string

  // ---- 详情区（DetailView.tsx）----
  emptyDetail: string
  senseDefault: string
  noForms: string
  uk: string
  us: string
  deleteEntry: string // '🗑 删除'
  deleteEntryTitle: string
  senses: string
  forms: string
  note: string
  notePlaceholder: string

  // ---- 设置窗口（SettingsWindow.tsx）----
  settingsTitle: string
  firstRunBadge: string
  firstRunText: string
  firstRunNote: string
  gitRepo: string
  gitRepoPlaceholder: string
  hotkey: string
  hotkeyPlaceholder: string
  autoSave: string
  autoSaveDesc: string
  autoSync: string
  autoSyncDesc: string
  confirmDelete: string
  confirmDeleteDesc: string
  language: string
  apiOrder: string
  apiGoogle: string
  apiYoudao: string
  apiBaidu: string
  apiFirst: string
  apiFallback: string
  keyHelp: string
  keyLeft: string
  keyRight: string
  keyUpDown: string
  keyEnter: string
  keyDel: string
  keyEsc: string
  dictField: string
  dictInstalled: string // '已安装（{size}）：…'
  dictNotInstalled: string
  downloadDict: string
  reDownloadDict: string
  downloading: string
  openDictFolder: string
  deleteDict: string
  confirmDeleteDict: string
  dlConnecting: string
  dataManage: string
  exportBackup: string
  importRestore: string
  syncNow: string
  about: string

  // ---- 主进程 IPC（ipc.ts）----
  errNeedWord: string
  toastSaved: string // '已收录 {word}'
  toastSavedSynced: string
  toastSavedSyncFail: string
  saveSaved: string
  saveExists: string
  errNoGit: string
  exportTitle: string
  importTitle: string
  dbFilter: string
  errCancelExport: string
  errCancelImport: string
  toastImported: string
  dictDeleted: string // '词库已删除（释放约 {mb} MB）'

  // ---- 词库下载（dictDownload.ts）----
  errDownloading: string
  dlConnectingMsg: string
  dlExtracting: string
  errNoDb: string
  dlDone: string
  dictInstalledMsg: string // '词库已安装完成（{mb} MB）'

  // ---- 在线翻译（translate.ts）----
  errGoogleFormat: string
  errGoogleEmpty: string
  errYoudaoFormat: string
  errYoudaoEmpty: string
  errBaiduFormat: string
  errBaiduEmpty: string
  errAllFail: string

  // ---- 系统托盘（tray.ts）----
  trayTooltip: string
  trayMain: string
  traySettings: string
  trayQuit: string
}

/* ------------------------------ 简体中文 ------------------------------ */
export const zh: Translation = {
  cancel: '取消',
  save: '保存',
  close: '关闭',
  delete: '删除',
  retry: '重试',

  wordbook: '📒 生词本',
  wordCount: '· {n} 词',
  sort: '排序',
  sortNew: '最新添加',
  sortAlpha: '字母顺序',
  searchPlaceholder: '输入单词 / 释义检索，本地无结果时将走网络查询…',
  clear: '清除',
  settings: '⚙ 设置',
  sync: '⟳ 同步',
  deleteTitle: '删除词条',
  deleteConfirm: '确定删除 {word} 吗？删除后不可恢复。',
  alreadyInDict: '{word} 已在词库中',
  noteSaved: '备注已保存',
  deleted: '已删除 {word}',
  settingsSaved: '设置已保存',
  exported: '已导出备份：{path}',
  imported: '备份导入成功，列表已刷新',

  emptyList: '还没有生词，去搜索框查一个吧～',
  emptyDetail: '在左侧选择单词，或在搜索框输入新词',
  senseDefault: '释义',
  noForms: '（无词形变化）',
  uk: '英',
  us: '美',
  deleteEntry: '🗑 删除',
  deleteEntryTitle: '删除该词条',
  senses: '释义',
  forms: '词形变化',
  note: '备注',
  notePlaceholder: '添加个人备注…',

  settingsTitle: '设置',
  firstRunBadge: '🎉 首次使用：',
  firstRunText: '请先填写 Git 仓库链接，之后每次收录新词都会自动同步备份到该仓库。',
  firstRunNote: '（可先关闭稍后再填）',
  gitRepo: 'Git 仓库链接',
  gitRepoPlaceholder: 'https://github.com/you/trnote-backup.git',
  hotkey: '全局快捷键（呼出主界面）',
  hotkeyPlaceholder: 'Ctrl+Alt+T',
  autoSave: '自动收录',
  autoSaveDesc: '搜索完成后自动保存单词',
  autoSync: '自动 Git 同步',
  autoSyncDesc: '收录新词后自动 commit + push',
  confirmDelete: '删除单词确认',
  confirmDeleteDesc: '删除词条前弹出确认面板（关闭后直接删除）',
  language: '界面语言',
  apiOrder: '翻译 API 兜底顺序（拖动排序）',
  apiGoogle: 'Google 翻译',
  apiYoudao: '有道翻译',
  apiBaidu: '百度翻译',
  apiFirst: '优先',
  apiFallback: '兜底',
  keyHelp: '方向键 & 快捷键说明',
  keyLeft: '搜索框 → 左侧词本',
  keyRight: '左侧词本 → 搜索框',
  keyUpDown: '输入框为空：切到词本切换单词；有内容：选择联想项',
  keyEnter: '确认收录 / 选择高亮联想',
  keyDel: '左侧词本中删除当前选中的单词',
  keyEsc: '收起主窗口（弹窗 / 确认框打开时先关闭它们）',
  dictField: '本地完整词库（ECDICT）',
  dictInstalled: '已安装（{size}）：输入即出完整离线释义与音标',
  dictNotInstalled: '未安装：仅内置小词表 + 网络翻译；安装后支持全词库离线查词',
  downloadDict: '下载词库',
  reDownloadDict: '重新下载词库',
  downloading: '下载中…',
  openDictFolder: '打开词典文件夹',
  deleteDict: '删除词库',
  confirmDeleteDict: '确认删除？',
  dlConnecting: '连接中…',
  dataManage: '数据管理',
  exportBackup: '导出备份',
  importRestore: '导入恢复',
  syncNow: '立即同步',
  about: '关于',

  errNeedWord: '请输入单词',
  toastSaved: '已收录 {word}',
  toastSavedSynced: '已收录 {word}，已自动同步',
  toastSavedSyncFail: '已收录 {word}，Git 同步失败',
  saveSaved: '已收录',
  saveExists: '已存在（已更新释义）',
  errNoGit: '未配置 Git 仓库链接，请在设置中填写',
  exportTitle: '导出备份',
  importTitle: '导入备份',
  dbFilter: 'SQLite 数据库',
  errCancelExport: '已取消导出',
  errCancelImport: '已取消导入',
  toastImported: '备份导入成功',
  dictDeleted: '词库已删除（释放约 {mb} MB）',

  errDownloading: '词库正在下载中，请稍候',
  dlConnectingMsg: '正在连接下载源…',
  dlExtracting: '正在解压安装…',
  errNoDb: '压缩包内未找到词库数据库文件',
  dlDone: '词库安装完成',
  dictInstalledMsg: '词库已安装完成（{mb} MB）',

  errGoogleFormat: 'Google 返回格式异常',
  errGoogleEmpty: 'Google 无结果',
  errYoudaoFormat: '有道返回格式异常',
  errYoudaoEmpty: '有道无结果',
  errBaiduFormat: '百度返回格式异常',
  errBaiduEmpty: '百度无结果',
  errAllFail: '所有翻译接口均不可用，请检查网络或稍后重试',

  trayTooltip: 'TRNote 生词本',
  trayMain: '主界面',
  traySettings: '设置',
  trayQuit: '退出'
}

/* ------------------------------- English ------------------------------- */
export const en: Translation = {
  cancel: 'Cancel',
  save: 'Save',
  close: 'Close',
  delete: 'Delete',
  retry: 'Retry',

  wordbook: '📒 Wordbook',
  wordCount: '· {n} words',
  sort: 'Sort',
  sortNew: 'Newest',
  sortAlpha: 'Alphabetical',
  searchPlaceholder: 'Type a word / meaning to search. If no local result, it queries online…',
  clear: 'Clear',
  settings: '⚙ Settings',
  sync: '⟳ Sync',
  deleteTitle: 'Delete Entry',
  deleteConfirm: 'Delete {word}? This cannot be undone.',
  alreadyInDict: '{word} is already in the wordbook',
  noteSaved: 'Note saved',
  deleted: 'Deleted {word}',
  settingsSaved: 'Settings saved',
  exported: 'Backup exported: {path}',
  imported: 'Backup imported, list refreshed',

  emptyList: 'No words yet. Search for one to add it!',
  emptyDetail: 'Select a word on the left, or type a new word to search',
  senseDefault: 'Definition',
  noForms: '(no inflections)',
  uk: 'UK',
  us: 'US',
  deleteEntry: '🗑 Delete',
  deleteEntryTitle: 'Delete this entry',
  senses: 'Senses',
  forms: 'Forms',
  note: 'Note',
  notePlaceholder: 'Add a personal note…',

  settingsTitle: 'Settings',
  firstRunBadge: '🎉 First run: ',
  firstRunText: 'Please enter your Git repository URL. Every new word will be synced to it as a backup.',
  firstRunNote: '(You can close this and fill it in later)',
  gitRepo: 'Git Repository URL',
  gitRepoPlaceholder: 'https://github.com/you/trnote-backup.git',
  hotkey: 'Global Hotkey (show main window)',
  hotkeyPlaceholder: 'Ctrl+Alt+T',
  autoSave: 'Auto save',
  autoSaveDesc: 'Automatically save words after searching',
  autoSync: 'Auto Git sync',
  autoSyncDesc: 'Auto commit + push after adding a word',
  confirmDelete: 'Confirm before deleting',
  confirmDeleteDesc: 'Show a confirmation panel before deleting (off = delete directly)',
  language: 'Language',
  apiOrder: 'Translation API fallback order (drag to sort)',
  apiGoogle: 'Google Translate',
  apiYoudao: 'Youdao Translate',
  apiBaidu: 'Baidu Translate',
  apiFirst: 'Primary',
  apiFallback: 'Fallback',
  keyHelp: 'Arrow keys & shortcuts',
  keyLeft: 'Search box → word list',
  keyRight: 'Word list → search box',
  keyUpDown: 'Empty input: switch to list & move selection; with text: pick suggestion',
  keyEnter: 'Confirm save / pick highlighted suggestion',
  keyDel: 'Delete the selected word in the word list',
  keyEsc: 'Hide main window (closes popups / confirmations first)',
  dictField: 'Full Local Dictionary (ECDICT)',
  dictInstalled: 'Installed ({size}): full offline senses & phonetics as you type',
  dictNotInstalled: 'Not installed: built-in mini dictionary + online translation only. Install for full offline lookups',
  downloadDict: 'Download dictionary',
  reDownloadDict: 'Re-download dictionary',
  downloading: 'Downloading…',
  openDictFolder: 'Open dictionary folder',
  deleteDict: 'Delete dictionary',
  confirmDeleteDict: 'Confirm delete?',
  dlConnecting: 'Connecting…',
  dataManage: 'Data management',
  exportBackup: 'Export backup',
  importRestore: 'Import / restore',
  syncNow: 'Sync now',
  about: 'About',

  errNeedWord: 'Please enter a word',
  toastSaved: 'Saved {word}',
  toastSavedSynced: 'Saved {word}, synced',
  toastSavedSyncFail: 'Saved {word}, Git sync failed',
  saveSaved: 'Saved',
  saveExists: 'Already exists (senses updated)',
  errNoGit: 'No Git repository configured. Please fill it in Settings',
  exportTitle: 'Export backup',
  importTitle: 'Import backup',
  dbFilter: 'SQLite Database',
  errCancelExport: 'Export cancelled',
  errCancelImport: 'Import cancelled',
  toastImported: 'Backup imported',
  dictDeleted: 'Dictionary deleted (freed about {mb} MB)',

  errDownloading: 'Dictionary is downloading, please wait',
  dlConnectingMsg: 'Connecting to download source…',
  dlExtracting: 'Extracting & installing…',
  errNoDb: 'No dictionary database found in the archive',
  dlDone: 'Dictionary installed',
  dictInstalledMsg: 'Dictionary installed ({mb} MB)',

  errGoogleFormat: 'Google returned an unexpected format',
  errGoogleEmpty: 'Google returned no result',
  errYoudaoFormat: 'Youdao returned an unexpected format',
  errYoudaoEmpty: 'Youdao returned no result',
  errBaiduFormat: 'Baidu returned an unexpected format',
  errBaiduEmpty: 'Baidu returned no result',
  errAllFail: 'All translation APIs unavailable. Check your network or retry later',

  trayTooltip: 'TRNote Wordbook',
  trayMain: 'Main window',
  traySettings: 'Settings',
  trayQuit: 'Quit'
}

/** 语言包注册表（新增语言：在此加一项） */
export const translations: Record<Lang, Translation> = { zh, en }

/** 各语言的自称（语言下拉显示，不随界面语言变化；新增语言在此补充） */
export const LANG_NAMES: Record<Lang, string> = {
  zh: '中文',
  en: 'English'
}

/** 支持的语言列表（新增语言：在此追加；设置下拉自动渲染） */
export const SUPPORTED_LANGS: Lang[] = ['zh', 'en']

export type TranslationKey = keyof Translation

/** 取翻译文本；{x} 占位符由 params 替换 */
export function getText(
  lang: Lang,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let s = translations[lang]?.[key] ?? zh[key] ?? String(key)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.split(`{${k}}`).join(String(v))
    }
  }
  return s
}

/** 主进程用：绑定到指定语言的翻译函数 */
export function makeT(lang: Lang): (key: TranslationKey, params?: Record<string, string | number>) => string {
  return (key, params) => getText(lang, key, params)
}
