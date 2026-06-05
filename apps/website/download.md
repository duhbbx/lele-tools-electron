# 下载

> ⏳ 首个正式版本正在准备中。可先从源码构建，或关注 [GitHub Releases](https://github.com/duhbbx/lele-tools-electron/releases) 获取后续版本。

<DownloadMatrix />

## 支持平台

| 平台 | 格式 |
|------|------|
| Windows | `.exe` (NSIS) / `.zip` |
| macOS | `.dmg` / `.zip` |
| Linux | `.deb` / `.rpm` / `.AppImage` |

## 从源码构建

```bash
git clone https://github.com/duhbbx/lele-tools-electron.git
cd lele-tools-electron
pnpm install
pnpm dist   # 产物在 apps/desktop/release/
```

macOS 提示"已损坏"的处理见 [常见问题](/docs/faq)。
