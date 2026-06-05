/**
 * Monaco NLS (i18n path):
 *
 *   - All `localize('keyStr', 'Fallback')` calls in monaco-editor/esm source are string-key form.
 *     The stock nls.js does not look up string keys; it just returns the fallback.
 *   - We redirect `monaco-editor/esm/vs/nls.js` to `vendor/monaco-nls-shim.ts` via a Vite
 *     plugin resolveId hook so the shim supports both numeric idx + English-fallback lookup paths.
 *   - This file: ① at startup, reads the saved locale from localStorage and sets
 *     `_VSCODE_NLS_MESSAGES` / `_VSCODE_NLS_LANGUAGE` on globalThis (shim checks
 *     getNLSLanguage()==='zh-cn' to decide whether to enable the fallback map);
 *     ② exposes `applyMonacoLocale` for runtime locale switching.
 *
 * Monkey-patching nls.localize is not viable (ESM exports are non-configurable).
 * The alias/resolveId approach is the correct solution.
 */
import { ZH_CN_MESSAGES } from './vendor/monaco-nls-zh-cn'

interface NlsGlobal {
  _VSCODE_NLS_MESSAGES?: (string | null)[]
  _VSCODE_NLS_LANGUAGE?: string
  /** Explicit English-mode flag: when true, all string-key lookups use English fallback. */
  _LELE_NLS_DISABLED?: boolean
}
const G = globalThis as unknown as NlsGlobal

function loadZhCn(): void {
  G._VSCODE_NLS_MESSAGES = ZH_CN_MESSAGES
  G._VSCODE_NLS_LANGUAGE = 'zh-cn'
  G._LELE_NLS_DISABLED = false
}

function clearLocale(): void {
  G._VSCODE_NLS_MESSAGES = undefined
  G._VSCODE_NLS_LANGUAGE = 'en'
  G._LELE_NLS_DISABLED = true
}

/** Switch Monaco NLS state to match the given locale. */
export function applyMonacoLocale(locale: 'zh' | 'en'): void {
  if (locale === 'zh') {
    if (G._VSCODE_NLS_LANGUAGE !== 'zh-cn') loadZhCn()
  } else {
    if (G._VSCODE_NLS_LANGUAGE !== 'en') clearLocale()
  }
}

// On module load, decide NLS based on saved locale in localStorage.
// Locale is stored inside the 'lele.settings' JSON blob (field `locale`).
// Defaults to 'zh' (main user base is Chinese; user switching to English writes the blob).
try {
  const saved = (() => {
    try {
      return (JSON.parse(localStorage.getItem('lele.settings') ?? '{}') as { locale?: string }).locale ?? null
    } catch {
      return null
    }
  })()
  let pick: 'zh' | 'en'
  if (saved === 'zh' || saved === 'en') pick = saved
  else pick = 'zh'
  applyMonacoLocale(pick)
  if (typeof console !== 'undefined') {
    console.log('[lele monaco-nls] init', {
      saved,
      pick,
      msgCount: G._VSCODE_NLS_MESSAGES?.length ?? 0,
    })
  }
} catch (e) {
  if (typeof console !== 'undefined') {
    console.error('[lele monaco-nls] init failed:', e)
  }
}
