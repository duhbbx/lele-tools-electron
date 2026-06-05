# 快速上手

## 安装

前往 [下载页](/download) 获取对应平台的安装包，按平台指引完成安装后启动应用。

- **Windows**：双击 `.exe` 安装包，按向导完成安装。
- **macOS**：打开 `.dmg`，将 App 拖入 Applications 文件夹。若提示"已损坏"，参见 [常见问题](/docs/faq)。
- **Linux**：通过 `.deb` / `.rpm` 包安装，或直接运行 `.AppImage`。

暂无正式 Release 时，可参考 [从源码构建](/download#从源码构建) 一节自行编译。

## 界面布局

应用界面分为三个区域：

**左侧导航栏**：列出所有工具，支持关键词搜索，底部显示最近使用的工具。点击任意工具即可在右侧打开对应 Tab。

**右侧多 Tab 区**：每个工具独立一个 Tab，可同时打开多个工具，互不干扰。关闭 Tab 不会清除未保存的内容（下次打开会恢复）。

**AI 面板**：点击右上角的 AI 图标展开侧边面板。可在任意工具页呼出，粘贴内容后直接向 AI 提问。对话历史自动保存到本地数据库。

## 配置 AI 助手

首次使用需在设置中配置 AI 服务商：

1. 点击工具栏右上角的 **设置** 图标（或 `Ctrl/Cmd + ,`）。
2. 切换到 **AI 助手** 标签页，选择服务商：

| 服务商 | 是否需要 Key |
|--------|------------|
| Claude（Anthropic） | 需要 API Key |
| OpenAI | 需要 API Key |
| DeepSeek | 需要 API Key |
| Codex（OpenAI Codex） | 需要 API Key |
| Grok（xAI） | 需要 API Key |
| Ollama（本地） | 无需 Key，填 BaseURL 即可 |

3. 填入 API Key（Ollama 填本地地址，默认 `http://localhost:11434`），点击 **测试连接** 验证。
4. 保存后关闭设置，AI 面板即可正常使用。

> **国内用户提示：** 访问 OpenAI / Claude 等境外服务需自备网络代理。DeepSeek 和 Ollama 本地模型在国内网络下可直接使用。

## 开发者：添加新工具

只需三步：

**第一步**：在 `packages/ui/src/tools/<id>/` 下新建 `meta.ts` 和 `Tool.vue`：

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

**第二步**：在 `packages/ui/src/tools/index.ts` 的 `TOOLS` 数组末尾注册：

```ts
import { meta as myTool } from './my-tool/meta'

export const TOOLS: ToolMeta[] = [
  // ...已有工具
  myTool,
]
```

**第三步**：运行 `pnpm dev`，左侧导航栏即可看到新工具。
