# TRNote · 个人英语生词本

> **Translate & Record** —— 遇到生词，翻译即记录，随时查阅。

本地桌面应用（**Electron** + React + TypeScript + SQLite），单用户、纯本地、自动 Git 备份。
> 采用 Electron 而非 Tauri：自带 Chromium，**不依赖系统 WebView2**，任何 Windows 电脑都能直接运行。

---

## ✨ 功能

- **查词即收录**：输入单词 → 本地词库实时联想 → 停顿后本地无结果自动走网络翻译 → 自动保存
- **词典式详情**：音标（英/美）+ 多词性释义（`;` 分隔）+ 词形变化（过去式/复数/比较级…）+ 例句 + 备注
- **三栏主界面**：左列表（最新/字母排序）+ 右上搜索框 + 右下详情（默认最新单词）
- **全局快捷键**：默认 `Ctrl+Alt+T` 呼出主界面（可在设置中自定义）
- **系统托盘**：左键→主界面；右键→主界面 / 设置 / 退出；关闭窗口隐藏到托盘
- **自动 Git 同步**：收录新词后自动 commit + push（失败可重试）
- **备份恢复**：整库一键导出 / 导入（SQLite 在线备份，热备份不丢数据）
- **翻译兜底链**：Google（免费接口）→ 有道 → 百度，顺序可在设置中拖动调整

---

## 🚀 快速开始

### 1. 首次运行

1. 双击 `TRNote.exe`（或运行安装包）
2. **首次启动会自动弹出设置窗口**，填写 Git 仓库链接（如 `https://github.com/you/trnote-backup.git`）
3. 之后每次收录新词，都会自动 `git commit + push` 备份到该仓库

> 数据文件位置：`%APPDATA%\TRNote\trnote.db`
> 该目录本身就是一个 git 仓库，数据库文件会同步到你的远程仓库。

### 2. （可选）启用完整 ECDICT 本地词库

内置了一个常用 + 编程术语的小型兜底词表（离线可用）。
若要启用**完整离线词库（约 76 万词条）**：

1. 从 <https://github.com/skywind3000/ECDICT> 下载 `ecdict.csv`（或现成的 `ecdict.db`）
2. 运行转换脚本生成 `ecdict.db`：

   ```bash
   node scripts/build-ecdict.mjs <ecdict.csv 路径>
   ```

3. 把生成的 `ecdict.db` 复制到 `%APPDATA%\TRNote\ecdict.db`
4. 重启 TRNote 即自动加载

> 未放置该文件也不影响使用，会回退到内置词表 + 网络兜底。

---

## 🛠 开发

```bash
pnpm install        # 安装依赖
pnpm tauri dev      # 开发模式（热更新 + 自动重编译 Rust）
pnpm tauri build    # 打包 exe（产物在 src-tauri/target/release/bundle）
pnpm build          # 仅构建前端（tsc 类型检查 + vite）
```

### 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | **Electron 33**（自带 Chromium，无需 WebView2） |
| 前端 | React 18 + Vite + TypeScript（electron-vite） |
| 主进程 | TypeScript（electron-vite 打包） |
| 存储 | SQLite（`better-sqlite3`，WAL） |
| 本地词典 | ECDICT（只读 SQLite）+ 内置编程术语表 |
| 翻译 | Google（免费接口）→ 有道 → 百度，`fetch` 请求 |
| Git 同步 | 直接调用系统 `git` 命令（child_process） |

### 目录结构

```
src/main/                 # Electron 主进程（Node/TS）
  index.ts                # 入口：窗口/托盘/快捷键装配
  ipc.ts                  # IPC 命令层
  db.ts                   # SQLite 数据层（words/senses/forms/settings）
  dict.ts                 # 本地词典引擎（ECDICT + 内置兜底 + 前缀联想）
  translate.ts            # 在线翻译兜底链
  gitSync.ts              # Git 自动同步
  backup.ts               # 备份 / 恢复
  hotkey.ts               # 全局快捷键
  window.ts               # 主窗口管理
src/preload/              # 预加载（contextBridge 暴露 window.api）
src/shared/               # 前后端共享类型
src/renderer/             # React 前端
  src/App.tsx             # 主界面 + 交互逻辑
  src/api.ts              # window.api 桥接
  src/components/         # 列表 / 详情 / 设置 / Toast
```

### 构建命令

```bash
pnpm install         # 安装依赖（postinstall 会重建 better-sqlite3）
pnpm dev             # 开发模式（electron-vite dev，热更新）
pnpm build           # 构建 out/（main + preload + renderer）
pnpm typecheck       # TS 类型检查
pnpm start           # 预览构建产物
pnpm build:win       # 打包 exe（electron-builder，产物在 release/）
```

---

## 📄 文档

- `需求文档.md` —— 需求、交互、架构（含 Mermaid 架构图）、数据库设计
- `工程日志.md` —— 每次功能实现的改动记录（含日期时分）
- `prototype/index.html` —— 界面原型（浏览器双击打开）
