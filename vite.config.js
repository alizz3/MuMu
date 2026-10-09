import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

// `npm run build`          → build normal para Vercel (dist/), instalable como app (PWA)
// `npm run build:preview`  → un solo HTML autocontenido (dist-preview/) para vista previa en modo local
const pwa = VitePWA({
  registerType: 'prompt', // la app decide cuándo aplicar la versión nueva (sola, sin botón, cuando no estás en medio de algo)
  includeAssets: ['apple-touch-icon.png', 'favicon-32.png', 'og-mumu.jpg'],
  manifest: {
    name: 'MuMu',
    short_name: 'MuMu',
    description: 'Mi vida organizada, pero bonita: agenda, hábitos, universidad y la casita de la vaquita.',
    lang: 'es-CO',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#FCE4EC',
    background_color: '#FFF8F6',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,jpg,svg,webmanifest}'],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    navigateFallback: '/index.html',
    // Nunca guardar en caché la API ni Firebase: son datos vivos
    navigateFallbackDenylist: [/^\/api\//, /^\/privacidad/, /^\/terminos/, /^\/__\//],
    runtimeCaching: [
      { urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com', handler: 'StaleWhileRevalidate', options: { cacheName: 'fuentes' } },
    ],
  },
})

export default defineConfig(({ mode }) => ({
  plugins: mode === 'preview' ? [vue(), viteSingleFile()] : [vue(), pwa],
  build: { outDir: mode === 'preview' ? 'dist-preview' : 'dist' },
  resolve: mode === 'preview' ? { alias: { 'virtual:pwa-register': '/src/services/pwa-stub.js' } } : {},
  server: { proxy: { '/api': 'http://localhost:3000' } },
}))
