import { defineConfig } from 'vitepress'
import { EN, ES, FR, JA, KO, LOCALE_META, PT, ZH, makeLocaleHead, makeThemeConfig } from './i18n'

/**
 * 乐乐的工具箱官网配置。
 *
 * - 中文为默认 locale（根路径 /）
 * - 6 个其它语言：/en/ /es/ /fr/ /ja/ /ko/ /pt/
 * - 部署到 https://lele.skyler.uno
 *
 * 各语言 markdown 放在对应子目录，nav/sidebar 标签在 .vitepress/i18n.ts 中统一管理。
 */
const SITE_HOSTNAME = 'https://lele.skyler.uno'
const LOCALE_PREFIXES: Array<[string, string]> = [
  ['zh-CN', ''],
  ['en-US', '/en'],
  ['es-ES', '/es'],
  ['fr-FR', '/fr'],
  ['ja-JP', '/ja'],
  ['ko-KR', '/ko'],
  ['pt-BR', '/pt'],
]

export default defineConfig({
  title: '乐乐的工具箱',
  // 默认(中文)description；各 locale 自带 description override
  description: LOCALE_META['zh-CN'].description,
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  appearance: 'dark',

  // 自动生成 sitemap.xml(每次 build 时)；Google / Bing / 百度 站长可直接提交
  sitemap: {
    hostname: SITE_HOSTNAME,
    transformItems: (items) => {
      // 加 lastmod；部分搜索引擎用来判定页面新鲜度
      const now = new Date().toISOString()
      return items.map((it) => ({ ...it, lastmod: now }))
    },
  },

  // 每页注入 canonical + hreflang + JSON-LD，让搜索引擎清楚多语言对应关系
  transformHead: ({ pageData }) => {
    const tags: Array<[string, Record<string, string>]> = []
    // 取当前页相对路径(去掉 locale 前缀，以便给所有 locale 拼 alternate)
    const relPath = pageData.relativePath.replace(/\.md$/, '').replace(/\/index$/, '/')
    // 找当前 locale 前缀
    let currentPrefix = ''
    let restPath = relPath
    for (const [, pfx] of LOCALE_PREFIXES) {
      if (pfx && (relPath === pfx.slice(1) || relPath.startsWith(`${pfx.slice(1)}/`))) {
        currentPrefix = pfx
        restPath = relPath.slice(pfx.length - 0)
        if (restPath.startsWith('/')) restPath = restPath.slice(1)
        break
      }
    }
    // 干净路径(无 locale 前缀，无 index)
    const cleanPath = restPath.replace(/^index$/, '')

    // canonical(当前 locale 自身)
    tags.push([
      'link',
      { rel: 'canonical', href: `${SITE_HOSTNAME}${currentPrefix}/${cleanPath}`.replace(/\/+$/, '/') },
    ])
    // hreflang alternate — 所有 7 个 locale
    for (const [lang, pfx] of LOCALE_PREFIXES) {
      tags.push([
        'link',
        {
          rel: 'alternate',
          hreflang: lang.replace('-', '_').slice(0, 2),
          href: `${SITE_HOSTNAME}${pfx}/${cleanPath}`.replace(/\/+$/, '/'),
        },
      ])
    }
    // x-default 指向英文版(国际默认)
    tags.push([
      'link',
      { rel: 'alternate', hreflang: 'x-default', href: `${SITE_HOSTNAME}/en/${cleanPath}`.replace(/\/+$/, '/') },
    ])
    return tags
  },

  head: (() => {
    // 全局 head：跨 locale 共享(图标 / theme-color / OG image / Twitter Card / Umami)。
    // 每个 locale 自己的 description / og:title / og:description 在 locales[*].head 注入。
    const base: Array<[string, Record<string, string>] | [string, Record<string, string>, string]> = [
      ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
      ['meta', { name: 'theme-color', content: '#7c6cff' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: '乐乐的工具箱' }],
      ['meta', { property: 'og:url', content: SITE_HOSTNAME }],
      ['meta', { property: 'og:image', content: `${SITE_HOSTNAME}/og.png` }],
      ['meta', { property: 'og:image:width', content: '2000' }],
      ['meta', { property: 'og:image:height', content: '1126' }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:image', content: `${SITE_HOSTNAME}/og.png` }],
      // Schema.org SoftwareApplication 结构化数据 — Google 可能在搜索结果显示富片段
      [
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Lele Tools',
          alternateName: '乐乐的工具箱',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'macOS, Windows, Linux',
          description: LOCALE_META['en-US'].description,
          url: SITE_HOSTNAME,
          downloadUrl: 'https://github.com/duhbbx/lele-tools-electron/releases',
          softwareVersion: 'latest',
          license: 'https://opensource.org/licenses/MIT',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          author: {
            '@type': 'Person',
            name: 'duhbbx',
            url: 'https://github.com/duhbbx',
          },
        }),
      ],
    ]
    if (process.env.UMAMI_WEBSITE_ID) {
      base.push([
        'script',
        {
          defer: '',
          src: 'https://umami.skyler.uno/script.js',
          'data-website-id': process.env.UMAMI_WEBSITE_ID,
        },
      ])
    }
    // 搜索引擎站长验证(env 注入，不存在就跳过)
    if (process.env.GOOGLE_SITE_VERIFICATION) {
      base.push(['meta', { name: 'google-site-verification', content: process.env.GOOGLE_SITE_VERIFICATION }])
    }
    if (process.env.BING_SITE_VERIFICATION) {
      base.push(['meta', { name: 'msvalidate.01', content: process.env.BING_SITE_VERIFICATION }])
    }
    if (process.env.BAIDU_SITE_VERIFICATION) {
      base.push(['meta', { name: 'baidu-site-verification', content: process.env.BAIDU_SITE_VERIFICATION }])
    }
    if (process.env.YANDEX_SITE_VERIFICATION) {
      base.push(['meta', { name: 'yandex-verification', content: process.env.YANDEX_SITE_VERIFICATION }])
    }
    if (process.env.QIHOO_360_VERIFICATION) {
      base.push(['meta', { name: '360-site-verification', content: process.env.QIHOO_360_VERIFICATION }])
    }
    return base
  })(),

  locales: {
    root: {
      label: ZH.label,
      lang: ZH.lang,
      description: ZH.description,
      head: makeLocaleHead('zh-CN'),
      themeConfig: makeThemeConfig('zh-CN', ''),
    },
    en: {
      label: EN.label,
      lang: EN.lang,
      description: EN.description,
      head: makeLocaleHead('en-US'),
      themeConfig: makeThemeConfig('en-US', '/en'),
    },
    es: {
      label: ES.label,
      lang: ES.lang,
      description: ES.description,
      head: makeLocaleHead('es-ES'),
      themeConfig: makeThemeConfig('es-ES', '/es'),
    },
    fr: {
      label: FR.label,
      lang: FR.lang,
      description: FR.description,
      head: makeLocaleHead('fr-FR'),
      themeConfig: makeThemeConfig('fr-FR', '/fr'),
    },
    ja: {
      label: JA.label,
      lang: JA.lang,
      description: JA.description,
      head: makeLocaleHead('ja-JP'),
      themeConfig: makeThemeConfig('ja-JP', '/ja'),
    },
    ko: {
      label: KO.label,
      lang: KO.lang,
      description: KO.description,
      head: makeLocaleHead('ko-KR'),
      themeConfig: makeThemeConfig('ko-KR', '/ko'),
    },
    pt: {
      label: PT.label,
      lang: PT.lang,
      description: PT.description,
      head: makeLocaleHead('pt-BR'),
      themeConfig: makeThemeConfig('pt-BR', '/pt'),
    },
  },

  themeConfig: {
    // 顶层 themeConfig 主要给 logo / socialLinks / search 等"全局"项；
    // 各 locale 的 nav / sidebar / footer / docFooter 由 locales[*].themeConfig 覆盖。
    logo: '/logo.png',
    socialLinks: [{ icon: 'github', link: 'https://github.com/duhbbx/lele-tools-electron' }],
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索' },
              modal: {
                noResultsText: '无匹配结果',
                resetButtonTitle: '重置',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
              },
            },
          },
          en: {
            translations: {
              button: { buttonText: 'Search', buttonAriaLabel: 'Search' },
              modal: {
                noResultsText: 'No matches',
                resetButtonTitle: 'Reset',
                footer: { selectText: 'to select', navigateText: 'to navigate', closeText: 'to close' },
              },
            },
          },
          es: {
            translations: {
              button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
              modal: {
                noResultsText: 'Sin resultados',
                resetButtonTitle: 'Reiniciar',
                footer: { selectText: 'seleccionar', navigateText: 'navegar', closeText: 'cerrar' },
              },
            },
          },
          fr: {
            translations: {
              button: { buttonText: 'Rechercher', buttonAriaLabel: 'Rechercher' },
              modal: {
                noResultsText: 'Aucun résultat',
                resetButtonTitle: 'Réinitialiser',
                footer: { selectText: 'sélectionner', navigateText: 'naviguer', closeText: 'fermer' },
              },
            },
          },
          ja: {
            translations: {
              button: { buttonText: '検索', buttonAriaLabel: '検索' },
              modal: {
                noResultsText: '一致する結果がありません',
                resetButtonTitle: 'リセット',
                footer: { selectText: '選択', navigateText: '移動', closeText: '閉じる' },
              },
            },
          },
          ko: {
            translations: {
              button: { buttonText: '검색', buttonAriaLabel: '검색' },
              modal: {
                noResultsText: '검색 결과 없음',
                resetButtonTitle: '초기화',
                footer: { selectText: '선택', navigateText: '이동', closeText: '닫기' },
              },
            },
          },
          pt: {
            translations: {
              button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
              modal: {
                noResultsText: 'Nenhum resultado',
                resetButtonTitle: 'Limpar',
                footer: { selectText: 'selecionar', navigateText: 'navegar', closeText: 'fechar' },
              },
            },
          },
        },
      },
    },
  },
})
