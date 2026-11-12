import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // 固定端口对应后端 CORS 白名单；不配置开发代理。
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
