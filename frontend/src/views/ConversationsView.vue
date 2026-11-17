<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MessageLayout from '@/layouts/MessageLayout.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useRoute } from 'vue-router'
import WorkPagination from '@/components/WorkPagination.vue'
import { getConversations } from '@/api/customRequest'
import { useNotificationsStore } from '@/stores/notifications'
import { countLabel, requestStatus } from '@/utils/customRequest'
import { formatTime } from '@/utils/creator'
import { orderStatus } from '@/utils/quote'
import type { ConversationVO } from '@/types/customRequest'
const route = useRoute()
const notifications = useNotificationsStore()
const rows = ref<ConversationVO[]>([]); const page = ref(1); const total = ref(0); const error = ref(''); const loading = ref(false)
let revision = 0
async function load(next = page.value) {
  const current = ++revision; page.value = next; loading.value = true; error.value = ''
  try { const result = await getConversations(next); if (current === revision) { rows.value = result.items; total.value = result.total }; void notifications.refreshChatUnread() }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '会话读取失败' }
  finally { if (current === revision) loading.value = false }
}
function focus() { void load(); if (!notifications.connected) void notifications.reconnect() }
watch(() => notifications.chatRevision, () => void load())
onMounted(() => { focus(); window.addEventListener('focus', focus) })
onBeforeUnmount(() => { revision++; window.removeEventListener('focus', focus) })
</script>
<template>
  <MessageLayout>
    <div
      class="message-workspace"
      :class="{ 'has-selection': !!route.params.id }"
    >
      <aside
        class="conversation-list"
        aria-label="需求会话列表"
      >
        <header class="conversation-list-heading">
          <h2>全部会话</h2><button
            class="inline-button"
            :disabled="loading"
            @click="load()"
          >
            刷新会话
          </button>
        </header>
        <p
          v-if="!notifications.connected"
          class="message-offline"
          role="status"
        >
          连接已断开<button
            class="inline-button"
            @click="notifications.reconnect"
          >
            重新连接
          </button>
        </p>
        <p
          v-if="error"
          class="form-alert"
          role="alert"
        >
          {{ error }}
        </p>
        <p
          v-if="loading && !rows.length"
          class="account-loading"
          role="status"
        >
          正在读取会话…
        </p>
        <div
          v-else-if="!rows.length && !error"
          class="conversation-empty"
        >
          <p>暂无需求沟通</p><RouterLink to="/my-requests">查看我的需求</RouterLink>
        </div>
        <RouterLink
          v-for="row in rows"
          :key="row.id"
          :to="`/messages/conversations/${row.id}`"
          class="conversation-row"
          active-class="selected"
        >
          <span
            class="conversation-avatar"
            aria-hidden="true"
          >{{ row.otherNickname.slice(0, 1) }}</span>
          <div class="conversation-copy"><h2>{{ row.otherNickname }} <span
            v-if="row.unreadCount"
            class="unread-badge"
          >{{ countLabel(row.unreadCount) }}</span></h2><p>{{ row.orderTitle || row.requestTitle }}</p><small>{{ row.orderId ? (orderStatus[row.orderStatus || ''] || row.orderStatus) : (requestStatus[row.requestStatus] || row.requestStatus) }} · {{ row.canSend ? '沟通中' : '已归档' }}</small><time v-if="row.lastMessageAt">{{ formatTime(row.lastMessageAt) }}</time></div>
        </RouterLink>
        <WorkPagination
          :page="page"
          :total="total"
          :loading="loading"
          @change="load"
        />
      </aside>
      <section
        class="conversation-detail"
        aria-label="当前会话"
      >
        <RouterView />
        <div
          v-if="!route.params.id"
          class="message-placeholder"
        >
          <AppIcon name="message" /><h2>选择会话，继续沟通</h2>
        </div>
      </section>
    </div>
  </MessageLayout>
</template>
