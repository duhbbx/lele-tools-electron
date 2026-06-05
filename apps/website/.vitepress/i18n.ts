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

/* ---------------------------------------------------------------------------
 * ComponentLabels: 给 .vitepress/components/*.vue 用的运行时翻译表。
 * 组件里:
 *   import { useData } from 'vitepress'
 *   import { getComponentLabels } from '../i18n'
 *   const { lang } = useData()
 *   const L = computed(() => getComponentLabels(lang.value))
 * ------------------------------------------------------------------------ */

/** DownloadMatrix rows[].label 的 key */
export type MatrixRowKey =
  | 'macArm'
  | 'winInstaller'
  | 'winInstallerArm'
  | 'winPortable'
  | 'winPortableArm'
  | 'linuxAppimage'
  | 'linuxDeb'
  | 'linuxRpm'
  | 'linuxPacman'
  | 'linuxAppimageArm'
  | 'linuxTarGz'

export interface ComponentLabels {
  features: Array<{ icon: string; title: string; desc: string }>
  download: {
    platforms: { macos: string; windows: string; linux: string; unknown: string }
    currentPlatform: string
    seeAll: string
    download: (label: string) => string
    cnMirror: string
    githubSrc: string
    cnTip: string
    intlTip: string
  }
  matrix: {
    loading: string
    latestVersion: string
    noRelease: string
    fallbackPrefix: string
    fallbackSuffix: string
    ossLabel: string
    githubLabel: string
    history: string
    cnMirrorBtn: string
    cnMirrorTitle: string
    githubBtn: string
    githubBtnTitle: string
    th: { platform: string; arch: string; format: string; desc: string; download: string }
    rowLabels: Record<MatrixRowKey, string>
    formats: { exeSetup: string; exePortable: string }
    downloadLink: string
    errorTpl: (src: string, err: string, link: string) => string
    tipOss: string
    tipGithub: string
  }
  lightbox: { close: string }
}

const ZH_FEATURES: ComponentLabels['features'] = [
  { icon: '🧰', title: '15+ 实用工具', desc: 'JSON/XML/YAML 格式化、Base64、进制转换、正则测试、UUID、随机密码、二维码、时间戳、Cron、颜色工具……持续增加中。' },
  { icon: '🤖', title: '内置 AI 助手', desc: '支持 Claude、OpenAI、DeepSeek、Grok、Ollama 本地模型等 6 种服务商，任意工具页一键唤出，对话历史本地保存。' },
  { icon: '🖥️', title: '真正跨平台', desc: '基于 Electron + Vue3，Windows / macOS / Linux 三端一致体验，深色浅色主题，中英双语。' },
  { icon: '🔓', title: '开源免费', desc: 'MIT 协议，代码完全开放。数据全部存在本地 SQLite，不上传任何内容。' },
]

const EN_FEATURES: ComponentLabels['features'] = [
  { icon: '🧰', title: '15+ Tools', desc: 'JSON/XML/YAML formatter, Base64, number-base converter, regex tester, UUID, password generator, QR code, timestamp, Cron, color tools… and growing.' },
  { icon: '🤖', title: 'Built-in AI Assistant', desc: 'Claude, OpenAI, DeepSeek, Grok, Ollama and more — 6 providers supported. Invoke from any tool page; chat history stored locally.' },
  { icon: '🖥️', title: 'Truly Cross-Platform', desc: 'Electron + Vue3. Consistent experience on Windows, macOS and Linux. Dark/light theme, Chinese/English UI.' },
  { icon: '🔓', title: 'Open Source & Free', desc: 'MIT license. Fully open codebase. All data lives in a local SQLite file — nothing is uploaded anywhere.' },
]

const ES_FEATURES: ComponentLabels['features'] = [
  { icon: '🧰', title: '15+ herramientas', desc: 'Formateador JSON/XML/YAML, Base64, conversor de bases, regex, UUID, generador de contraseñas, QR, timestamp, Cron, colores… y más.' },
  { icon: '🤖', title: 'Asistente IA integrado', desc: 'Compatible con Claude, OpenAI, DeepSeek, Grok, Ollama y más. Invócalo desde cualquier herramienta; historial guardado localmente.' },
  { icon: '🖥️', title: 'Multiplataforma real', desc: 'Electron + Vue3. Experiencia uniforme en Windows, macOS y Linux. Temas claro/oscuro, UI en chino e inglés.' },
  { icon: '🔓', title: 'Código abierto y gratis', desc: 'Licencia MIT. Código completamente abierto. Todos los datos se guardan en SQLite local, sin subidas.' },
]

