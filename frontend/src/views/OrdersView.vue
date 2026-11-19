<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getOrders } from '@/api/quote'
import type { OrderVO } from '@/types/quote'
import { orderStatus } from '@/utils/quote'
import { formatTime } from '@/utils/creator'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import '@/assets/styles/custom-request.css'
import '@/assets/styles/quote.css'
const route = useRoute(); const router = useRouter(); const auth = useAuthStore(); const notifications = useNotificationsStore()
const side = ref(route.query.side === 'CREATOR' ? 'CREATOR' : 'BUYER'); const status = ref('')
const rows = ref<OrderVO[]>([]); const page = ref(1); const total = ref(0); const loading = ref(false); const error = ref('')
let revision = 0
/** 买家和创作者分别使用服务端参与方过滤，不在浏览器按昵称判断归属。 */
async function load(next = page.value) {
  if (!auth.session) return
  const current = ++revision; page.value = next; loading.value = true; error.value = ''
  try {
    const result = await getOrders({ side: side.value, status: status.value || undefined, page: next })
    if (current === revision) { rows.value = result.items; total.value = result.total }
  } catch (failure) { if (current === revision) { rows.value = []; error.value = failure instanceof Error ? failure.message : '订单读取失败' } }
  finally { if (current === revision) loading.value = false }
}
function refresh() { void load() }
/** 推送可能在断线时遗漏，窗口恢复或重连后查询持久化订单。 */
function visible() { if (document.visibilityState === 'visible') refresh() }
watch(() => route.query.side, () => { side.value = route.query.side === 'CREATOR' ? 'CREATOR' : 'BUYER'; void load(1) })
watch(() => auth.session?.userId, () => { revision++; rows.value = []; total.value = 0; if (auth.session) void load(1) }, { flush: 'sync' })
watch(() => notifications.connected, (connected, previous) => { if (connected && !previous) refresh() })
onMounted(() => { refresh(); window.addEventListener('order-updated', refresh); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible) })
onBeforeUnmount(() => { revision++; window.removeEventListener('order-updated', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) })
</script>
<template>
  <WorkLayout>
    <header class="work-section-heading">
      <div>
        <p class="eyebrow">
          MADE FOR YOU
        </p><h1>我的订单</h1><p class="muted">
          查看合作方案、收货约定与订单记录。
        </p>
      </div><RouterLink to="/my-requests">我的需求 ↗</RouterLink>
    </header>
    <form
      class="request-filters"
      @submit.prevent="load(1)"
    >
      <label>订单身份<select
        v-model="side"
        aria-label="订单身份"
        @change="router.replace({ query: { side } })"
      ><option value="BUYER">我购买的</option><option value="CREATOR">我承接的</option></select></label><label>订单状态<select
        v-model="status"
        aria-label="订单状态"
        @change="load(1)"
      ><option value="">全部状态</option><option
        v-for="(label, value) in orderStatus"
        :key="value"
        :value="value"
      >{{ label }}</option></select></label><button
        class="button-secondary"
        :disabled="loading"
      >
        刷新订单
      </button>
    </form>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p><p
      v-if="loading && !rows.length"
      role="status"
    >
      正在读取订单…
    </p><div
      v-else-if="!rows.length && !error"
      class="creator-empty"
    >
      <h2>暂无订单</h2><p>选定需求报价并确认收货地址后，订单会显示在这里。</p>
    </div>
    <div class="request-list">
      <article
        v-for="order in rows"
        :key="order.id"
        class="request-card"
      >
        <header><span class="field-help">订单号 {{ order.orderNo }}</span><span class="work-status">{{ orderStatus[order.status] || order.status }}</span></header><h2><RouterLink :to="`/orders/${order.id}`">{{ order.title }}</RouterLink></h2><p class="muted">
          {{ side === 'BUYER' ? `创作者 ${order.creatorNickname}` : `买家 ${order.buyerNickname}` }} · 工期 {{ order.durationDays }} 个自然日
        </p><footer><strong class="quote-amount">¥ {{ order.totalAmount }}</strong><span>{{ order.status === 'PENDING_PAY' ? `付款截止 ${formatTime(order.payDeadlineAt)}` : `创建于 ${formatTime(order.createdAt)}` }}</span><RouterLink :to="`/orders/${order.id}`">查看订单 ↗</RouterLink></footer>
        <p
          v-if="order.shippingOverdue"
          class="shipping-warning"
        >
          已超过约定发货截止时间
        </p>
        <p
          v-else-if="order.shipDate"
          class="field-help"
        >
          约定发货日 {{ order.shipDate }}<template v-if="order.shippedAt">
            · 已于 {{ formatTime(order.shippedAt) }} 发货
          </template>
        </p>
      </article>
    </div><WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </WorkLayout>
</template>
