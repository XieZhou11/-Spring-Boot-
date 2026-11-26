<script setup lang="ts">
import { useNotificationsStore } from '@/stores/notifications'
import AppIcon from '@/components/AppIcon.vue'
import { countLabel } from '@/utils/customRequest'
const notifications = useNotificationsStore()
</script>
<template>
  <nav
    class="message-center-tabs"
    aria-label="消息中心"
  >
    <RouterLink
      to="/messages/conversations"
    >
      <AppIcon name="message" />交易会话
      <span
        v-if="notifications.chatUnreadCount"
        class="unread-badge"
      >{{ countLabel(notifications.chatUnreadCount) }}</span>
    </RouterLink>
    <!-- 将未读数纳入名称，让讲述人聚焦当前页链接时也能播报。 -->
    <RouterLink
      to="/messages/notifications"
      :aria-label="notifications.unreadCount ? `系统通知 ${countLabel(notifications.unreadCount)} 条未读` : '系统通知'"
    >
      <AppIcon name="bell" />系统通知
      <span
        v-if="notifications.unreadCount"
        class="unread-badge"
      >{{ countLabel(notifications.unreadCount) }}</span>
    </RouterLink>
    <RouterLink to="/me/reports"><AppIcon name="shield" />我的举报</RouterLink>
  </nav>
</template>
