import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import DownloadButton from '../components/DownloadButton.vue'
import DownloadMatrix from '../components/DownloadMatrix.vue'
import FeatureGrid from '../components/FeatureGrid.vue'
import Lightbox from '../components/Lightbox.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, { 'layout-bottom': () => h(Lightbox) })
  },
  enhanceApp({ app }) {
    app.component('DownloadButton', DownloadButton)
    app.component('DownloadMatrix', DownloadMatrix)
    app.component('FeatureGrid', FeatureGrid)
  },
} satisfies Theme
