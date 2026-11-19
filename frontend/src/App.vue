<script setup lang="ts">
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import '@/assets/styles/creator.css'

const auth = useAuthStore()
const notifications = useNotificationsStore()
// 路由切换复用连接；同账号资格变化只更新聊天范围，管理员仍接收系统通知。
watch([() => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], ([id, admin]) => id ? notifications.connect(id, !admin) : notifications.disconnect(), { immediate: true })
window.addEventListener('creator-certification-updated', () => {
  if (auth.session) void auth.restoreSession(true).catch(() => { /* 下次导航会再次核验。 */ })
})
</script>

<template>
  <RouterView />
</template>
