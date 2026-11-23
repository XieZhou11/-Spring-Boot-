import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { safeRedirect } from '@/utils/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      alias: '/discover',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true, title: '发现手作' },
    },
    { path: '/account/favorites', component: () => import('@/views/SavedInteractionsView.vue'), meta: { requiresAuth: true, title: '收藏作品' } },
    { path: '/account/following', component: () => import('@/views/SavedInteractionsView.vue'), meta: { requiresAuth: true, title: '关注创作者' } },
    { path: '/me/reports', component: () => import('@/views/MyReportsView.vue'), meta: { requiresAuth: true, title: '我的举报' } },
    { path: '/reports/:id', component: () => import('@/views/ContentReportDetailView.vue'), meta: { requiresAuth: true, title: '举报详情' } },
    { path: '/works/:id', component: () => import('@/views/WorkDetailView.vue'), meta: { requiresAuth: true, title: '作品详情' } },
    { path: '/creators/:id', component: () => import('@/views/CreatorPublicView.vue'), meta: { requiresAuth: true, title: '创作者主页' } },
    { path: '/requests', component: () => import('@/views/CustomRequestsView.vue'), props: { scope: 'hall' }, meta: { requiresAuth: true, requiresCreator: true, title: '需求大厅' } },
    { path: '/requests/:id', name: 'custom-request-detail', component: () => import('@/views/CustomRequestDetailView.vue'), meta: { requiresAuth: true, title: '需求详情' } },
    { path: '/requests/:id/quotes', name: 'quote-comparison', component: () => import('@/views/QuoteComparisonView.vue'), meta: { requiresAuth: true, title: '报价对比' } },
    { path: '/creator/quotes', component: () => import('@/views/MyQuotesView.vue'), meta: { requiresAuth: true, title: '我的报价' } },
    { path: '/creator/income', component: () => import('@/views/CreatorIncomeView.vue'), meta: { requiresAuth: true, title: '收入记录' } },
    { path: '/orders', component: () => import('@/views/OrdersView.vue'), meta: { requiresAuth: true, title: '我的订单' } },
    { path: '/orders/:id', name: 'order-detail', component: () => import('@/views/OrderDetailView.vue'), meta: { requiresAuth: true, title: '订单详情' } },
    { path: '/my-requests', component: () => import('@/views/CustomRequestsView.vue'), props: { scope: 'mine' }, meta: { requiresAuth: true, title: '我的需求' } },
    { path: '/my-requests/new', component: () => import('@/views/CustomRequestEditorView.vue'), meta: { requiresAuth: true, title: '发布定制需求' } },
    { path: '/my-requests/:id/edit', component: () => import('@/views/CustomRequestEditorView.vue'), meta: { requiresAuth: true, title: '编辑需求草稿' } },
    { path: '/creator/invitations', component: () => import('@/views/CustomRequestsView.vue'), props: { scope: 'invitations' }, meta: { requiresAuth: true, requiresCreator: true, title: '收到的定向邀约' } },
    { path: '/messages', redirect: '/messages/conversations' },
    { path: '/messages/conversations', component: () => import('@/views/ConversationsView.vue'), meta: { requiresAuth: true, title: '消息中心' }, children: [
      { path: ':id', component: () => import('@/views/ConversationDetailView.vue'), meta: { title: '需求沟通' } },
    ] },
    // 旧需求、会话和通知链接继续可用，完整保留筛选参数与页面锚点。
    { path: '/account/requests/:rest(.*)*', redirect: to => ({ path: to.path.replace('/account/requests', '/my-requests'), query: to.query, hash: to.hash }) },
    { path: '/account/conversations/:rest(.*)*', redirect: to => ({ path: to.path.replace('/account/conversations', '/messages/conversations'), query: to.query, hash: to.hash }) },
    { path: '/account/notifications', redirect: to => ({ path: '/messages/notifications', query: to.query, hash: to.hash }) },
    { path: '/creator/works', component: () => import('@/views/MyWorksView.vue'), meta: { requiresAuth: true, requiresCreator: true, title: '我的作品' } },
    { path: '/creator/works/new', component: () => import('@/views/WorkEditorView.vue'), meta: { requiresAuth: true, requiresCreator: true, title: '发布作品' } },
    { path: '/creator/works/:id/edit', component: () => import('@/views/WorkEditorView.vue'), meta: { requiresAuth: true, requiresCreator: true, title: '编辑作品' } },
    { path: '/admin', redirect: '/admin/dashboard' },
    { path: '/admin/dashboard', name: 'admin-dashboard', component: () => import('@/views/AdminDashboardView.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '数据看板' } },
    { path: '/admin/users', name: 'admin-users', component: () => import('@/views/AdminUsersView.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '用户管理' } },
    { path: '/admin/orders', name: 'admin-orders', component: () => import('@/views/AdminOrdersView.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '订单查询' } },
    { path: '/admin/refunds', name: 'admin-refunds', component: () => import('@/views/AdminRefundsView.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '售后与退款' }, children: [
      { path: ':id', name: 'admin-refund-detail', component: () => import('@/views/AdminRefundDetailView.vue'), meta: { title: '售后查证与裁定' } },
    ] },
    { path: '/admin/review-reports', name: 'admin-review-reports', component: () => import('@/views/AdminReviewReportsView.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '评价举报' } },
    { path: '/admin/content-reports', name: 'admin-content-reports', component: () => import('@/views/AdminContentReportsView.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '内容举报' } },
    { path: '/admin/works', component: () => import('@/views/AdminWorksView.vue'), meta: { requiresAuth: true, requiresAdmin: true, title: '作品审核' }, children: [
      { path: ':id', component: () => import('@/views/AdminWorkReviewView.vue'), meta: { title: '作品材料审核' } },
    ] },
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
      path: '/messages/notifications',
      name: 'notifications',
      component: () => import('@/views/NotificationsView.vue'),
      meta: { requiresAuth: true, title: '系统通知' },
    },
    {
      path: '/admin/creator-applications',
      name: 'admin-creator-applications',
      component: () => import('@/views/AdminCreatorApplicationsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, title: '入驻审核' },
      children: [{ path: ':id', name: 'admin-creator-review', component: () => import('@/views/AdminCreatorReviewView.vue'), meta: { title: '入驻材料审核' } }],
    },
    {
      path: '/admin/categories',
      name: 'admin-categories',
      component: () => import('@/views/AdminCategoriesView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, title: '品类管理' },
    },
    {
      path: '/admin/settlements',
      name: 'admin-settlements',
      component: () => import('@/views/AdminSettlementsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true, title: '资金记录' },
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
  // 管理员默认进入工作后台，显式访问 /discover 时仍可查看前台作品。
  if (to.path === '/' && auth.session?.roles.includes('ADMIN')) return { path: '/admin/dashboard' }
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
