<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AccountLayout from '@/layouts/AccountLayout.vue'
import MessageCenterTabs from '@/components/MessageCenterTabs.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getConversations } from '@/api/customRequest'
import { useNotificationsStore } from '@/stores/notifications'
import { countLabel, requestStatus } from '@/utils/customRequest'
import { formatTime } from '@/utils/creator'
import type { ConversationVO } from '@/types/customRequest'
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
  <AccountLayout
    title="需求沟通"
    subtitle="把想法聊清楚，留下每一次沟通。"
    number="06"
  >
    <MessageCenterTabs /><div class="queue-toolbar">
      <p>{{ notifications.connected ? '实时连接中' : '离线记录仍可查询' }}</p><button
        class="button-secondary"
        :disabled="loading"
        @click="load()"
      >
        刷新会话
      </button><button
        v-if="!notifications.connected"
        class="inline-button"
        @click="notifications.reconnect"
      >
        重新连接
      </button>
    </div><p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="loading && !rows.length"
      role="status"
    >
      正在读取会话…
    </p><div
      v-else-if="!rows.length && !error"
      class="creator-empty"
    >
      <h2>等一个把想法聊成作品的人</h2><p>从需求详情进入沟通，会话将保存在这里。</p><RouterLink to="/account/requests">查看我的需求 ↗</RouterLink>
    </div>
    <RouterLink
      v-for="row in rows"
      :key="row.id"
      :to="`/account/conversations/${row.id}`"
      class="conversation-row"
    ><div><h2>{{ row.otherNickname }} <span
      v-if="row.unreadCount"
      class="unread-badge"
    >{{ countLabel(row.unreadCount) }}</span></h2><p>{{ row.requestTitle }}</p><small class="field-help">{{ requestStatus[row.requestStatus] || row.requestStatus }} · {{ row.canSend ? '沟通中' : row.sendDisabledReason || '历史记录' }}</small></div><time>{{ row.lastMessageAt ? formatTime(row.lastMessageAt) : '尚无消息' }}</time></RouterLink><WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </AccountLayout>
</template>
