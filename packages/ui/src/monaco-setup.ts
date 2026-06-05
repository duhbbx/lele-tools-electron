// NLS must be installed before monaco-editor is imported:
// monaco's nls.js is lazy-lookup (reads from globalThis._VSCODE_NLS_MESSAGES on each localize() call),
// but some action labels / command descriptions are evaluated and cached at module load time,
// so this import must come first to ensure its side-effect runs earliest.
import './monaco-nls'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment
  }
}

// SQL uses monaco's basic-languages; no dedicated language worker needed — editor.worker suffices.
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}

export { monaco }