const FR_FEATURES: ComponentLabels['features'] = [
  { icon: '🧰', title: '15+ outils', desc: 'Formateur JSON/XML/YAML, Base64, convertisseur de bases, regex, UUID, générateur de mots de passe, QR code, horodatage, Cron, couleurs… et plus.' },
  { icon: '🤖', title: 'Assistant IA intégré', desc: 'Claude, OpenAI, DeepSeek, Grok, Ollama et plus — 6 fournisseurs. Invoquez-le depuis n\'importe quel outil ; historique sauvegardé localement.' },
  { icon: '🖥️', title: 'Vraiment multiplateforme', desc: 'Electron + Vue3. Expérience uniforme sous Windows, macOS et Linux. Thème clair/sombre, interface en chinois et anglais.' },
  { icon: '🔓', title: 'Open source et gratuit', desc: 'Licence MIT. Code entièrement ouvert. Toutes les données restent dans un fichier SQLite local — rien n\'est envoyé.' },
]

const JA_FEATURES: ComponentLabels['features'] = [
  { icon: '🧰', title: '15+ ツール', desc: 'JSON/XML/YAML フォーマッタ、Base64、進数変換、正規表現テスト、UUID、パスワード生成、QR コード、タイムスタンプ、Cron、カラーツール… 増加中。' },
  { icon: '🤖', title: 'AI アシスタント内蔵', desc: 'Claude・OpenAI・DeepSeek・Grok・Ollama など 6 プロバイダ対応。任意のツール画面から呼び出し可。履歴はローカル保存。' },
  { icon: '🖥️', title: '真のクロスプラットフォーム', desc: 'Electron + Vue3 製。Windows / macOS / Linux で同一体験。ダーク/ライトテーマ、日本語 UI（近日対応予定）。' },
  { icon: '🔓', title: 'オープンソース & 無料', desc: 'MIT ライセンス。コード完全公開。データはすべてローカル SQLite に保存。アップロード一切なし。' },
]

const KO_FEATURES: ComponentLabels['features'] = [
  { icon: '🧰', title: '15+ 도구', desc: 'JSON/XML/YAML 포맷터, Base64, 진수 변환, 정규식 테스트, UUID, 비밀번호 생성기, QR 코드, 타임스탬프, Cron, 색상 도구… 계속 추가 중.' },
  { icon: '🤖', title: 'AI 어시스턴트 내장', desc: 'Claude, OpenAI, DeepSeek, Grok, Ollama 등 6개 공급자 지원. 모든 도구 페이지에서 호출 가능. 대화 기록은 로컬 저장.' },
  { icon: '🖥️', title: '진정한 크로스플랫폼', desc: 'Electron + Vue3. Windows / macOS / Linux 동일 경험. 다크/라이트 테마, 중영 UI.' },
  { icon: '🔓', title: '오픈소스 & 무료', desc: 'MIT 라이선스. 코드 완전 공개. 모든 데이터는 로컬 SQLite 저장 — 어디에도 업로드 안 함.' },
]

const PT_FEATURES: ComponentLabels['features'] = [
  { icon: '🧰', title: '15+ ferramentas', desc: 'Formatador JSON/XML/YAML, Base64, conversor de bases, regex, UUID, gerador de senhas, QR code, timestamp, Cron, cores… e crescendo.' },
  { icon: '🤖', title: 'Assistente IA integrado', desc: 'Claude, OpenAI, DeepSeek, Grok, Ollama e mais — 6 provedores. Invoque de qualquer ferramenta; histórico salvo localmente.' },
  { icon: '🖥️', title: 'Verdadeiramente multiplataforma', desc: 'Electron + Vue3. Experiência uniforme em Windows, macOS e Linux. Tema claro/escuro, interface em chinês e inglês.' },
  { icon: '🔓', title: 'Código aberto e gratuito', desc: 'Licença MIT. Código completamente aberto. Todos os dados ficam no SQLite local — nada é enviado para servidores.' },
]

