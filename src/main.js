import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import { initSync } from './services/sync'

createApp(App).mount('#app')
initSync()
