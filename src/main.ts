import { createApp } from 'vue'
import App from './App.vue'
import { appLocale, i18n, setAppLocale } from './i18n.ts'
import './style.css'

setAppLocale(appLocale.value)
createApp(App).use(i18n).mount('#app')
