/**
 * 多语言 nav / sidebar / UI 标签集中维护。内容(markdown)在各 locale 子目录。
 * 加新语言：1) 加 LocaleLabels 对象 2) config.ts locales 注册 3) 建目录翻译 markdown。
 */
import type { DefaultTheme, HeadConfig } from 'vitepress'

export interface LocaleLabels {
  // Nav
  home: string
  tools: string
  download: string
  docs: string
  roadmap: string
  github: string
  // Sidebar
  gettingStarted: string
  faq: string
  // UI
  editLink: string
  lastUpdated: string
}

const LABELS: Record<string, LocaleLabels> = {
  'zh-CN': {
    home: '首页', tools: '功能一览', download: '下载', docs: '文档', roadmap: '路线图', github: 'GitHub',
    gettingStarted: '快速上手', faq: '常见问题',
    editLink: '在 GitHub 上编辑此页', lastUpdated: '最近更新',
  },
  'en-US': {
    home: 'Home', tools: 'Tools', download: 'Download', docs: 'Docs', roadmap: 'Roadmap', github: 'GitHub',
    gettingStarted: 'Getting Started', faq: 'FAQ',
    editLink: 'Edit this page on GitHub', lastUpdated: 'Last updated',
  },
  'es-ES': {
    home: 'Inicio', tools: 'Herramientas', download: 'Descargar', docs: 'Documentación', roadmap: 'Hoja de ruta', github: 'GitHub',
    gettingStarted: 'Primeros pasos', faq: 'Preguntas frecuentes',
    editLink: 'Editar esta página en GitHub', lastUpdated: 'Última actualización',
  },
  'fr-FR': {
    home: 'Accueil', tools: 'Outils', download: 'Télécharger', docs: 'Documentation', roadmap: 'Feuille de route', github: 'GitHub',
    gettingStarted: 'Premiers pas', faq: 'FAQ',
    editLink: 'Modifier cette page sur GitHub', lastUpdated: 'Dernière mise à jour',
  },
  'ja-JP': {
    home: 'ホーム', tools: 'ツール一覧', download: 'ダウンロード', docs: 'ドキュメント', roadmap: 'ロードマップ', github: 'GitHub',
    gettingStarted: 'クイックスタート', faq: 'よくある質問',
    editLink: 'GitHub でこのページを編集', lastUpdated: '最終更新',
  },
  'ko-KR': {
    home: '홈', tools: '도구 목록', download: '다운로드', docs: '문서', roadmap: '로드맵', github: 'GitHub',
    gettingStarted: '시작하기', faq: '자주 묻는 질문',
    editLink: 'GitHub에서 이 페이지 편집', lastUpdated: '마지막 업데이트',
  },
  'pt-BR': {
    home: 'Início', tools: 'Ferramentas', download: 'Baixar', docs: 'Documentação', roadmap: 'Roteiro', github: 'GitHub',
    gettingStarted: 'Primeiros passos', faq: 'Perguntas frequentes',
    editLink: 'Editar esta página no GitHub', lastUpdated: 'Última atualização',
  },
}

export const LOCALE_META: Record<string, { lang: string; label: string; title: string; description: string }> = {
  'zh-CN': { lang: 'zh-CN', label: '简体中文', title: '乐乐的工具箱', description: '开源跨平台开发者工具箱：格式化、编解码、生成器、时间工具，内置 AI 助手。' },
  'en-US': { lang: 'en-US', label: 'English', title: 'Lele Tools', description: 'Open-source cross-platform developer toolbox: formatters, encoders, generators, time utilities, with a built-in AI assistant.' },
  'es-ES': { lang: 'es-ES', label: 'Español', title: 'Lele Tools', description: 'Caja de herramientas de código abierto y multiplataforma para desarrolladores, con asistente de IA integrado.' },
  'fr-FR': { lang: 'fr-FR', label: 'Français', title: 'Lele Tools', description: "Boîte à outils open source et multiplateforme pour développeurs, avec assistant IA intégré." },
  'ja-JP': { lang: 'ja-JP', label: '日本語', title: 'Lele Tools', description: 'オープンソースのクロスプラットフォーム開発者ツールボックス。AI アシスタント内蔵。' },
  'ko-KR': { lang: 'ko-KR', label: '한국어', title: 'Lele Tools', description: '오픈소스 크로스플랫폼 개발자 도구 모음. AI 어시스턴트 내장.' },
  'pt-BR': { lang: 'pt-BR', label: 'Português', title: 'Lele Tools', description: 'Caixa de ferramentas de código aberto e multiplataforma para desenvolvedores, com assistente de IA integrado.' },
}

const REPO = 'https://github.com/duhbbx/lele-tools-electron'

/** 生成某 locale 的 themeConfig（nav + sidebar + UI 文案） */
export function makeThemeConfig(localeKey: string, prefix: string): DefaultTheme.Config {
  const L = LABELS[localeKey]
  const p = prefix // '' or '/en' etc.
  return {
    nav: [
      { text: L.home, link: `${p}/` },
      { text: L.tools, link: `${p}/tools` },
      { text: L.download, link: `${p}/download` },
      { text: L.docs, link: `${p}/docs/getting-started` },
      { text: L.roadmap, link: `${p}/roadmap` },
    ],
    sidebar: {
      [`${p}/docs/`]: [
        { text: L.gettingStarted, link: `${p}/docs/getting-started` },
        { text: L.faq, link: `${p}/docs/faq` },
      ],
    },
    socialLinks: [{ icon: 'github', link: REPO }],
    editLink: { pattern: `${REPO}/edit/dev/apps/website/:path`, text: L.editLink },
    lastUpdated: { text: L.lastUpdated },
  }
}

/** 每 locale 的 head 标签（og:locale 等）；照 DBW 同名导出便于 config.ts 复用 */
export function makeLocaleHead(localeKey: string): HeadConfig[] {
  const meta = LOCALE_META[localeKey]
  return [
    ['meta', { property: 'og:locale', content: meta.lang.replace('-', '_') }],
    ['meta', { property: 'og:site_name', content: meta.title }],
  ]
}

/** config.ts 里 locales 注册用的便捷对象（key 与 DBW 一致） */
function localeEntry(localeKey: string, prefix: string) {
  const meta = LOCALE_META[localeKey]
  return {
    label: meta.label,
    lang: meta.lang,
    title: meta.title,
    description: meta.description,
    themeConfig: makeThemeConfig(localeKey, prefix),
    head: makeLocaleHead(localeKey),
  }
}

export const ZH = localeEntry('zh-CN', '')
export const EN = localeEntry('en-US', '/en')
export const ES = localeEntry('es-ES', '/es')
export const FR = localeEntry('fr-FR', '/fr')
export const JA = localeEntry('ja-JP', '/ja')
export const KO = localeEntry('ko-KR', '/ko')
export const PT = localeEntry('pt-BR', '/pt')
