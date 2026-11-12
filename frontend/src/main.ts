import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'
import './assets/styles/main.css'

// 统一注册路由和状态容器；页面及业务 store 按具体功能添加。
createApp(App).use(createPinia()).use(router).mount('#app')
