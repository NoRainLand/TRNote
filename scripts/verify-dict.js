// 验证 ECDICT 词库可用性（用 Electron 运行时跑，因为 better-sqlite3 按 Electron ABI 编译）
// 用法：node_modules\electron\dist\electron.exe scripts\verify-dict.js <db路径>
const Database = require('better-sqlite3')

const p = process.argv[2]
if (!p) {
  console.error('用法: electron scripts/verify-dict.js <db路径>')
  process.exit(1)
}

try {
  const db = new Database(p, { readonly: true })
  const cnt = db.prepare('SELECT count(*) c FROM stardict').get()
  const rows = db.prepare('SELECT sw, phonetic, translation FROM stardict WHERE sw LIKE ? LIMIT 3').all('pub%')
  console.log('stardict 词条数:', cnt.c)
  console.log('示例:', JSON.stringify(rows, null, 2))
  db.close()
  console.log('✅ 词库有效')
  process.exit(0)
} catch (e) {
  console.error('❌ 词库无效:', e.message)
  process.exit(1)
}
