# Télécharger

> La première version officielle est en préparation. En attendant, vous pouvez compiler depuis les sources ou surveiller les [GitHub Releases](https://github.com/duhbbx/lele-tools-electron/releases) pour les mises à jour.

<DownloadMatrix />

## Plateformes supportées

| Plateforme | Format |
|------------|--------|
| Windows | `.exe` (NSIS) / `.zip` |
| macOS | `.dmg` / `.zip` |
| Linux | `.deb` / `.rpm` / `.AppImage` |

## Compiler depuis les sources

```bash
git clone https://github.com/duhbbx/lele-tools-electron.git
cd lele-tools-electron
pnpm install
pnpm dist   # résultat dans apps/desktop/release/
```

Si macOS indique que l'application est « endommagée », consultez la [FAQ](/fr/docs/faq).
