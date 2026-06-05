/*
 * Replacement for `monaco-editor/esm/vs/nls.js` (injected via Vite plugin resolveId).
 *
 *   - numeric idx  → lookup in _VSCODE_NLS_MESSAGES array;
 *   - string key / { key, comment } object key → zh-cn fallback map lookup;
 *   - anything else → original English fallback.
 *
 * The shim also bootstraps the translation array into `globalThis` if not already set,
 * so Monaco Worker contexts (which don't execute the main bootstrap module) still work.
 */
// monaco-editor internal module, not exposed via package exports; exists at runtime as ESM file.
// @ts-expect-error monaco-editor internal subpath
import { getNLSLanguage, getNLSMessages } from 'monaco-editor/esm/vs/nls.messages.js'
import { ZH_CN_MESSAGES } from './monaco-nls-zh-cn'
import { ZH_CN_FALLBACK_MAP } from './monaco-nls-zh-cn-fallback-map'

export { getNLSLanguage, getNLSMessages }

interface NlsGlobal {
  _VSCODE_NLS_MESSAGES?: (string | null)[]
  _VSCODE_NLS_LANGUAGE?: string
  _LELE_NLS_DISABLED?: boolean
}
const G = globalThis as unknown as NlsGlobal

// In any context (main thread / worker): bootstrap NLS translations if not already set.
if (!G._VSCODE_NLS_MESSAGES) {
  G._VSCODE_NLS_MESSAGES = ZH_CN_MESSAGES
  G._VSCODE_NLS_LANGUAGE = 'zh-cn'
}

// When user switches to English via i18n.setLocale('en'), _LELE_NLS_DISABLED is set true,
// so all string-key lookups fall back to English.
function fallbackMapEnabled(): boolean {
  return G._LELE_NLS_DISABLED !== true
}

function format(message: string, args: unknown[]): string {
  if (!args.length) return message
  return message.replace(/\{(\d+)\}/g, (m, n) => {
    const a = args[+n]
    if (typeof a === 'string') return a
    if (typeof a === 'number' || typeof a === 'boolean') return String(a)
    if (a == null) return String(a)
    return m
  })
}

function lookupByIndex(idx: number, fallback: string): string {
  const msgs = getNLSMessages()
  const m = msgs?.[idx]
  return typeof m === 'string' ? m : fallback
}

function lookupByFallback(fallback: string): string | undefined {
  if (!fallbackMapEnabled()) return undefined
  return ZH_CN_FALLBACK_MAP[fallback]
}

export function localize(data: unknown, message: string, ...args: unknown[]): string {
  if (typeof data === 'number') return format(lookupByIndex(data, message), args)
  const zh = lookupByFallback(message)
  return format(zh ?? message, args)
}

export function localize2(
  data: unknown,
  message: string,
  ...args: unknown[]
): { value: string; original: string } {
  const resolved =
    typeof data === 'number' ? lookupByIndex(data, message) : (lookupByFallback(message) ?? message)
  const value = format(resolved, args)
  return { value, original: resolved === message ? value : format(message, args) }
}

if (typeof console !== 'undefined') {
  console.warn(
    '[lele monaco-nls-shim] LOADED · lang =',
    getNLSLanguage(),
    '· msgCount =',
    getNLSMessages()?.length ?? 0,
  )
}
