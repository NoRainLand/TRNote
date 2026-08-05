// 临时：查询生词库内容（用 Electron 的 Node 运行，匹配 better-sqlite3 的 Electron ABI）
const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(process.env.APPDATA, 'TRNote', 'trnote.db')
console.log('db:', dbPath)
const db = new Database(dbPath, { readonly: true })
console.log('words 总数:', db.prepare('SELECT count(*) c FROM words').get().c)
console.log('最近词条:', JSON.stringify(db.prepare('SELECT word, created_at FROM words ORDER BY id DESC LIMIT 10').all()))
console.log('settings:', JSON.stringify(db.prepare('SELECT * FROM settings').all()))
db.close()
process.exit(0)
