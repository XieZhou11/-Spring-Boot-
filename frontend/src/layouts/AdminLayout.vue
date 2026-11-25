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
/** 详情深链接沿用所属队列的导航状态。 */
const workReview = computed(() => route.path === '/admin/works' || route.path.startsWith('/admin/works/'))
const creatorReview = computed(() => route.path === '/admin/creator-applications' || route.path.startsWith('/admin/creator-applications/'))
const reviewCenter = computed(() => workReview.value || creatorReview.value)
const reportCenter = computed(() => route.name === 'admin-content-reports' || route.name === 'admin-review-reports')

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
  <div class="admin-page craft-admin">
    <aside class="admin-sidebar">
      <RouterLink
        to="/admin/dashboard"
        class="admin-brand"
      >
        <span
          class="admin-brand-seal"
          aria-hidden="true"
        ><AppIcon name="hammer" /></span>
        <strong>匠心集管理台</strong>
      </RouterLink>
      <nav aria-label="后台管理">
        <RouterLink
          to="/admin/dashboard"
          active-class="active"
        ><AppIcon name="grid" />数据看板</RouterLink>
        <RouterLink
          to="/admin/works"
          :class="{ active: reviewCenter }"
        ><AppIcon name="check" />审核中心</RouterLink>
        <RouterLink
          to="/admin/content-reports"
          :class="{ active: reportCenter }"
        ><AppIcon name="shield" />内容举报</RouterLink>
        <RouterLink
          to="/admin/users"
          active-class="active"
        ><AppIcon name="user" />用户管理</RouterLink>
        <RouterLink
          to="/admin/categories"
          active-class="active"
        ><AppIcon name="grid" />品类管理</RouterLink>
        <RouterLink
          to="/admin/orders"
          active-class="active"
        ><AppIcon name="search" />订单查询</RouterLink>
        <RouterLink
          to="/admin/refunds"
          active-class="active"
        ><AppIcon name="message" />售后与退款</RouterLink>
        <RouterLink
          to="/admin/settlements"
          active-class="active"
        ><AppIcon name="grid" />资金记录</RouterLink>
      </nav>
      <div class="admin-sidebar-bottom">
        <RouterLink to="/discover"><AppIcon name="arrow" />查看前台作品</RouterLink>
        <button
          :disabled="leaving"
          @click="signOut"
        >
          <AppIcon name="logout" />{{ leaving ? '正在退出…' : '退出登录' }}
        </button>
      </div>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar">
        <nav aria-label="后台位置">
          <RouterLink to="/admin/dashboard">后台管理</RouterLink><span>/</span><span>{{ title }}</span>
        </nav>
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
