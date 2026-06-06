# FAQ

## Installation & Launch

### macOS says the app is "damaged" or "can't be opened"

The app hasn't gone through Apple notarization (notarization costs $99/year — not worth it for an open-source project). Run this once in Terminal to clear the quarantine flag:

```bash
xattr -dr com.apple.quarantine "/Applications/Lele Tools.app"
```

Alternatively: right-click the app → Open → Open anyway. This is a one-time step; after that you can launch normally by double-clicking.

### Linux launch error

The `.deb` / `.rpm` packages declare their dependencies, so a normal package-manager install will pull them in automatically. If you installed manually and see a missing-library error, install the indicated system package. The AppImage bundles its own runtime and needs no extra dependencies.

## AI Assistant

### AI won't connect / requests fail

Work through these checks in order:

1. **Check your API Key**: go to Settings → AI Assistant and make sure the key is complete — no extra spaces or missing characters.
2. **Check the BaseURL**: if you're using a custom endpoint, confirm there's no trailing slash and the address is reachable.
3. **Network proxy**: OpenAI, Claude, and Grok require a proxy from some regions. DeepSeek and Ollama (local) work without one.
4. **Test Connection**: use the "Test Connection" button on the settings page to see the exact error.
5. **Ollama**: make sure the local Ollama service is running (default `http://localhost:11434`) and that you've pulled the model you want (`ollama pull <model>`).

## Data & Privacy

### Where is my data stored?

Everything is stored in a local SQLite database:

- **macOS**: `~/Library/Application Support/Lele Tools/lele.db`
- **Windows**: `%APPDATA%\Lele Tools\lele.db`
- **Linux**: `~/.config/Lele Tools/lele.db`

Back up this file to migrate to another machine.

### Does the app upload anything?

**No.** All features run locally. The app collects no user data. AI requests go directly from the Electron main process to whichever provider you configured — no intermediary server.

## About This Project

### Why rewrite in Electron and leave the Qt version behind?

The Qt version ([lele-tools](https://github.com/duhbbx/lele-tools)) has grown to 50+ tools, but as the count climbed, the C++/Qt maintenance burden — build environments, cross-platform packaging, keeping UI consistent — kept growing too. The Electron + Vue 3 web stack makes UI development faster, component reuse easier, and AI integration (streaming SSE, multi-provider SDKs) completely natural. The Electron edition starts from scratch and will gradually catch up to the Qt version in tool count.

### I want to add a tool or fix a bug — how do I contribute?

1. Fork the [repository](https://github.com/duhbbx/lele-tools-electron)
2. Read [Getting Started → For Developers: Adding a New Tool](/en/docs/getting-started#for-developers-adding-a-new-tool) for the architecture overview
3. Open a Pull Request

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/duhbbx/lele-tools-electron/issues).
