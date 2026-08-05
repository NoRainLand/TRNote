// 临时：检查 ECDICT stardict.db 的表结构与查询
const Database = require('better-sqlite3')

const dbPath = process.argv[2] || (process.env.APPDATA + '\\TRNote\\ecdict.db')
console.log('db:', dbPath)
const db = new Database(dbPath, { readonly: true })
console.log('表:', JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()))
console.log('索引:', JSON.stringify(db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index'").all().slice(0, 10)))
try {
  console.log('列:', JSON.stringify(db.prepare('PRAGMA table_info(stardict)').all().map((c) => c.name)))
  // 检查索引覆盖的列
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='stardict'").all()
  for (const i of idx) {
    const cols = db.prepare(`PRAGMA index_info(${JSON.stringify(i.name)})`).all().map((c) => c.name)
    console.log(`索引 ${i.name}: ${cols.join(',')}`)
  }
  // 计时：前缀联想 + 精确查词
  let t = Date.now()
  const rows = db.prepare('SELECT sw FROM stardict WHERE sw >= ? AND sw < ? ORDER BY sw LIMIT 10').all('pub', 'puc')
  console.log(`前缀 pub 建议(${rows.length}条) 耗时: ${Date.now() - t}ms`)
  t = Date.now()
  const w = db.prepare('SELECT word, phonetic, translation, exchange FROM stardict WHERE word=?').get('public')
  console.log(`精确查 public 耗时: ${Date.now() - t}ms`)
  console.log('public 词条:', JSON.stringify(w)?.slice(0, 300))
} catch (e) {
  console.log('查询异常:', e.message)
}
db.close()
process.exit(0)
