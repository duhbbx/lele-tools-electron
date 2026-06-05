import '@lele/ui/styles.scss'
import { createApp } from 'vue'
import { initSettings } from '@lele/ui'
import App from './App.vue'

initSettings()
createApp(App).mount('#app')
