# ダウンロード

> 最初の正式リリースを準備中です。それまでの間、ソースコードからビルドするか、[GitHub Releases](https://github.com/duhbbx/lele-tools-electron/releases) をウォッチして最新情報をお待ちください。

<DownloadMatrix />

## 対応プラットフォーム

| プラットフォーム | 形式 |
|-----------------|------|
| Windows | `.exe` (NSIS) / `.zip` |
| macOS | `.dmg` / `.zip` |
| Linux | `.deb` / `.rpm` / `.AppImage` |

## ソースからビルドする

```bash
git clone https://github.com/duhbbx/lele-tools-electron.git
cd lele-tools-electron
pnpm install
pnpm dist   # 出力先: apps/desktop/release/
```

macOS で「壊れている」と表示される場合は [FAQ](/ja/docs/faq) をご覧ください。
