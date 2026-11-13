import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from './router'
import './assets/styles/main.css'
import { useAuthStore } from '@/stores/auth'
import { setUnauthorizedHandler } from '@/utils/request'

const pinia = createPinia()
setUnauthorizedHandler(() => {
  useAuthStore(pinia).clearSession()
  const current = router.currentRoute.value
  if (current.meta.requiresAuth)
    void router.replace({
      path: '/login',
      query: { redirect: current.fullPath, reason: 'expired' },
    })
})

// 切回已打开的业务页面时重查凭证，感知其他设备的密码重置。
window.addEventListener('focus', () => {
  if (router.currentRoute.value.meta.requiresAuth) {
    void useAuthStore(pinia)
      .restoreSession(true)
      .then((session) => {
        const current = router.currentRoute.value
        if (!session && current.meta.requiresAuth)
          void router.replace({
            path: '/login',
            query: { redirect: current.fullPath, reason: 'expired' },
          })
      })
      .catch(() => {
        /* 网络中断留给下一次操作反馈。 */
      })
  }
})
createApp(App).use(pinia).use(router).mount('#app')
