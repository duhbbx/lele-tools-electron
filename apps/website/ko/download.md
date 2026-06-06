# 다운로드

> 첫 번째 공식 릴리스를 준비 중입니다. 그 전까지는 소스에서 빌드하거나 [GitHub Releases](https://github.com/duhbbx/lele-tools-electron/releases)를 구독하여 업데이트를 기다려 주세요.

<DownloadMatrix />

## 지원 플랫폼

| 플랫폼 | 형식 |
|--------|------|
| Windows | `.exe` (NSIS) / `.zip` |
| macOS | `.dmg` / `.zip` |
| Linux | `.deb` / `.rpm` / `.AppImage` |

## 소스에서 빌드하기

```bash
git clone https://github.com/duhbbx/lele-tools-electron.git
cd lele-tools-electron
pnpm install
pnpm dist   # 결과물: apps/desktop/release/
```

macOS에서 앱이 "손상되었습니다"라고 표시되면 [자주 묻는 질문](/ko/docs/faq)을 참고하세요.
