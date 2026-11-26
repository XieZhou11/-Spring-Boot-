<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MessageLayout from '@/layouts/MessageLayout.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useRoute } from 'vue-router'
import WorkPagination from '@/components/WorkPagination.vue'
import { useListQuery } from '@/composables/useListQuery'
import { getConversations } from '@/api/customRequest'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { countLabel, requestStatus } from '@/utils/customRequest'
import { formatTime } from '@/utils/creator'
import { orderStatus } from '@/utils/quote'
import type { ConversationVO } from '@/types/customRequest'
const route = useRoute()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const rows = ref<ConversationVO[]>([])
const { page, changePage, replaceLastPage } = useListQuery()
const total = ref(0)
const error = ref('')
const loading = ref(false)
let revision = 0
let pending = false
let disposed = false
async function load() {
  if (disposed || !auth.session) return
  const next = page.value
  // 在途期间收到推送只补做一次，翻页仍采用最后一次选择的页码。
  if (loading.value) { pending = true; return }
  const current = ++revision; loading.value = true; error.value = ''
  try {
    const result = await getConversations(next)
    if (current !== revision || page.value !== next || replaceLastPage(result, next)) return
    rows.value = result.items
    total.value = result.total
  }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '会话读取失败' }
  finally { if (current === revision) { loading.value = false; if (pending) { pending = false; void load() } } }
}
function focus() { void load(); void notifications.refreshChatUnread(); if (!notifications.connected) void notifications.reconnect() }
function manualRefresh() { void load(); void notifications.refreshChatUnread() }
watch(() => notifications.chatRevision, () => void load())
watch(page, () => {
  rows.value = []
  total.value = 0
  void load()
})
watch(() => auth.session?.userId, () => {
  revision++
  pending = false
  rows.value = []
  total.value = 0
  error.value = ''
  loading.value = false
  void load()
}, { flush: 'sync' })
onMounted(() => { focus(); window.addEventListener('focus', focus) })
onBeforeUnmount(() => { disposed = true; revision++; window.removeEventListener('focus', focus) })

/** 定标后与现货会话优先展示关联订单的当前状态。 */
function businessStatus(row: ConversationVO) {
  if (row.orderId && row.orderStatus) return orderStatus[row.orderStatus] || row.orderStatus
  if (row.requestStatus) return requestStatus[row.requestStatus] || row.requestStatus
}
</script>
<template>
  <MessageLayout>
    <div
      class="message-workspace"
      :class="{ 'has-selection': !!route.params.id }"
    >
      <aside
        class="conversation-list"
        aria-label="交易会话列表"
      >
        <header class="conversation-list-heading">
          <h2>全部会话</h2>
          <button
            type="button"
            class="inline-button"
            :disabled="loading"
            @click="manualRefresh"
          >
            刷新会话
          </button>
        </header>
        <p
          v-if="!notifications.connected"
          class="message-offline"
          role="status"
        >
          连接已断开
          <button
            type="button"
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
          <p>暂无会话</p>
          <RouterLink
            v-if="auth.session?.activeRole === 'CREATOR'"
            class="inline-button"
            to="/requests"
          >前往需求大厅</RouterLink>
        </div>
        <div
          v-if="rows.length"
          class="conversation-rows"
        >
          <RouterLink
            v-for="row in rows"
            :key="row.id"
            :to="{ path: `/messages/conversations/${row.id}`, query: page > 1 ? { page: String(page) } : undefined }"
            class="conversation-row"
            active-class="selected"
          >
            <div class="conversation-row-heading">
              <strong>{{ row.otherNickname }}</strong>
              <span
                v-if="row.unreadCount"
                class="unread-badge"
                :aria-label="`${countLabel(row.unreadCount)} 条未读`"
              >{{ countLabel(row.unreadCount) }}</span>
            </div>
            <p
              v-if="row.orderTitle || row.requestTitle"
              class="conversation-title"
            >
              {{ row.orderTitle || row.requestTitle }}
            </p>
            <div class="conversation-meta">
              <span v-if="businessStatus(row)">{{ businessStatus(row) }}</span>
              <span
                v-if="!row.canSend"
                class="conversation-archive"
              ><AppIcon name="lock" />{{ row.archivedAt ? '已归档' : '只读' }}</span>
              <time
                v-if="row.lastMessageAt"
                :datetime="row.lastMessageAt"
              >{{ formatTime(row.lastMessageAt) }}</time>
            </div>
          </RouterLink>
        </div>
        <WorkPagination
          label="会话分页"
          :page="page"
          :total="total"
          :loading="loading"
          @change="changePage"
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
          <span class="message-empty-icon"><AppIcon name="message" /></span>
          <h2>{{ rows.length ? '请选择会话' : '交易会话' }}</h2>
        </div>
      </section>
    </div>
  </MessageLayout>
</template>
