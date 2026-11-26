<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { countLabel } from '@/utils/customRequest'
import '@/assets/styles/account.css'
import '@/assets/styles/work.css'
import '@/assets/styles/admin.css'
import '@/assets/styles/craftflow-admin.css'

defineProps<{ title: string }>()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const route = useRoute()
const router = useRouter()
const leaving = ref(false)
const error = ref('')
const sidebarKey = 'craftflow.admin-sidebar-collapsed'
const sidebarCollapsed = ref(false)
const animateSidebar = ref(false)
try {
  sidebarCollapsed.value = sessionStorage.getItem(sidebarKey) === 'true'
} catch {
  // 浏览器禁用会话存储时使用当前页面的折叠状态。
}
const sidebarAction = computed(() => sidebarCollapsed.value ? '展开侧栏' : '收起侧栏')
const menuItems = [
  { to: '/admin/dashboard', label: '数据看板', icon: 'grid' },
  { to: '/admin/works', label: '审核中心', icon: 'check' },
  { to: '/admin/content-reports', label: '内容举报', icon: 'shield' },
  { to: '/admin/users', label: '用户管理', icon: 'user' },
  { to: '/admin/categories', label: '品类管理', icon: 'tag' },
  { to: '/admin/orders', label: '订单查询', icon: 'search' },
  { to: '/admin/refunds', label: '售后与退款', icon: 'message' },
  { to: '/admin/settlements', label: '资金记录', icon: 'wallet' },
] as const

/** 详情深链接沿用所属队列的导航状态。 */
const workReview = computed(() => route.path === '/admin/works' || route.path.startsWith('/admin/works/'))
const creatorReview = computed(() => route.path === '/admin/creator-applications' || route.path.startsWith('/admin/creator-applications/'))
const reviewCenter = computed(() => workReview.value || creatorReview.value)
const activeSections = computed<Record<string, boolean>>(() => ({
  '/admin/works': reviewCenter.value,
  '/admin/content-reports': route.name === 'admin-content-reports' || route.name === 'admin-review-reports',
}))

/** 在同一浏览器标签页内切换后台页面时恢复侧栏宽度。 */
function toggleSidebar() {
  animateSidebar.value = true
  sidebarCollapsed.value = !sidebarCollapsed.value
  try {
    sessionStorage.setItem(sidebarKey, String(sidebarCollapsed.value))
  } catch {
    // 当前页可继续使用折叠按钮。
  }
}

/** 后台退出沿用真实会话；请求失败时留在当前工作区。 */
async function signOut() {
  leaving.value = true
  error.value = ''
  try { await auth.signOut(); await router.replace('/login') }
  catch (failure) { error.value = failure instanceof Error ? failure.message : '退出失败，请重试' }
  finally { leaving.value = false }
}
</script>

<template>
  <div
    class="admin-page craft-admin"
    :class="{ 'admin-sidebar-collapsed': sidebarCollapsed, 'admin-sidebar-animated': animateSidebar }"
  >
    <aside
      id="admin-sidebar"
      class="admin-sidebar"
    >
      <RouterLink
        to="/admin/dashboard"
        class="admin-brand"
        aria-label="匠心集管理台"
      >
        <span
          class="admin-brand-seal"
          aria-hidden="true"
        ><AppIcon name="hammer" /></span>
        <strong class="admin-sidebar-label">匠心集管理台</strong>
      </RouterLink>
      <nav aria-label="后台管理">
        <RouterLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          :class="{ active: activeSections[item.to] }"
          :title="sidebarCollapsed ? item.label : undefined"
          active-class="active"
        >
          <AppIcon :name="item.icon" />
          <span class="admin-sidebar-label">{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="admin-sidebar-bottom">
        <RouterLink
          to="/messages/notifications"
          :title="sidebarCollapsed ? '系统通知' : undefined"
          active-class="active"
        >
          <AppIcon name="bell" />
          <span class="admin-sidebar-label">系统通知</span>
        </RouterLink>
        <RouterLink
          to="/discover"
          :title="sidebarCollapsed ? '查看前台作品' : undefined"
        >
          <AppIcon name="arrow" />
          <span class="admin-sidebar-label">查看前台作品</span>
        </RouterLink>
        <button
          type="button"
          :title="sidebarCollapsed ? '退出登录' : undefined"
          :disabled="leaving"
          @click="signOut"
        >
          <AppIcon name="logout" />
          <span class="admin-sidebar-label">{{ leaving ? '正在退出…' : '退出登录' }}</span>
        </button>
      </div>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar-start">
          <button
            type="button"
            class="admin-sidebar-toggle"
            aria-controls="admin-sidebar"
            :aria-expanded="!sidebarCollapsed"
            :aria-label="sidebarAction"
            :title="sidebarAction"
            @click="toggleSidebar"
          >
            <AppIcon name="sidebar" />
          </button>
          <nav aria-label="后台位置">
            <RouterLink to="/admin/dashboard">后台管理</RouterLink><span>/</span><span>{{ title }}</span>
          </nav>
        </div>
        <div class="admin-user-tools">
          <RouterLink
            to="/messages/notifications"
            class="notification-link"
            aria-label="系统通知"
          >
            <AppIcon name="bell" />
            <span
              v-if="notifications.unreadCount"
              class="unread-badge"
            >{{ countLabel(notifications.unreadCount) }}</span>
          </RouterLink>
          <span class="identity-label">管理员身份</span>
          <RouterLink
            to="/account/profile"
            class="admin-user"
          >{{ auth.session?.nickname }}<span aria-hidden="true">管</span></RouterLink>
        </div>
      </header>
      <main class="admin-content">
        <header class="admin-heading">
          <h1>{{ title }}</h1><slot name="actions" />
        </header>
        <nav
          v-if="reviewCenter"
          class="admin-review-tabs"
          aria-label="审核中心"
        >
          <RouterLink
            to="/admin/works"
            :aria-current="workReview ? 'page' : undefined"
          >作品审核</RouterLink>
          <RouterLink
            to="/admin/creator-applications"
            :aria-current="creatorReview ? 'page' : undefined"
          >入驻审核</RouterLink>
        </nav>
        <p
          v-if="error"
          class="form-alert"
          role="alert"
        >
          {{ error }}
        </p>
        <slot />
      </main>
    </div>
  </div>
</template>
