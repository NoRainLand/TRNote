#!/usr/bin/env node
// 构建 ECDICT 本地词库（生成 TRNote 使用的 ecdict.db）
// 用法：
//   node scripts/build-ecdict.mjs <ecdict.csv> [输出.db]
// 需要 better-sqlite3：pnpm add -D better-sqlite3
//
// 说明：ECDICT 数据来自 https://github.com/skywind3000/ECDICT（MIT 协议）
// 生成后将 ecdict.db 复制到 %APPDATA%\TRNote\ecdict.db 即自动加载

import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const input = process.argv[2];
const output = process.argv[3] || "ecdict.db";

if (!input || !existsSync(input)) {
  console.error("用法: node scripts/build-ecdict.mjs <ecdict.csv> [输出.db]");
  process.exit(1);
}

// 输入已是 .db 直接复制
if (/\.db$/i.test(input)) {
  copyFileSync(input, output);
  console.log(`已复制 ${input} → ${output}`);
  process.exit(0);
}

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  console.error("缺少 better-sqlite3，请先运行：pnpm add -D better-sqlite3");
  process.exit(1);
}

// ---------- RFC4180 CSV 解析（支持引号内的逗号/换行） ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------- 建库 ----------
const db = new Database(output);
db.exec(`
  CREATE TABLE IF NOT EXISTS stardict (
    id INTEGER PRIMARY KEY,
    word TEXT, sw TEXT, phonetic TEXT, definition TEXT,
    translation TEXT, pos TEXT, collins INTEGER, oxford INTEGER,
    tag TEXT, bnc INTEGER, frq INTEGER, exchange TEXT, detail TEXT, audio TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_word ON stardict(word);
`);
const insert = db.prepare(
  `INSERT INTO stardict (word,sw,phonetic,definition,translation,pos,collins,oxford,tag,bnc,frq,exchange,detail,audio)
   VALUES (@word,@sw,@phonetic,@definition,@translation,@pos,@collins,@oxford,@tag,@bnc,@frq,@exchange,@detail,@audio)`,
);

// ---------- 解析 CSV 并入库 ----------
console.log(`正在读取 ${input} ...`);
const rows = parseCsv(readFileSync(input, "utf8"));
if (rows.length < 2) {
  console.error("CSV 内容为空或格式不正确");
  process.exit(1);
}

// 用表头定位列索引（兼容列顺序差异）
const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name);
const idx = {
  word: col("word"),
  phonetic: col("phonetic"),
  definition: col("definition"),
  translation: col("translation"),
  pos: col("pos"),
  collins: col("collins"),
  oxford: col("oxford"),
  tag: col("tag"),
  bnc: col("bnc"),
  frq: col("frq"),
  exchange: col("exchange"),
  detail: col("detail"),
  audio: col("audio"),
};
if (idx.word < 0) {
  console.error("未找到 word 列，表头：" + header.join(","));
  process.exit(1);
}

const tx = db.transaction((data) => {
  for (const r of data) insert.run(r);
});

let batch = [];
let count = 0;
const sw = (w) => String(w).toLowerCase();
for (let i = 1; i < rows.length; i++) {
  const c = rows[i];
  if (c.length <= idx.word) continue;
  batch.push({
    word: c[idx.word] ?? "",
    sw: sw(c[idx.word] ?? ""),
    phonetic: c[idx.phonetic] ?? "",
    definition: c[idx.definition] ?? "",
    translation: c[idx.translation] ?? "",
    pos: c[idx.pos] ?? "",
    collins: parseInt(c[idx.collins] ?? "0") || 0,
    oxford: parseInt(c[idx.oxford] ?? "0") || 0,
    tag: c[idx.tag] ?? "",
    bnc: parseInt(c[idx.bnc] ?? "0") || 0,
    frq: parseInt(c[idx.frq] ?? "0") || 0,
    exchange: c[idx.exchange] ?? "",
    detail: c[idx.detail] ?? "",
    audio: c[idx.audio] ?? "",
  });
  count++;
  if (batch.length >= 5000) {
    tx(batch);
    batch = [];
    process.stdout.write(`\r已导入 ${count} 条...`);
  }
}
if (batch.length) tx(batch);
process.stdout.write(`\r完成：共导入 ${count} 条。\n`);

console.log(`已生成 ${output}，请复制到 %APPDATA%\\TRNote\\ecdict.db`);
db.close();
