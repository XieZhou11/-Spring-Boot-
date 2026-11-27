import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // 首次进入懒加载的收货地址页时，避免地区选择器触发依赖重载并中断导航。
  optimizeDeps: {
    include: [
      'element-plus/es/components/cascader/index',
      'element-plus/es/components/cascader/style/css',
      'element-china-area-data',
    ],
  },
  // 固定端口对应后端 CORS 白名单；不配置开发代理。
  server: { host: '127.0.0.1', port: 15173, strictPort: true },
  preview: { host: '127.0.0.1', port: 15173, strictPort: true },
})
