<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getAdminRefunds } from '@/api/refund'
import type { AdminRefundQueueVO } from '@/types/refund'
import { refundReasons, refundStatuses } from '@/utils/refund'
import { formatTime } from '@/utils/creator'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { ApiError } from '@/utils/request'
import '@/assets/styles/quote.css'
import '@/assets/styles/refund.css'
const route = useRoute(); const router = useRouter(); const auth = useAuthStore(); const notifications = useNotificationsStore()
const rows = ref<AdminRefundQueueVO[]>([]); const total = ref(0); const page = ref(1); const status = ref('WAIT_ADMIN'); const applicationType = ref('NORMAL'); const orderNo = ref(''); const createdFrom = ref(''); const createdTo = ref(''); const minAmount = ref(''); const maxAmount = ref(''); const loading = ref(false); const error = ref('')
let revision = 0
/** 队列条件保存到URL，选择申请及返回时保留筛选与页码。 */
async function filter(next = 1) {
  const target = { path: '/admin/refunds', query: { status: status.value || 'ALL', applicationType: applicationType.value || 'ALL', orderNo: orderNo.value.trim() || undefined, createdFrom: createdFrom.value || undefined, createdTo: createdTo.value || undefined, minAmount: minAmount.value || undefined, maxAmount: maxAmount.value || undefined, page: next > 1 ? String(next) : undefined } }
  if (router.resolve(target).fullPath === route.fullPath) void load(next)
  else await router.push(target)
}
async function load(next = page.value) {
  const userId = auth.session?.userId; if (!userId || !auth.session?.roles.includes('ADMIN')) { rows.value = []; return }
  const current = ++revision; loading.value = true; error.value = ''; page.value = next
  try { const result = await getAdminRefunds({ status: status.value || 'ALL', applicationType: applicationType.value || 'ALL', orderNo: orderNo.value.trim(), createdFrom: createdFrom.value || undefined, createdTo: createdTo.value || undefined, minAmount: minAmount.value || undefined, maxAmount: maxAmount.value || undefined, page: next }); if (current === revision && userId === auth.session?.userId && auth.session?.roles.includes('ADMIN')) { rows.value = result.items; total.value = result.total } }
  catch (failure) { if (current === revision && userId === auth.session?.userId) { if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) rows.value = []; error.value = failure instanceof Error ? failure.message : '售后队列读取失败' } }
  finally { if (current === revision) loading.value = false }
}
function refresh() { void load() }
function visible() { if (document.visibilityState === 'visible') refresh() }
watch([() => route.query, () => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], () => {
  revision++; if (!auth.session?.roles.includes('ADMIN')) { rows.value = []; total.value = 0; loading.value = false; return }
  status.value = route.query.status === 'ALL' ? '' : ['WAIT_ADMIN', 'REFUNDED', 'REJECTED', 'WITHDRAWN'].includes(String(route.query.status)) ? String(route.query.status) : 'WAIT_ADMIN'
  applicationType.value = route.query.applicationType === 'ALL' ? '' : route.query.applicationType === 'NO_START_TIMEOUT' ? 'NO_START_TIMEOUT' : 'NORMAL'
  orderNo.value = typeof route.query.orderNo === 'string' ? route.query.orderNo : ''; createdFrom.value = typeof route.query.createdFrom === 'string' ? route.query.createdFrom : ''; createdTo.value = typeof route.query.createdTo === 'string' ? route.query.createdTo : ''; minAmount.value = typeof route.query.minAmount === 'string' ? route.query.minAmount : ''; maxAmount.value = typeof route.query.maxAmount === 'string' ? route.query.maxAmount : ''; page.value = Math.max(1, Number(route.query.page) || 1); void load()
}, { immediate: true })
watch(() => notifications.connected, (value, old) => { if (value && !old) refresh() })
onMounted(() => { window.addEventListener('order-updated', refresh); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible) })
onBeforeUnmount(() => { revision++; window.removeEventListener('order-updated', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) })
</script>
<template>
  <AdminLayout title="售后与退款">
    <template #actions>
      <button
        class="button-secondary"
        :disabled="loading"
        @click="load()"
      >
        刷新售后队列
      </button>
    </template>
    <div
      class="admin-review-grid"
      :class="{ 'has-selection': !!route.params.id }"
    >
      <section
        class="review-queue"
        aria-label="售后申请队列"
      >
        <header class="review-queue-heading">
          <h2>售后申请</h2><span>{{ total }} 条记录</span>
        </header>
        <form
          class="refund-filters"
          @submit.prevent="filter()"
        >
          <label class="work-field">申请状态<select
            v-model="status"
            aria-label="申请状态"
          ><option value="">全部状态</option><option
            v-for="(label, value) in refundStatuses"
            :key="value"
            :value="value"
          >{{ label }}</option></select></label>
          <label class="work-field">申请类型<select
            v-model="applicationType"
            aria-label="申请类型"
          ><option value="NORMAL">普通退款</option><option value="NO_START_TIMEOUT">系统无责退款</option><option value="">全部类型</option></select></label>
          <label class="work-field">订单编号<input
            v-model="orderNo"
            aria-label="按订单编号筛选"
            placeholder="输入订单编号"
          ></label><label class="work-field">申请创建时间从<input v-model="createdFrom" type="datetime-local"></label><label class="work-field">至<input v-model="createdTo" type="datetime-local"></label><label class="work-field">金额从<input v-model="minAmount" type="number" min="0" step="0.01"></label><label class="work-field">至<input v-model="maxAmount" type="number" min="0" step="0.01"></label><button class="button-secondary">
            筛选申请
          </button>
        </form>
        <p
          v-if="error"
          class="form-alert"
          role="alert"
        >
          {{ error }}
        </p><p
          v-if="loading"
          role="status"
        >
          正在读取售后队列…
        </p>
        <div
          v-if="!rows.length && !loading && !error"
          class="work-empty"
        >
          <h3>当前条件下暂无售后申请</h3>
        </div>
        <div class="managed-work-list">
          <article
            v-for="item in rows"
            :key="item.id"
            class="managed-work-row"
            :class="{ selected: route.params.id === item.id }"
          >
            <div class="managed-work-copy">
              <span class="work-status">{{ refundStatuses[item.status] || item.status }}</span><h3>{{ item.title }}</h3><p>{{ item.orderNo }} · {{ item.applicationType === 'NORMAL' ? refundReasons[item.reasonCode] : '系统无责退款' }}</p><p>¥ {{ item.totalAmount }} · {{ formatTime(item.createdAt) }}</p>
            </div><RouterLink :to="{ path: `/admin/refunds/${item.id}`, query: route.query }">{{ item.status === 'WAIT_ADMIN' ? '查证与裁定' : '查看记录' }} ↗</RouterLink>
          </article>
        </div>
        <WorkPagination
          :page="page"
          :total="total"
          :loading="loading"
          @change="filter"
        />
      </section>
      <section
        class="review-detail"
        aria-label="当前售后查证"
      >
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :key="`${auth.session?.userId}-${route.params.id}`"
            @reviewed="load()"
          />
        </RouterView><div
          v-if="!route.params.id"
          class="review-placeholder"
        >
          <h2>选择申请查看约定、履约和证据</h2><p>核查双方材料后，由一名管理员作出结论。</p>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>
