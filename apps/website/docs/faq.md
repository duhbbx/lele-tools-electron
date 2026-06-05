# 常见问题

## 安装与启动

### macOS 提示"已损坏"或"无法打开"

App 没有通过苹果公证（公证一年需要 99 美元，开源项目不值得）。在终端运行一次即可：

```bash
xattr -dr com.apple.quarantine /Applications/乐乐的工具箱.app
```

或者：右键 → 打开 → 仍要打开。这是一次性操作，之后直接双击正常启动。

### Linux 启动报错

`.deb` / `.rpm` 包已声明依赖项，正常通过包管理器安装会自动拉取。如手动安装遇到缺库错误，按提示安装对应系统包即可。AppImage 版本自带运行时，无需额外依赖。

## AI 助手

### AI 连不上 / 请求失败

按以下顺序排查：

1. **检查 API Key**：进入设置 → AI 助手，确认 Key 填写完整，没有多余空格或缺字符。
2. **检查 BaseURL**：使用自定义 API 地址时，确认末尾没有多余斜杠，且地址可访问。
3. **网络代理**：访问 OpenAI、Claude、Grok 等境外服务需自备代理。DeepSeek 和 Ollama 本地模型在国内网络下可直接使用。
4. **测试连接**：设置页面有"测试连接"按钮，点击查看具体错误信息。
5. **Ollama**：确认本地 Ollama 服务已启动（默认地址 `http://localhost:11434`），且已拉取所需模型（`ollama pull <model>`）。

## 数据安全

### 我的数据存在哪

所有数据保存在本地 SQLite 数据库，路径：

- **macOS**：`~/Library/Application Support/Lele Tools/lele.db`
- **Windows**：`%APPDATA%\Lele Tools\lele.db`
- **Linux**：`~/.config/Lele Tools/lele.db`

直接备份该文件即可迁移到其他机器。

### 会上传数据到服务器吗

**不会。** 所有功能本地运行，应用内不收集任何用户数据。AI 请求由 Electron 主进程直接发往所配置的服务商，不经过任何中间服务器。

## 关于本项目

### 为什么用 Electron 重写，放弃了 Qt 版？

Qt 版 [lele-tools](https://github.com/duhbbx/lele-tools) 已积累了 50+ 工具，但随着工具数量增加，C++/Qt 的维护成本（编译环境、跨平台打包、UI 样式统一）越来越高。Electron + Vue3 的 Web 技术栈让 UI 开发更快、组件复用更容易，也让集成 AI 对话（流式 SSE、多 provider SDK）变得自然。Electron 版从零开始，工具数量会逐步追上 Qt 版。

### 想添加新工具或修 bug，怎么贡献？

1. Fork [仓库](https://github.com/duhbbx/lele-tools-electron)
2. 参考 [快速上手 → 开发者：添加新工具](/docs/getting-started#开发者-添加新工具) 一节了解架构
3. 提 Pull Request

欢迎通过 [GitHub Issues](https://github.com/duhbbx/lele-tools-electron/issues) 反馈问题或建议。
