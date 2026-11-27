<script setup lang="ts">
import { useActivationRead } from '@/utils/pageActivation'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AdminDateRange from '@/components/AdminDateRange.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { useHistoryReturn } from '@/composables/useHistoryReturn'
import { getAdminRefunds } from '@/api/refund'
import type { AdminRefundQueueVO } from '@/types/refund'
import { refundReasons, refundStatuses } from '@/utils/refund'
import { formatTime } from '@/utils/creator'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { ApiError } from '@/utils/request'
import '@/assets/styles/quote.css'
import '@/assets/styles/refund.css'
const route = useRoute()
const router = useRouter()
const { entry } = useHistoryReturn()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const rows = ref<AdminRefundQueueVO[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const queryKeys = ['status', 'applicationType', 'orderNo', 'createdFrom', 'createdTo', 'minAmount', 'maxAmount', 'page'] as const
function readQuery(key: string) {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}
const filters = computed(() => {
  const status = readQuery('status')
  const applicationType = readQuery('applicationType')
  return {
    status: Object.hasOwn(refundStatuses, status) || status === 'ALL' ? status : 'WAIT_ADMIN',
    applicationType: applicationType === 'ALL' || applicationType === 'NO_START_TIMEOUT' ? applicationType : 'NORMAL',
    orderNo: readQuery('orderNo'),
    createdFrom: readQuery('createdFrom'),
    createdTo: readQuery('createdTo'),
    minAmount: readQuery('minAmount'),
    maxAmount: readQuery('maxAmount'),
  }
})
const draft = ref({ ...filters.value, status: '', applicationType: '' })
const page = computed(() => {
  const value = Number(readQuery('page'))
  return Number.isSafeInteger(value) && value > 0 ? value : 1
})
let revision = 0
/** 数字输入可能被 Vue 转为 number，金额 0 仍是有效筛选条件。 */
function amountQuery(value: string | number) {
  return value === '' ? undefined : String(value)
}
function resetDraft() {
  const { status, applicationType } = filters.value
  draft.value = {
    ...filters.value,
    status: status === 'ALL' ? '' : status,
    applicationType: applicationType === 'ALL' ? '' : applicationType,
  }
}
/** 仅提交表单时应用筛选草稿。翻页、会话重连和焦点刷新使用地址栏中的条件。 */
async function showPage(next: number, values = filters.value) {
  const target = {
    path: '/admin/refunds',
    query: {
      status: values.status || 'ALL',
      applicationType: values.applicationType || 'ALL',
      orderNo: values.orderNo.trim() || undefined,
      createdFrom: values.createdFrom || undefined,
      createdTo: values.createdTo || undefined,
      minAmount: amountQuery(values.minAmount),
      maxAmount: amountQuery(values.maxAmount),
      page: next > 1 ? String(next) : undefined,
    },
  }
  if (router.resolve(target).fullPath === route.fullPath) {
    if (values === draft.value) resetDraft()
    void load()
  } else await router.push(target)
}
async function load() {
  const userId = auth.session?.userId
  if (!userId || !auth.session?.roles.includes('ADMIN')) return
  const current = ++revision
  const { status, applicationType, orderNo, createdFrom, createdTo, minAmount, maxAmount } = filters.value
  loading.value = true
  error.value = ''
  try {
    const result = await getAdminRefunds({
      status, applicationType, orderNo: orderNo.trim(),
      createdFrom: createdFrom || undefined, createdTo: createdTo || undefined,
      minAmount: amountQuery(minAmount), maxAmount: amountQuery(maxAmount),
      page: page.value,
    })
    if (current !== revision || userId !== auth.session?.userId || !auth.session?.roles.includes('ADMIN')) return
    rows.value = result.items
    total.value = result.total
  } catch (failure) {
    if (current !== revision || userId !== auth.session?.userId) return
    if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) {
      rows.value = []
      total.value = 0
    }
    error.value = failure instanceof Error ? failure.message : '售后队列读取失败'
  } finally {
    if (current === revision) loading.value = false
  }
}
function refresh() { void load() }
// 队列和详情共享筛选。只在条件或身份变化时丢弃旧列表和筛选草稿。
watch([...queryKeys.map(key => () => route.query[key]), () => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], () => {
  revision++
  rows.value = []
  total.value = 0
  loading.value = false
  error.value = ''
  resetDraft()
  if (!auth.session?.roles.includes('ADMIN')) return
  void load()
}, { immediate: true, flush: 'sync' })
watch(() => notifications.connected, (value, old) => { if (value && !old) refresh() })
onMounted(() => { window.addEventListener('order-updated', refresh) })
onBeforeUnmount(() => { revision++; window.removeEventListener('order-updated', refresh) })
useActivationRead(() => JSON.stringify([auth.session?.userId, filters.value, page.value]), load)
</script>
<template>
  <AdminLayout title="售后与退款">
    <div
      class="admin-review-grid admin-refund-workspace"
      :class="{ 'has-selection': !!route.params.id }"
    >
      <section
        class="review-queue"
        aria-label="售后申请队列"
        :aria-busy="loading"
        :data-history-view="!route.params.id ? route.fullPath : undefined"
        :data-history-ready="!route.params.id && !loading ? route.fullPath : undefined"
      >
        <header class="review-queue-heading">
          <h2>售后申请</h2><span>{{ total }} 条记录</span>
        </header>
        <form
          class="refund-filters"
          @submit.prevent="showPage(1, draft)"
        >
          <label class="work-field">申请状态<select
            v-model="draft.status"
            aria-label="申请状态"
          ><option value="">全部状态</option><option
            v-for="(label, value) in refundStatuses"
            :key="value"
            :value="value"
          >{{ label }}</option></select></label>
          <label class="work-field">申请类型<select
            v-model="draft.applicationType"
            aria-label="申请类型"
          ><option value="NORMAL">普通退款</option><option value="NO_START_TIMEOUT">系统无责退款</option><option value="">全部类型</option></select></label>
          <label class="work-field refund-order-filter">订单编号<input
            v-model="draft.orderNo"
            aria-label="按订单编号筛选"
            type="search"
            maxlength="32"
            placeholder="输入订单编号"
          ></label>
          <AdminDateRange
            v-model:from="draft.createdFrom"
            v-model:to="draft.createdTo"
            label="申请时间"
          />
          <label class="work-field">金额从<input
            v-model="draft.minAmount"
            type="number"
            min="0"
            step="0.01"
          ></label><label class="work-field">金额至<input
            v-model="draft.maxAmount"
            type="number"
            min="0"
            step="0.01"
          ></label><button
            class="button-primary"
            type="submit"
          >
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
          v-if="loading && !rows.length"
          class="account-loading"
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
        <div
          v-if="rows.length"
          class="managed-work-list"
          data-history-scroll="admin-refunds-queue"
        >
          <article
            v-for="item in rows"
            :key="item.id"
            class="managed-work-row refund-queue-row"
            :class="{ selected: route.params.id === item.id }"
          >
            <div class="managed-work-copy">
              <span
                class="work-status refund-status"
                :data-status="item.status"
              >{{ refundStatuses[item.status] || item.status }}</span><h3>{{ item.title }}</h3><p>{{ item.orderNo }} · {{ item.orderType === 'STOCK' ? '现货直购' : '定制订单' }} · {{ item.applicationType === 'NORMAL' ? refundReasons[item.reasonCode] : '系统无责退款' }}</p><time>{{ formatTime(item.createdAt) }}</time>
            </div><div class="refund-queue-action">
              <strong>¥ {{ item.totalAmount }}</strong><RouterLink
                class="text-link"
                :aria-current="route.params.id === item.id ? 'true' : undefined"
                :to="entry({ path: `/admin/refunds/${item.id}`, query: route.query })"
                :data-history-focus="`admin-refund-${item.id}`"
              >{{ item.status === 'WAIT_ADMIN' ? '查证与裁定' : '查看记录' }} ↗</RouterLink>
            </div>
          </article>
        </div>
        <WorkPagination
          label="售后队列分页"
          :page="page"
          :total="total"
          :loading="loading"
          @change="showPage"
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
          <AppIcon name="shield" /><h2>选择申请查看约定、履约和证据</h2>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>
