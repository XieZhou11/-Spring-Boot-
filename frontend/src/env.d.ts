/// <reference types="vite/client" />

// VITE_ 变量会写入浏览器构建产物，只放公开配置。
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}
