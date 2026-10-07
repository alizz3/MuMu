import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`          → build normal para Vercel (dist/)
// `npm run build:preview`  → un solo HTML autocontenido (dist-preview/) para vista previa en modo local
export default defineConfig(({ mode }) => ({
  plugins: mode === 'preview' ? [vue(), viteSingleFile()] : [vue()],
  build: { outDir: mode === 'preview' ? 'dist-preview' : 'dist' },
  server: { proxy: { '/api': 'http://localhost:3000' } },
}))
