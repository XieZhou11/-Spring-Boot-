import { createRouter, createWebHistory } from 'vue-router'

// 暂只挂载空白首页，业务路由与访问控制随登录等功能实现。
export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
  ],
})
