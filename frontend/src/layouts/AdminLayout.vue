<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { countLabel } from '@/utils/customRequest'
import '@/assets/styles/account.css'
import '@/assets/styles/work.css'
import '@/assets/styles/admin.css'

defineProps<{ title: string; subtitle?: string }>()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const router = useRouter()
const leaving = ref(false)
const error = ref('')

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
  <div class="admin-page">
    <aside class="admin-sidebar">
      <RouterLink
        to="/admin/works"
        class="admin-brand"
      >
        <span
          class="admin-brand-seal"
          aria-hidden="true"
        >拾</span>
        <strong>拾作管理台</strong>
      </RouterLink>
      <nav aria-label="后台管理">
        <RouterLink to="/admin/dashboard" active-class="active"><AppIcon name="grid" />数据看板</RouterLink>
        <RouterLink to="/admin/users" active-class="active"><AppIcon name="shield" />用户管理</RouterLink>
        <RouterLink to="/admin/orders" active-class="active"><AppIcon name="grid" />订单查询</RouterLink>
        <RouterLink
          to="/admin/works"
          active-class="active"
        ><AppIcon name="image" />作品审核</RouterLink>
        <RouterLink
          to="/admin/creator-applications"
          active-class="active"
        ><AppIcon name="shield" />入驻审核</RouterLink>
        <RouterLink
          to="/admin/categories"
          active-class="active"
        ><AppIcon name="grid" />品类管理</RouterLink>
        <RouterLink
          to="/admin/refunds"
          active-class="active"
        ><AppIcon name="shield" />售后与退款</RouterLink>
        <RouterLink
          to="/admin/review-reports"
          active-class="active"
        ><AppIcon name="shield" />评价举报</RouterLink>
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
