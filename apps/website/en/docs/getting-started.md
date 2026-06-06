# Getting Started

## Installation

Head to the [Download](/en/download) page to grab the installer for your platform, then follow the steps below.

- **Windows**: Double-click the `.exe` installer and follow the wizard.
- **macOS**: Open the `.dmg`, drag the app into your Applications folder. If macOS says the app is "damaged", see [FAQ](/en/docs/faq).
- **Linux**: Install via the `.deb` / `.rpm` package, or run the `.AppImage` directly.

No official release yet? See [Build from Source](/en/download#build-from-source) to compile it yourself.

## Interface Layout

The app is divided into three areas:

**Left sidebar**: Lists all tools with a keyword search bar; recently used tools appear at the bottom. Click any tool to open it in a tab on the right.

**Right multi-tab area**: Each tool gets its own tab. Open as many as you like — they don't interfere with each other. Closing a tab preserves unsaved content (it's restored when you reopen the tool).

**AI panel**: Click the AI icon in the top-right corner to expand the side panel. Available from any tool page — paste content and ask questions directly. Conversation history is saved automatically to the local database.

## Configuring the AI Assistant

You need to configure a provider before using the AI assistant for the first time:

1. Click the **Settings** icon in the top-right toolbar (or press `Ctrl/Cmd + ,`).
2. Go to the **AI Assistant** tab and choose a provider:

| Provider | API Key required |
|----------|-----------------|
| Claude (Anthropic) | Yes |
| OpenAI | Yes |
| DeepSeek | Yes |
| Codex (OpenAI Codex) | Yes |
| Grok (xAI) | Yes |
| Ollama (local) | No — just set the BaseURL |

3. Enter your API Key (for Ollama, enter the local address — default `http://localhost:11434`), then click **Test Connection** to verify.
4. Save and close Settings. The AI panel is now ready to use.

> **Note for users needing a proxy:** OpenAI, Claude, and Grok are only accessible with a proxy from some regions. DeepSeek and Ollama (local) work without one.

## For Developers: Adding a New Tool

Three steps:

**Step 1**: Create `meta.ts` and `Tool.vue` in `packages/ui/src/tools/<id>/`:

```ts
// packages/ui/src/tools/my-tool/meta.ts
import type { ToolMeta } from '../../registry'

export const meta: ToolMeta = {
  id: 'my-tool',
  name: { zh: '我的工具', en: 'My Tool' },
  desc: { zh: '工具简介', en: 'Tool description' },
  category: 'misc',
  keywords: ['my-tool'],
  icon: '🔧',
  load: () => import('./Tool.vue'),
}
```

**Step 2**: Register it at the end of the `TOOLS` array in `packages/ui/src/tools/index.ts`:

```ts
import { meta as myTool } from './my-tool/meta'

export const TOOLS: ToolMeta[] = [
  // ...existing tools
  myTool,
]
```

**Step 3**: Run `pnpm dev` — the new tool appears in the left sidebar immediately.
