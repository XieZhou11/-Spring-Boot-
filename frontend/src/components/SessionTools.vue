<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { countLabel } from '@/utils/customRequest'

const auth = useAuthStore()
const notifications = useNotificationsStore()
const router = useRouter()
const switching = ref(false)
const error = ref('')

/** 服务端切换只影响当前会话，切换完成进入对应的已实现首页。 */
async function switchRole() {
  if (!auth.session || switching.value) return
  switching.value = true
  error.value = ''
  try {
    await auth.switchRole(auth.session.activeRole === 'CREATOR' ? 'BUYER' : 'CREATOR')
    await router.push(auth.session?.activeRole === 'CREATOR' ? '/creator/works' : '/')
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : '身份切换失败'
  } finally {
    switching.value = false
  }
}
</script>

<template>
  <div class="session-tools">
    <span
      v-if="auth.session"
      class="identity-label"
    >{{ auth.session.activeRole === 'ADMIN' ? '管理员身份' : auth.session.activeRole === 'CREATOR' ? '创作者身份' : '买家身份' }}</span>
    <button
      v-if="auth.session?.roles.includes('CREATOR')"
      class="inline-button"
      :disabled="switching"
      @click="switchRole"
    >
      {{ switching ? '正在切换…' : auth.session?.activeRole === 'CREATOR' ? '切换为买家' : '切换为创作者' }}
    </button>
    <RouterLink
      v-if="auth.session?.roles.includes('CREATOR')"
      to="/creator/works"
    >我的作品</RouterLink>
    <RouterLink
      to="/account/notifications"
      class="notification-link"
    >消息中心 <span
      v-if="notifications.unreadCount + notifications.chatUnreadCount"
      class="unread-badge"
    >{{ countLabel(notifications.unreadCount + notifications.chatUnreadCount) }}</span></RouterLink>
    <RouterLink
      v-if="!auth.session?.roles.includes('ADMIN')"
      to="/account/requests"
    >我的需求</RouterLink>
    <RouterLink
      v-if="auth.session?.roles.includes('CREATOR')"
      to="/requests"
    >需求大厅</RouterLink>
    <RouterLink
      v-if="auth.session?.roles.includes('CREATOR')"
      to="/creator/invitations"
    >收到的邀约</RouterLink>
    <RouterLink
      v-if="auth.session?.roles.includes('ADMIN')"
      to="/admin/creator-applications"
    >管理后台 ↗</RouterLink>
    <p
      v-if="error"
      class="field-error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>
