<script setup lang="ts">
import { useNotificationsStore } from '@/stores/notifications'
import { countLabel } from '@/utils/customRequest'
import '@/assets/styles/custom-request.css'
const notifications = useNotificationsStore()
</script>
<template>
  <nav
    class="message-center-tabs"
    aria-label="消息中心"
  >
    <RouterLink to="/account/notifications">系统通知 <span
      v-if="notifications.unreadCount"
      class="unread-badge"
    >{{ countLabel(notifications.unreadCount) }}</span></RouterLink><RouterLink to="/account/conversations">需求沟通 <span
      v-if="notifications.chatUnreadCount"
      class="unread-badge"
    >{{ countLabel(notifications.chatUnreadCount) }}</span></RouterLink>
  </nav>
</template>