const COMPONENT_LABELS: Record<string, ComponentLabels> = {
  'zh-CN': {
    features: ZH_FEATURES,
    download: {
      platforms: { macos: 'macOS', windows: 'Windows', linux: 'Linux', unknown: '所有平台' },
      currentPlatform: '当前平台',
      seeAll: '查看所有下载',
      download: (label) => `下载(${label})`,
      cnMirror: '· 🌐 GitHub',
      githubSrc: '· 🌐 GitHub',
      cnTip: '下载来自 GitHub Releases',
      intlTip: '下载来自 GitHub Releases',
    },
    matrix: {
      loading: '加载中…',
      latestVersion: '最新版本：',
      noRelease: '暂无版本，敬请期待。可 <a href="https://github.com/duhbbx/lele-tools-electron/releases" target="_blank" rel="noopener">关注 GitHub Releases</a> 获取更新。',
      fallbackPrefix: '前往 ',
      fallbackSuffix: ' 下载',
      ossLabel: 'GitHub Releases',
      githubLabel: 'GitHub Releases',
      history: '历史版本 →',
      cnMirrorBtn: '🌐 GitHub',
      cnMirrorTitle: 'GitHub Releases',
      githubBtn: '🌐 GitHub',
      githubBtnTitle: 'GitHub Releases',
      th: { platform: '平台', arch: '架构', format: '格式', desc: '说明', download: '下载' },
      rowLabels: {
        macArm: 'macOS (Apple Silicon + Rosetta)',
        winInstaller: 'Windows 64 位安装包',
        winInstallerArm: 'Windows ARM64 安装包',
        winPortable: 'Windows 64 位免安装',
        winPortableArm: 'Windows ARM64 免安装',
        linuxAppimage: 'Linux x64',
        linuxDeb: 'Debian / Ubuntu',
        linuxRpm: 'Fedora / openEuler',
        linuxPacman: 'Arch / Manjaro',
        linuxAppimageArm: 'Linux ARM64',
        linuxTarGz: 'Linux x64 (tar.gz)',
      },
      formats: { exeSetup: '.exe (安装版)', exePortable: '.exe (绿色版)' },
      downloadLink: '下载',
      errorTpl: (_src, err, link) =>
        `加载失败(${err})，可前往 ${link} 手动下载。`,
      tipOss: '💡 发布包托管于 GitHub Releases。中国大陆访问慢时，可尝试使用加速代理。',
      tipGithub: '💡 发布包托管于 GitHub Releases。中国大陆访问慢时，可尝试使用加速代理如 https://github.akams.cn/。',
    },
    lightbox: { close: '关闭' },
  },

  'en-US': {
    features: EN_FEATURES,
    download: {
      platforms: { macos: 'macOS', windows: 'Windows', linux: 'Linux', unknown: 'All platforms' },
      currentPlatform: 'Current platform',
      seeAll: 'See all downloads',
      download: (label) => `Download (${label})`,
      cnMirror: '· 🌐 GitHub',
      githubSrc: '· 🌐 GitHub',
      cnTip: 'Downloads are hosted on GitHub Releases',
      intlTip: 'Downloads are hosted on GitHub Releases',
    },
    matrix: {
      loading: 'Loading…',
      latestVersion: 'Latest version:',
      noRelease: 'No releases yet. Watch <a href="https://github.com/duhbbx/lele-tools-electron/releases" target="_blank" rel="noopener">GitHub Releases</a> for updates.',
      fallbackPrefix: 'Go to ',
      fallbackSuffix: ' to download',
      ossLabel: 'GitHub Releases',
      githubLabel: 'GitHub Releases',
      history: 'All versions →',
      cnMirrorBtn: '🌐 GitHub',
      cnMirrorTitle: 'GitHub Releases',
      githubBtn: '🌐 GitHub',
      githubBtnTitle: 'GitHub Releases',
      th: { platform: 'Platform', arch: 'Arch', format: 'Format', desc: 'Notes', download: 'Download' },
      rowLabels: {
        macArm: 'macOS (Apple Silicon + Rosetta)',
        winInstaller: 'Windows 64-bit installer',
        winInstallerArm: 'Windows ARM64 installer',
        winPortable: 'Windows 64-bit portable',
        winPortableArm: 'Windows ARM64 portable',
        linuxAppimage: 'Linux x64',
        linuxDeb: 'Debian / Ubuntu',
        linuxRpm: 'Fedora / openEuler',
        linuxPacman: 'Arch / Manjaro',
        linuxAppimageArm: 'Linux ARM64',
        linuxTarGz: 'Linux x64 (tar.gz)',
      },
      formats: { exeSetup: '.exe (installer)', exePortable: '.exe (portable)' },
      downloadLink: 'Download',
      errorTpl: (_src, err, link) =>
        `Failed to load releases (${err}). Visit ${link} to download manually.`,
      tipOss: '💡 Releases are hosted on GitHub Releases.',
      tipGithub: '💡 Releases are hosted on GitHub Releases.',
    },
    lightbox: { close: 'Close' },
  },

  'es-ES': {
    features: ES_FEATURES,
    download: {
      platforms: { macos: 'macOS', windows: 'Windows', linux: 'Linux', unknown: 'Todas las plataformas' },
      currentPlatform: 'Plataforma actual',
      seeAll: 'Ver todas las descargas',
      download: (label) => `Descargar (${label})`,
      cnMirror: '· 🌐 GitHub',
      githubSrc: '· 🌐 GitHub',
      cnTip: 'Descargas alojadas en GitHub Releases',
      intlTip: 'Descargas alojadas en GitHub Releases',
    },
    matrix: {
      loading: 'Cargando…',
      latestVersion: 'Última versión:',
      noRelease: 'Aún no hay versiones. Sigue <a href="https://github.com/duhbbx/lele-tools-electron/releases" target="_blank" rel="noopener">GitHub Releases</a> para actualizaciones.',
      fallbackPrefix: 'Ir a ',
      fallbackSuffix: ' para descargar',
      ossLabel: 'GitHub Releases',
      githubLabel: 'GitHub Releases',
      history: 'Todas las versiones →',
      cnMirrorBtn: '🌐 GitHub',
      cnMirrorTitle: 'GitHub Releases',
      githubBtn: '🌐 GitHub',
      githubBtnTitle: 'GitHub Releases',
      th: { platform: 'Plataforma', arch: 'Arq.', format: 'Formato', desc: 'Notas', download: 'Descarga' },
      rowLabels: {
        macArm: 'macOS (Apple Silicon + Rosetta)',
        winInstaller: 'Instalador Windows 64-bit',
        winInstallerArm: 'Instalador Windows ARM64',
        winPortable: 'Windows 64-bit portable',
        winPortableArm: 'Windows ARM64 portable',
        linuxAppimage: 'Linux x64',
        linuxDeb: 'Debian / Ubuntu',
        linuxRpm: 'Fedora / openEuler',
        linuxPacman: 'Arch / Manjaro',
        linuxAppimageArm: 'Linux ARM64',
        linuxTarGz: 'Linux x64 (tar.gz)',
      },
      formats: { exeSetup: '.exe (instalador)', exePortable: '.exe (portable)' },
      downloadLink: 'Descargar',
      errorTpl: (_src, err, link) => `Error al cargar (${err}). Ve a ${link} para descargar manualmente.`,
      tipOss: '💡 Las versiones están alojadas en GitHub Releases.',
      tipGithub: '💡 Las versiones están alojadas en GitHub Releases.',
    },
    lightbox: { close: 'Cerrar' },
  },

  'fr-FR': {
    features: FR_FEATURES,
    download: {
      platforms: { macos: 'macOS', windows: 'Windows', linux: 'Linux', unknown: 'Toutes plateformes' },
      currentPlatform: 'Plateforme actuelle',
      seeAll: 'Voir tous les téléchargements',
      download: (label) => `Télécharger (${label})`,
      cnMirror: '· 🌐 GitHub',
      githubSrc: '· 🌐 GitHub',
      cnTip: 'Téléchargements hébergés sur GitHub Releases',
      intlTip: 'Téléchargements hébergés sur GitHub Releases',
    },
    matrix: {
      loading: 'Chargement…',
      latestVersion: 'Dernière version :',
      noRelease: 'Aucune version disponible. Suivez <a href="https://github.com/duhbbx/lele-tools-electron/releases" target="_blank" rel="noopener">GitHub Releases</a> pour les mises à jour.',
      fallbackPrefix: 'Aller sur ',
      fallbackSuffix: ' pour télécharger',
      ossLabel: 'GitHub Releases',
      githubLabel: 'GitHub Releases',
      history: 'Toutes les versions →',
      cnMirrorBtn: '🌐 GitHub',
      cnMirrorTitle: 'GitHub Releases',
      githubBtn: '🌐 GitHub',
      githubBtnTitle: 'GitHub Releases',
      th: { platform: 'Plateforme', arch: 'Arch.', format: 'Format', desc: 'Notes', download: 'Télécharger' },
      rowLabels: {
        macArm: 'macOS (Apple Silicon + Rosetta)',
        winInstaller: 'Installateur Windows 64 bits',
        winInstallerArm: 'Installateur Windows ARM64',
        winPortable: 'Windows 64 bits portable',
        winPortableArm: 'Windows ARM64 portable',
        linuxAppimage: 'Linux x64',
        linuxDeb: 'Debian / Ubuntu',
        linuxRpm: 'Fedora / openEuler',
        linuxPacman: 'Arch / Manjaro',
        linuxAppimageArm: 'Linux ARM64',
        linuxTarGz: 'Linux x64 (tar.gz)',
      },
      formats: { exeSetup: '.exe (installateur)', exePortable: '.exe (portable)' },
      downloadLink: 'Télécharger',
      errorTpl: (_src, err, link) => `Échec du chargement (${err}). Allez sur ${link} pour télécharger manuellement.`,
      tipOss: '💡 Les versions sont hébergées sur GitHub Releases.',
      tipGithub: '💡 Les versions sont hébergées sur GitHub Releases.',
    },
    lightbox: { close: 'Fermer' },
  },

  'ja-JP': {
    features: JA_FEATURES,
    download: {
      platforms: { macos: 'macOS', windows: 'Windows', linux: 'Linux', unknown: 'すべて' },
      currentPlatform: '現在のプラットフォーム',
      seeAll: 'すべてのダウンロードを見る',
      download: (label) => `ダウンロード(${label})`,
      cnMirror: '· 🌐 GitHub',
      githubSrc: '· 🌐 GitHub',
      cnTip: 'ダウンロードは GitHub Releases でホスト',
      intlTip: 'ダウンロードは GitHub Releases でホスト',
    },
    matrix: {
      loading: '読み込み中…',
      latestVersion: '最新バージョン:',
      noRelease: 'まだリリースはありません。<a href="https://github.com/duhbbx/lele-tools-electron/releases" target="_blank" rel="noopener">GitHub Releases</a> をフォローしてください。',
      fallbackPrefix: '',
      fallbackSuffix: ' からダウンロード',
      ossLabel: 'GitHub Releases',
      githubLabel: 'GitHub Releases',
      history: '過去のバージョン →',
      cnMirrorBtn: '🌐 GitHub',
      cnMirrorTitle: 'GitHub Releases',
      githubBtn: '🌐 GitHub',
      githubBtnTitle: 'GitHub Releases',
      th: { platform: 'プラットフォーム', arch: 'アーキ', format: 'フォーマット', desc: '備考', download: 'ダウンロード' },
      rowLabels: {
        macArm: 'macOS (Apple Silicon + Rosetta)',
        winInstaller: 'Windows 64-bit インストーラ',
        winInstallerArm: 'Windows ARM64 インストーラ',
        winPortable: 'Windows 64-bit ポータブル',
        winPortableArm: 'Windows ARM64 ポータブル',
        linuxAppimage: 'Linux x64',
        linuxDeb: 'Debian / Ubuntu',
        linuxRpm: 'Fedora / openEuler',
        linuxPacman: 'Arch / Manjaro',
        linuxAppimageArm: 'Linux ARM64',
        linuxTarGz: 'Linux x64 (tar.gz)',
      },
      formats: { exeSetup: '.exe (インストーラ)', exePortable: '.exe (ポータブル)' },
      downloadLink: 'ダウンロード',
      errorTpl: (_src, err, link) => `読み込み失敗 (${err})。${link} から手動でダウンロードしてください。`,
      tipOss: '💡 リリースは GitHub Releases でホストされています。',
      tipGithub: '💡 リリースは GitHub Releases でホストされています。',
    },
    lightbox: { close: '閉じる' },
  },

  'ko-KR': {
    features: KO_FEATURES,
    download: {
      platforms: { macos: 'macOS', windows: 'Windows', linux: 'Linux', unknown: '모든 플랫폼' },
      currentPlatform: '현재 플랫폼',
      seeAll: '모든 다운로드 보기',
      download: (label) => `다운로드(${label})`,
      cnMirror: '· 🌐 GitHub',
      githubSrc: '· 🌐 GitHub',
      cnTip: '다운로드는 GitHub Releases 에서 제공',
      intlTip: '다운로드는 GitHub Releases 에서 제공',
    },
    matrix: {
      loading: '로딩 중…',
      latestVersion: '최신 버전:',
      noRelease: '아직 릴리스가 없습니다. <a href="https://github.com/duhbbx/lele-tools-electron/releases" target="_blank" rel="noopener">GitHub Releases</a> 를 팔로우하세요.',
      fallbackPrefix: '',
      fallbackSuffix: ' 에서 다운로드',
      ossLabel: 'GitHub Releases',
      githubLabel: 'GitHub Releases',
      history: '이전 버전 →',
      cnMirrorBtn: '🌐 GitHub',
      cnMirrorTitle: 'GitHub Releases',
      githubBtn: '🌐 GitHub',
      githubBtnTitle: 'GitHub Releases',
      th: { platform: '플랫폼', arch: '아키', format: '포맷', desc: '비고', download: '다운로드' },
      rowLabels: {
        macArm: 'macOS (Apple Silicon + Rosetta)',
        winInstaller: 'Windows 64-bit 인스톨러',
        winInstallerArm: 'Windows ARM64 인스톨러',
        winPortable: 'Windows 64-bit 포터블',
        winPortableArm: 'Windows ARM64 포터블',
        linuxAppimage: 'Linux x64',
        linuxDeb: 'Debian / Ubuntu',
        linuxRpm: 'Fedora / openEuler',
        linuxPacman: 'Arch / Manjaro',
        linuxAppimageArm: 'Linux ARM64',
        linuxTarGz: 'Linux x64 (tar.gz)',
      },
      formats: { exeSetup: '.exe (인스톨러)', exePortable: '.exe (포터블)' },
      downloadLink: '다운로드',
      errorTpl: (_src, err, link) => `로드 실패 (${err}). ${link} 에서 직접 다운로드하세요.`,
      tipOss: '💡 릴리스는 GitHub Releases 에서 제공됩니다.',
      tipGithub: '💡 릴리스는 GitHub Releases 에서 제공됩니다.',
    },
    lightbox: { close: '닫기' },
  },

  'pt-BR': {
    features: PT_FEATURES,
    download: {
      platforms: { macos: 'macOS', windows: 'Windows', linux: 'Linux', unknown: 'Todas as plataformas' },
      currentPlatform: 'Plataforma atual',
      seeAll: 'Ver todos os downloads',
      download: (label) => `Baixar (${label})`,
      cnMirror: '· 🌐 GitHub',
      githubSrc: '· 🌐 GitHub',
      cnTip: 'Downloads hospedados no GitHub Releases',
      intlTip: 'Downloads hospedados no GitHub Releases',
    },
    matrix: {
      loading: 'Carregando…',
      latestVersion: 'Última versão:',
      noRelease: 'Nenhuma versão disponível ainda. Acompanhe o <a href="https://github.com/duhbbx/lele-tools-electron/releases" target="_blank" rel="noopener">GitHub Releases</a> para atualizações.',
      fallbackPrefix: 'Ir para ',
      fallbackSuffix: ' para baixar',
      ossLabel: 'GitHub Releases',
      githubLabel: 'GitHub Releases',
      history: 'Todas as versões →',
      cnMirrorBtn: '🌐 GitHub',
      cnMirrorTitle: 'GitHub Releases',
      githubBtn: '🌐 GitHub',
      githubBtnTitle: 'GitHub Releases',
      th: { platform: 'Plataforma', arch: 'Arq.', format: 'Formato', desc: 'Notas', download: 'Baixar' },
      rowLabels: {
        macArm: 'macOS (Apple Silicon + Rosetta)',
        winInstaller: 'Instalador Windows 64-bit',
        winInstallerArm: 'Instalador Windows ARM64',
        winPortable: 'Windows 64-bit portátil',
        winPortableArm: 'Windows ARM64 portátil',
        linuxAppimage: 'Linux x64',
        linuxDeb: 'Debian / Ubuntu',
        linuxRpm: 'Fedora / openEuler',
        linuxPacman: 'Arch / Manjaro',
        linuxAppimageArm: 'Linux ARM64',
        linuxTarGz: 'Linux x64 (tar.gz)',
      },
      formats: { exeSetup: '.exe (instalador)', exePortable: '.exe (portátil)' },
      downloadLink: 'Baixar',
      errorTpl: (_src, err, link) => `Falha ao carregar (${err}). Vá a ${link} para baixar manualmente.`,
      tipOss: '💡 As versões estão hospedadas no GitHub Releases.',
      tipGithub: '💡 As versões estão hospedadas no GitHub Releases.',
    },
    lightbox: { close: 'Fechar' },
  },
}

export function getComponentLabels(lang: string): ComponentLabels {
  return COMPONENT_LABELS[lang] ?? COMPONENT_LABELS['zh-CN']
}
