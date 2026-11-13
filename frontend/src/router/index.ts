import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { safeRedirect } from '@/utils/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true, title: '我的拾作' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guestOnly: true, title: '登录' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { guestOnly: true, title: '注册' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPasswordView.vue'),
      meta: { title: '找回密码' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

/** 业务页每次导航核验服务端身份，保留原目标的路径、查询及锚点。 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  try {
    await auth.restoreSession(Boolean(to.meta.requiresAuth))
  } catch {
    if (to.meta.requiresAuth) {
      auth.clearSession()
      return { path: '/login', query: { redirect: to.fullPath, reason: 'connection' } }
    }
  }
  if (to.meta.requiresAuth && !auth.session)
    return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.guestOnly && auth.session) {
    const target = safeRedirect(to.query.redirect)
    return router.resolve(target).meta.requiresAuth ? target : '/'
  }
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title || '拾作')} · 拾作 SHIZUO`
})

export default router
