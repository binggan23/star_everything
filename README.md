# Star Everything

本地优先的个人收藏应用：用网址、作者和可扩展标签保存、整理并查找跨平台内容。V1 目标为 Linux `.deb` 与 Windows `.exe`，数据保存在本机 SQLite，无需账号或云服务。

需求以 [`docs/srs.md`](docs/srs.md) 为准，领域术语见 [`GLOSSARY.md`](GLOSSARY.md)。

## 开发

要求：Node.js 22+、Rust 1.77+，以及 Tauri 2 的 Linux 系统依赖（WebKitGTK 4.1、GTK 3）。

```sh
npm install
npm run dev                 # 浏览器中的前端
npm run tauri dev           # 桌面应用
npm test                    # Vitest + React Testing Library
npm run build               # 类型检查 + 前端构建
npm run format:check        # Prettier
npm run tauri build -- --bundles deb
cargo test --manifest-path src-tauri/Cargo.toml
```

## 结构

- `src/domain/`：领域规则（网址/作者至少一项、`Home` 根收藏夹）。
- `src/data/`：`SqlDriver` 端口与收藏仓储；schema 迁移按版本执行。
  - 桌面端适配器：`sqlDriver.ts` + `tauriSqlDriver.ts`（Tauri SQL 插件）。
  - 测试适配器：`src/test/support/`（Node 内置 `node:sqlite`，使用真实 SQLite）。
- `src/app/`：React 界面；`App` 通过 `CollectionRepository` 注入数据层。
- `src-tauri/`：Tauri 2 桌面壳，仅承载原生启动与 SQL 插件桥接。
