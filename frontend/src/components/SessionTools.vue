<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { countLabel } from '@/utils/customRequest'

const auth = useAuthStore()
const notifications = useNotificationsStore()
const router = useRouter()
const switching = ref(false)
const error = ref('')

/** 服务端切换只影响当前会话，完成后进入对应的已实现工作入口。 */
async function switchRole() {
  if (!auth.session || switching.value) return
  switching.value = true
  error.value = ''
  try {
    await auth.switchRole(auth.session.activeRole === 'CREATOR' ? 'BUYER' : 'CREATOR')
    await router.push(auth.session?.activeRole === 'CREATOR' ? '/creator/works' : '/')
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '身份切换失败' }
  finally { switching.value = false }
}
</script>

<template>
  <div class="session-tools">
    <button
      v-if="auth.session?.roles.includes('CREATOR') && !auth.session.roles.includes('ADMIN')"
      class="role-switch"
      :disabled="switching"
      @click="switchRole"
    >
      {{ switching ? '正在切换…' : auth.session.activeRole === 'CREATOR' ? '切换为买家' : '切换为创作者' }}
    </button>
    <RouterLink
      :to="auth.session?.roles.includes('ADMIN') ? '/messages/notifications' : '/messages/conversations'"
      class="notification-link"
      aria-label="消息中心"
    >
      <AppIcon name="message" /><span>消息中心</span>
      <span
        v-if="notifications.unreadCount + notifications.chatUnreadCount"
        class="unread-badge"
      >{{ countLabel(notifications.unreadCount + notifications.chatUnreadCount) }}</span>
    </RouterLink>
    <p
      v-if="error"
      class="field-error"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>
