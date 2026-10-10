import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import { initSync } from './services/sync'
import { initAndroidUso } from './services/androidUso'
import { initDevice } from './services/device'
import { initPWA } from './services/pwa'
import { initAnalytics } from './services/analytics'

createApp(App).mount('#app')
initSync()
initAndroidUso()
initDevice()
initPWA()
initAnalytics()
