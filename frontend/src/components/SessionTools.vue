<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'

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
    await router.push('/')
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
      to="/account/notifications"
      class="notification-link"
    >系统通知 <span
      v-if="notifications.unreadCount"
      class="unread-badge"
    >{{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}</span></RouterLink>
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
