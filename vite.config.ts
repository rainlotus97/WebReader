import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    port: 5173,
    host: true,
    headers: {
      'Content-Security-Policy': "frame-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;"
    }
  },
  build: {
    target: 'ES2020',
    outDir: 'dist'
  }
})
