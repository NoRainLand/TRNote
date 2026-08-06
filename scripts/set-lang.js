// 临时验证脚本：修改 trnote.db 的界面语言设置（用 ELECTRON_RUN_AS_NODE 运行）
const Database = require('better-sqlite3')
const path = process.env.APPDATA + '\\trnote\\trnote.db'
const lang = process.argv[2] || 'zh'
const db = new Database(path)
db.prepare(
  "INSERT INTO settings(key,value) VALUES('lang',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
).run(lang)
const row = db.prepare("SELECT value FROM settings WHERE key='lang'").get()
console.log('lang ->', row?.value)
db.close()
