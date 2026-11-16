<script setup lang="ts">
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import '@/assets/styles/creator.css'

const auth = useAuthStore()
const notifications = useNotificationsStore()
// 路由切换复用连接；退出或切换账号立即关闭旧账号连接。
watch(() => auth.session?.userId, (id) => id ? notifications.connect(id) : notifications.disconnect(), { immediate: true })
window.addEventListener('creator-certification-updated', () => {
  if (auth.session) void auth.restoreSession(true).catch(() => { /* 下次导航会再次核验。 */ })
})
</script>

<template>
  <RouterView />
</template>
