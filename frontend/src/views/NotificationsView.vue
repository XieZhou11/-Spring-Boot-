<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AccountLayout from '@/layouts/AccountLayout.vue'
import { getNotifications, readNotification } from '@/api/creator'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationVO } from '@/types/creator'
import { formatTime } from '@/utils/creator'

const notifications = useNotificationsStore()
const router = useRouter()
const rows = ref<NotificationVO[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const marking = ref<string[]>([])
let revision = 0

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

async function openApplication(notification: NotificationVO) {
  await markRead(notification)
  if (notification.businessReference?.type === 'CREATOR_APPLICATION') await router.push({ path: '/account/creator-certification', query: { applicationId: notification.businessReference.id } })
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
  <AccountLayout
    title="系统通知"
    subtitle="每一次进展，都好好告诉你。"
    number="04"
  >
    <div class="queue-toolbar">
      <p>
        未读 <strong>{{ notifications.unreadCount }}</strong> 条 <span
          class="connection-indicator"
          :class="{ connected: notifications.connected }"
        >{{ notifications.connected ? '实时连接中' : '离线通知仍可查询' }}</span>
      </p><button
        class="button-secondary"
        :disabled="loading"
        @click="load"
      >
        刷新通知
      </button><button
        v-if="!notifications.connected"
        class="button-secondary"
        @click="notifications.reconnect()"
      >
        重新连接
      </button>
    </div><p
      v-if="notifications.connectionMessage"
      class="field-help connection-message"
      role="status"
    >
      {{ notifications.connectionMessage }}
    </p><p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p><p
      v-if="loading && !rows.length"
      class="account-loading"
      role="status"
    >
      正在读取通知…
    </p><div
      v-else-if="!rows.length && !error"
      class="creator-empty"
    >
      <span aria-hidden="true">✉</span><h2>这里，等一封好消息</h2><p>入驻审核进度会留在这里，离线也不会错过。</p>
    </div><div
      v-else
      class="notification-list"
    >
      <article
        v-for="notification in rows"
        :key="notification.id"
        class="notification-card"
        :class="{ unread: !notification.readAt }"
      >
        <header>
          <span
            class="notice-dot"
            aria-hidden="true"
          /><h2>{{ notification.title }}</h2><span class="read-label">{{ notification.readAt ? '已读' : '未读' }}</span>
        </header><p>{{ notification.content }}</p><footer>
          <time :datetime="notification.createdAt">{{ formatTime(notification.createdAt) }}</time><div>
            <button
              v-if="!notification.readAt"
              class="inline-button"
              :disabled="marking.includes(notification.id)"
              @click="markRead(notification)"
            >
              {{ marking.includes(notification.id) ? '正在更新…' : '标为已读' }}
            </button><button
              v-if="notification.businessReference?.type === 'CREATOR_APPLICATION'"
              class="inline-button"
              @click="openApplication(notification)"
            >
              查看申请 ↗
            </button>
          </div>
        </footer>
      </article>
    </div><div
      v-if="total > 20"
      class="pagination"
    >
      <button
        class="button-secondary"
        :disabled="loading || page <= 1"
        @click="page--; load()"
      >
        上一页
      </button><span>第 {{ page }} 页 · 共 {{ total }} 条</span><button
        class="button-secondary"
        :disabled="loading || page * 20 >= total"
        @click="page++; load()"
      >
        下一页
      </button>
    </div>
  </AccountLayout>
</template>
