<script setup lang="ts">
import { useNotificationsStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { countLabel } from '@/utils/customRequest'
import '@/assets/styles/custom-request.css'
const notifications = useNotificationsStore()
const auth = useAuthStore()
</script>
<template>
  <nav
    class="message-center-tabs"
    aria-label="消息中心"
  >
    <RouterLink
      v-if="!auth.session?.roles.includes('ADMIN')"
      to="/messages/conversations"
    >需求沟通 <span
      v-if="notifications.chatUnreadCount"
      class="unread-badge"
    >{{ countLabel(notifications.chatUnreadCount) }}</span></RouterLink>
    <RouterLink to="/messages/notifications">系统通知 <span
      v-if="notifications.unreadCount"
      class="unread-badge"
    >{{ countLabel(notifications.unreadCount) }}</span></RouterLink>
  </nav>
</template>
