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
      meta: { requiresAuth: true, title: '发现手作' },
    },
    { path: '/account/favorites', component: () => import('@/views/SavedInteractionsView.vue'), meta: { requiresAuth: true, title: '收藏作品' } },
    { path: '/account/following', component: () => import('@/views/SavedInteractionsView.vue'), meta: { requiresAuth: true, title: '关注创作者' } },
    { path: '/works/:id', component: () => import('@/views/WorkDetailView.vue'), meta: { requiresAuth: true, title: '作品详情' } },
    { path: '/creators/:id', component: () => import('@/views/CreatorPublicView.vue'), meta: { requiresAuth: true, title: '创作者主页' } },
    { path: '/creator/works', component: () => import('@/views/MyWorksView.vue'), meta: { requiresAuth: true, requiresCreator: true, title: '我的作品' } },
    { path: '/creator/works/new', component: () => import('@/views/WorkEditorView.vue'), meta: { requiresAuth: true, requiresCreator: true, title: '发布作品' } },
    { path: '/creator/works/:id/edit', component: () => import('@/views/WorkEditorView.vue'), meta: { requiresAuth: true, requiresCreator: true, title: '编辑作品' } },
    { path: '/admin/works', component: () => import('@/views/AdminWorksView.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '作品审核' } },
    { path: '/admin/works/:id', component: () => import('@/views/AdminWorkReviewView.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '作品材料审核' } },
    {
      path: '/account/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      meta: { requiresAuth: true, title: '个人资料' },
    },
    {
      path: '/account/addresses',
      name: 'addresses',
      component: () => import('@/views/AddressesView.vue'),
      meta: { requiresAuth: true, title: '收货地址' },
    },
    {
      path: '/account/creator-certification',
      name: 'creator-certification',
      component: () => import('@/views/CreatorCertificationView.vue'),
      meta: { requiresAuth: true, title: '创作者入驻' },
    },
    {
      path: '/account/notifications',
      name: 'notifications',
      component: () => import('@/views/NotificationsView.vue'),
      meta: { requiresAuth: true, title: '系统通知' },
    },
    {
      path: '/admin/creator-applications',
      name: 'admin-creator-applications',
      component: () => import('@/views/AdminCreatorApplicationsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, title: '入驻审核' },
    },
    {
      path: '/admin/creator-applications/:id',
      name: 'admin-creator-review',
      component: () => import('@/views/AdminCreatorReviewView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, title: '入驻材料审核' },
    },
    {
      path: '/admin/categories',
      name: 'admin-categories',
      component: () => import('@/views/AdminCategoriesView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, title: '品类管理' },
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
  if (to.meta.requiresAdmin && !auth.session?.roles.includes('ADMIN')) return '/'
  if (to.meta.requiresCreator && !auth.session?.roles.includes('CREATOR')) return '/account/creator-certification'
  if (to.meta.guestOnly && auth.session) {
    const target = safeRedirect(to.query.redirect)
    return router.resolve(target).meta.requiresAuth ? target : '/'
  }
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title || '拾作')} · 拾作 SHIZUO`
})

export default router
