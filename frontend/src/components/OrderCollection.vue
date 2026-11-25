<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrders } from '@/api/quote'
import WorkPagination from '@/components/WorkPagination.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { OrderVO } from '@/types/quote'
import { formatTime } from '@/utils/creator'
import { getOrderListQuery, type OrderSide } from '@/utils/orderList'
import { orderStatus } from '@/utils/quote'
import '@/assets/styles/craftflow-order-collection.css'

const props = defineProps<{ selectedId?: string; defaultSide?: OrderSide; resolvingSide?: boolean; refreshVersion?: number }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const query = computed(() => getOrderListQuery(route.query, props.defaultSide))
const side = computed(() => query.value.side || 'BUYER')
const status = computed(() => query.value.status || '')
const page = computed(() => Number(query.value.page || 1))
const viewingDetail = computed(() => route.name === 'order-detail')
// 未携带列表关系的详情直链需等订单归属返回，否则可能按另一方的总数改写页码。
const waitingForSide = computed(() => viewingDetail.value && props.resolvingSide && route.query.side !== 'BUYER' && route.query.side !== 'CREATOR')
const sides = [
  { value: 'BUYER', label: '我购买的' },
  { value: 'CREATOR', label: '我承接的' },
] as const
const size = 20
const rows = ref<OrderVO[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
let revision = 0

/** 筛选和翻页由服务端处理，旧身份或旧筛选的响应不能写回当前列表。 */
async function load() {
  if (!auth.session || waitingForSide.value) return
  const current = ++revision
  const requestedPage = page.value
  loading.value = true
  error.value = ''
  try {
    const result = await getOrders({ side: side.value, status: status.value || undefined, page: requestedPage, size })
    if (current !== revision) return
    rows.value = result.items
    total.value = result.total
    const lastPage = Math.max(1, Math.ceil(result.total / size))
    if (requestedPage > lastPage) {
      // 刷新后列表可能缩短。回到最后一页，同时保留详情及会话锚点。
      const nextQuery = getOrderListQuery({ ...route.query, page: String(lastPage) }, side.value)
      await router.replace(viewingDetail.value
        ? { name: 'order-detail', params: route.params, query: nextQuery, hash: route.hash }
        : { path: '/orders', query: nextQuery })
    }
  } catch (failure) {
    if (current !== revision) return
    rows.value = []
    total.value = 0
    error.value = failure instanceof Error ? failure.message : '订单读取失败'
  } finally {
    if (current === revision) loading.value = false
  }
}

function listTarget(relation = side.value, nextStatus = status.value, nextPage = 1) {
  const explicitSide = relation === 'CREATOR' || route.query.side === 'BUYER' ? relation : null
  return { path: '/orders', query: getOrderListQuery({ side: explicitSide, status: nextStatus, page: String(nextPage) }) }
}

async function changeStatus(event: Event) {
  const select = event.currentTarget as HTMLSelectElement
  await router.push(listTarget(side.value, select.value))
  select.value = status.value
}

function nextPage(value: number) {
  void router.push(listTarget(side.value, status.value, value))
}

function openOrder(order: OrderVO) {
  return { name: 'order-detail', params: { id: order.id }, query: query.value }
}

function reset() {
  revision++
  rows.value = []
  total.value = 0
  loading.value = false
  error.value = ''
  void load()
}
watch([side, status, page, waitingForSide], reset, { immediate: true })
watch(() => auth.session?.userId, reset, { flush: 'sync' })
watch(() => props.refreshVersion, () => void load())
watch(() => notifications.connected, (connected, previous) => { if (connected && !previous) void load() })
function refresh() { void load() }
function visible() { if (document.visibilityState === 'visible') refresh() }
onMounted(() => {
  window.addEventListener('order-updated', refresh)
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', visible)
})
onBeforeUnmount(() => {
  revision++
  window.removeEventListener('order-updated', refresh)
  window.removeEventListener('focus', refresh)
  document.removeEventListener('visibilitychange', visible)
})
</script>

<template>
  <section
    class="craftflow-order-collection"
    aria-label="订单列表"
  >
    <header class="craftflow-order-collection-heading">
      <component :is="viewingDetail ? 'h2' : 'h1'">
        我的订单
      </component>
      <div class="craftflow-order-collection-tools">
        <span v-if="total">{{ total }} 笔</span>
        <button
          type="button"
          :disabled="loading || waitingForSide"
          @click="refresh"
        >
          刷新列表
        </button>
      </div>
    </header>
    <nav
      class="craftflow-order-sides"
      aria-label="订单身份"
    >
      <RouterLink
        v-for="item in sides"
        :key="item.value"
        :to="listTarget(item.value)"
        :aria-current="side === item.value ? 'page' : undefined"
      >{{ item.label }}</RouterLink>
    </nav>
    <div class="craftflow-order-filter">
      <label for="order-list-status">订单状态</label>
      <select
        id="order-list-status"
        :value="status"
        @change="changeStatus"
      >
        <option value="">
          全部状态
        </option>
        <option
          v-for="(label, value) in orderStatus"
          :key="value"
          :value="value"
        >
          {{ label }}
        </option>
      </select>
    </div>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
      <button
        type="button"
        class="inline-button"
        @click="load"
      >
        重新读取
      </button>
    </p>
    <p
      v-else-if="waitingForSide || loading && !rows.length"
      class="craftflow-order-list-state"
      role="status"
    >
      正在读取订单…
    </p>
    <div
      v-else-if="!rows.length"
      class="craftflow-order-list-state"
    >
      <h2>暂无订单</h2>
      <p v-if="status">
        当前状态没有符合条件的订单。
      </p>
      <RouterLink
        v-else-if="side === 'BUYER'"
        to="/discover"
      >浏览作品</RouterLink>
    </div>
    <ul
      v-if="rows.length"
      class="craftflow-order-list"
    >
      <li
        v-for="row in rows"
        :key="row.id"
        class="craftflow-order-item"
      >
        <RouterLink
          :to="openOrder(row)"
          :aria-label="row.title"
          :aria-current="selectedId === row.id ? 'page' : undefined"
        >
          <span class="craftflow-order-card-line">
            <span class="craftflow-order-card-tags">
              <span
                class="craftflow-order-card-tag"
                :data-type="row.orderType"
              >{{ row.orderType === 'STOCK' ? '现货订单' : '定制订单' }}</span>
              <span
                class="craftflow-order-card-tag"
                :data-status="row.status"
              >{{ orderStatus[row.status] || row.status }}</span>
            </span>
            <span class="craftflow-order-card-amount">¥ {{ row.totalAmount }}</span>
          </span>
          <strong class="craftflow-order-card-title">{{ row.title }}</strong>
          <span class="craftflow-order-card-line craftflow-order-card-meta">
            <span>{{ side === 'BUYER' ? `创作者 ${row.creatorNickname}` : `买家 ${row.buyerNickname}` }}</span>
            <span v-if="row.orderType === 'CUSTOM' && row.durationDays">{{ row.durationDays }} 天工期</span>
          </span>
          <span
            v-if="row.shippingOverdue"
            class="craftflow-order-card-overdue"
          >发货已超期</span>
          <span
            v-else-if="row.status === 'PENDING_PAY'"
            class="craftflow-order-card-meta"
          >付款截止 <time :datetime="row.payDeadlineAt">{{ formatTime(row.payDeadlineAt) }}</time></span>
          <span
            v-else-if="row.shippedAt"
            class="craftflow-order-card-meta"
          >发货于 <time :datetime="row.shippedAt">{{ formatTime(row.shippedAt) }}</time></span>
          <span
            v-else-if="row.orderType === 'STOCK' && row.shipDeadlineAt"
            class="craftflow-order-card-meta"
          >发货截止 <time :datetime="row.shipDeadlineAt">{{ formatTime(row.shipDeadlineAt) }}</time></span>
          <span
            v-else-if="row.orderType === 'CUSTOM' && row.shipDate"
            class="craftflow-order-card-meta"
          >约定发货 <time :datetime="row.shipDate">{{ row.shipDate }}</time></span>
          <span
            v-else
            class="craftflow-order-card-meta"
          >创建于 <time :datetime="row.createdAt">{{ formatTime(row.createdAt) }}</time></span>
        </RouterLink>
      </li>
    </ul>
    <WorkPagination
      :page="page"
      :total="total"
      :size="size"
      :loading="loading"
      aria-label="订单分页"
      @change="nextPage"
    />
  </section>
</template>
