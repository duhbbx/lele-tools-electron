# Lele Tools Electron — 乐乐的工具箱（桌面版）

Qt 版 [lele-tools](https://github.com/duhbbx/lele-tools) 的 Electron 重写，内置 15 个开发者常用工具和 AI 助手对话面板。

> 乐乐是我可可爱爱的儿子，这个工具箱以他命名。

## 功能一览

**编码 & 格式化**：JSON 格式化、XML 格式化、YAML 格式化、Base64 编解码、进制转换

**文本**：正则测试、字符统计、文本加解密（AES-256-GCM）

**生成器**：随机密码生成、UUID 生成（v4）、二维码生成

**时间**：时间戳转换、Cron 表达式解析

**其他**：颜色工具（HEX/RGB/HSL 互转）、HTTP 状态码速查

## AI 助手

内置多 provider AI 对话面板，支持：

- **Claude**（Anthropic）
- **OpenAI**（GPT 系列）
- **DeepSeek**
- **Codex**（OpenAI Codex）
- **Grok**（xAI）
- **Ollama**（本地运行）

AI 请求由 Electron 主进程发出（IPC 代理），绕开渲染层的 CORS 限制。对话历史通过 better-sqlite3 持久化到本地数据库，无需网络同步。

## 技术栈

Electron 34 / Vue 3.5 / Vite 6 / TypeScript / SCSS / Monaco Editor / better-sqlite3

## 开发

```bash
# macOS 上首次安装（原生模块编译需要 python3.9）
export PYTHON=python3.9
pnpm install

# 启动开发环境
pnpm dev

# 运行测试
pnpm test

# 打包（生成可分发安装包）
pnpm dist
```

> **注意（macOS）：** 系统默认 Python 3.14 缺少 `distutils`，`better-sqlite3` 的 node-gyp 编译会失败，必须先 `export PYTHON=python3.9`。

## 目录结构

```
apps/desktop/          Electron 主进程 + 渲染入口（electron-vite 三段式）
packages/ui/           Vue 组件库，工具页面、AI 面板（TS 源码包，无构建步骤）
packages/shared-types/ 主进程 ↔ 渲染层 IPC 类型契约
```

## 如何添加一个新工具

1. 在 `packages/ui/src/tools/<id>/` 下新建 `meta.ts`（填 id、name、category）和 `Tool.vue`
2. 在 `packages/ui/src/tools/index.ts` 的 `TOOLS` 数组末尾追加一行 `import { meta as xxx } from './<id>/meta'` 并加入数组
3. 运行 `pnpm dev` 即可在左侧导航看到新工具

## 开源协议

[MIT License](LICENSE)
