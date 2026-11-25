<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import MessageLayout from '@/layouts/MessageLayout.vue'
import AppIcon from '@/components/AppIcon.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getNotifications, readNotification } from '@/api/creator'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationVO } from '@/types/creator'
import { formatTime } from '@/utils/creator'

const notifications = useNotificationsStore()
const auth = useAuthStore()
const router = useRouter()
const rows = ref<NotificationVO[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const marking = ref<string[]>([])
let revision = 0
let referenceSelection = 0
const entries = computed(() => rows.value.map(notification => ({ notification, action: notificationAction(notification) })))

/** 即使实时连接断开，持久化通知仍可分页读取。 */
async function load() {
  const current = ++revision
  loading.value = true
  error.value = ''
  try {
    const result = await getNotifications(page.value)
    if (current !== revision) return
    rows.value = result.items
    total.value = result.total
    void notifications.refreshUnread()
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '通知读取失败' }
  finally { if (current === revision) loading.value = false }
}

async function markRead(notification: NotificationVO) {
  if (notification.readAt || marking.value.includes(notification.id)) return
  marking.value.push(notification.id)
  error.value = ''
  try {
    const updated = await readNotification(notification.id)
    const index = rows.value.findIndex(n => n.id === updated.id)
    if (index >= 0) rows.value[index] = updated
    await notifications.refreshUnread()
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '已读状态更新失败' }
  finally { marking.value = marking.value.filter(id => id !== notification.id) }
}

/** 报价从其所属需求进入，其他通知使用各自的业务资源入口。 */
function notificationAction({ businessReference: reference, eventType }: NotificationVO): { label: string; to: RouteLocationRaw } | undefined {
  if (!reference) return
  switch (reference.type) {
    case 'CREATOR_APPLICATION':
      return { label: '查看申请', to: { path: '/account/creator-certification', query: { applicationId: reference.id } } }
    case 'WORK':
      return { label: '查看作品', to: `/creator/works/${reference.id}/edit` }
    case 'CUSTOM_REQUEST':
      return { label: '查看需求', to: `/requests/${reference.id}` }
    case 'QUOTE':
      if (reference.requestId) return { label: '查看报价', to: { path: `/requests/${reference.requestId}`, hash: '#quotes' } }
      return
    case 'ORDER':
      return { label: '查看订单', to: { path: `/orders/${reference.id}`, hash: eventType.startsWith('PUBLICATION_') ? '#publication-consent' : undefined } }
    case 'REPORT':
      return { label: '查看举报', to: `/reports/${reference.id}` }
    case 'REVIEW_REPORT':
      return { label: '查看举报', to: `/review-reports/${reference.id}` }
    case 'USER':
      return { label: '查看资料', to: '/account/profile' }
  }
}

async function openReference(notification: NotificationVO, to: RouteLocationRaw) {
  const selection = ++referenceSelection
  const sourceRoute = router.currentRoute.value
  const sourceUser = auth.session?.userId
  await markRead(notification)
  // 已读仍按原操作提交，只有当前页面的最新选择可以跳转。
  if (selection !== referenceSelection || router.currentRoute.value !== sourceRoute || auth.session?.userId !== sourceUser) return
  await router.push(to)
}

function changePage(next: number) {
  page.value = next
  void load()
}
function refreshOnFocus() {
  void load()
  if (!notifications.connected) void notifications.reconnect()
}
watch(() => notifications.revision, () => void load())
onMounted(() => { refreshOnFocus(); window.addEventListener('focus', refreshOnFocus) })
onBeforeUnmount(() => { revision++; window.removeEventListener('focus', refreshOnFocus) })
</script>

<template>
  <MessageLayout>
    <section
      class="message-notifications"
      aria-label="通知列表"
    >
      <header class="notification-toolbar">
        <p>未读 <strong>{{ notifications.unreadCount }}</strong> 条</p>
        <span
          class="connection-indicator"
          :class="{ connected: notifications.connected }"
        >{{ notifications.connected ? '实时连接中' : '离线通知仍可查询' }}</span>
        <div class="notification-actions">
          <button
            type="button"
            class="button-secondary"
            :disabled="loading"
            @click="load"
          >
            刷新通知
          </button>
          <button
            v-if="!notifications.connected"
            type="button"
            class="inline-button"
            @click="notifications.reconnect()"
          >
            重新连接
          </button>
        </div>
      </header>
      <p
        v-if="notifications.connectionMessage"
        class="connection-message"
        role="status"
      >
        {{ notifications.connectionMessage }}
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
        正在读取通知…
      </p>
      <div
        v-else-if="!rows.length && !error"
        class="message-placeholder"
      >
        <span class="message-empty-icon"><AppIcon name="bell" /></span>
        <h2>暂无系统通知</h2>
      </div>
      <div
        v-if="rows.length"
        class="notification-list"
      >
        <article
          v-for="{ notification, action } in entries"
          :key="notification.id"
          class="notification-card"
          :class="{ unread: !notification.readAt }"
        >
          <AppIcon name="bell" />
          <div class="notification-entry">
            <header>
              <h2>{{ notification.title }}</h2>
              <span class="read-label">{{ notification.readAt ? '已读' : '未读' }}</span>
            </header>
            <p>{{ notification.content }}</p>
            <footer>
              <time :datetime="notification.createdAt">{{ formatTime(notification.createdAt) }}</time>
              <div class="notification-actions">
                <button
                  v-if="!notification.readAt"
                  type="button"
                  class="inline-button"
                  :disabled="marking.includes(notification.id)"
                  @click="markRead(notification)"
                >
                  {{ marking.includes(notification.id) ? '正在更新…' : '标为已读' }}
                </button>
                <button
                  v-if="action"
                  type="button"
                  class="button-secondary"
                  :disabled="marking.includes(notification.id)"
                  @click="openReference(notification, action.to)"
                >
                  {{ action.label }} <span aria-hidden="true">↗</span>
                </button>
              </div>
            </footer>
          </div>
        </article>
      </div>
      <WorkPagination
        aria-label="通知分页"
        :page="page"
        :total="total"
        :loading="loading"
        @change="changePage"
      />
    </section>
  </MessageLayout>
</template>
