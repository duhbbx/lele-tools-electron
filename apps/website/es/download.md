# Descargar

> La primera versión oficial está en camino. Mientras tanto, puedes compilar desde el código fuente o seguir [GitHub Releases](https://github.com/duhbbx/lele-tools-electron/releases) para estar al tanto de las novedades.

<DownloadMatrix />

## Plataformas compatibles

| Plataforma | Formato |
|------------|---------|
| Windows | `.exe` (NSIS) / `.zip` |
| macOS | `.dmg` / `.zip` |
| Linux | `.deb` / `.rpm` / `.AppImage` |

## Compilar desde el código fuente

```bash
git clone https://github.com/duhbbx/lele-tools-electron.git
cd lele-tools-electron
pnpm install
pnpm dist   # resultado en apps/desktop/release/
```

Si macOS indica que la app está "dañada", consulta las [Preguntas frecuentes](/es/docs/faq).
