# Star Everything：本地优先、多端可扩展

Star Everything 是单用户的个人收藏应用。V1 交付 Linux `.deb` 和 Windows `.exe`，使用 TypeScript、React 和 Tauri 2；数据保存在本机 SQLite，并以完整版本化 JSON 备份迁移。选用 Tauri 是为了复用成熟的 TypeScript/React 开发流程，同时保留桌面与后续 Android 扩展路径；不做账号或云同步。

收藏以标签为核心：一条记录至少有 URL 或作者之一，同一 URL 可有多条独立记录；收藏夹可嵌套，记录可多重归属。Bilibili 可尝试读取公开页面元数据，抖音和小红书优先解析用户粘贴的分享文案；始终允许手工补录，不登录、不调用私有 API、不绕过验证码或反爬。
