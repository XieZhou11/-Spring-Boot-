<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getAdminOrder, getAdminOrders } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { AdminOrderDetailVO, AdminOrderVO } from '@/types/admin'
import type { AgreementSnapshot } from '@/types/quote'
import { formatTime } from '@/utils/creator'
import { orderStatus as statusLabels, progressNodeName, progressNodeStatus, settlementStatus } from '@/utils/quote'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const adminId = computed(() => auth.session?.roles.includes('ADMIN') ? auth.session.userId : undefined)
const orderTypes = { STOCK: '现货', CUSTOM: '定制' }
const attentionLabels = { AFTER_SALE: '售后中', START_OVERDUE: '开工超期', SHIPPING_OVERDUE: '发货超期' }
const flowLabels: Record<string, string> = { PAYMENT: '模拟支付', REFUND: '模拟退款', SETTLEMENT: '模拟结算' }
const recordLabels: Record<string, string> = { CHECK_IN: '打卡', SKIP: '跳过', SUPPLEMENT: '补充记录' }

function readQuery(key: string) {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const deepOrderId = computed(() => readQuery('orderId'))
const filters = computed(() => {
  const status = readQuery('status')
  const orderType = readQuery('orderType')
  return {
    orderNo: readQuery('orderNo'),
    status: Object.hasOwn(statusLabels, status) ? status : 'ALL',
    orderType: Object.hasOwn(orderTypes, orderType) ? orderType : 'ALL',
    createdFrom: readQuery('createdFrom'),
    createdTo: readQuery('createdTo'),
    minAmount: readQuery('minAmount'),
    maxAmount: readQuery('maxAmount'),
  }
})
const draft = ref({ ...filters.value })
const page = computed(() => {
  const value = Number(readQuery('page'))
  return Number.isInteger(value) && value > 0 && value <= 1_000_000 ? value : 1
})
const rows = ref<AdminOrderVO[]>([])
const detail = ref<AdminOrderDetailVO>()
const total = ref(0)
const loading = ref(false)
const error = ref('')
const detailLoading = ref(false)
const detailError = ref('')
let listRevision = 0
let detailRevision = 0

const agreement = computed(() => detail.value?.order.agreementSnapshot as Partial<AgreementSnapshot> | undefined)
const address = computed(() => {
  const snapshot = detail.value?.order.addressSnapshot
  if (!snapshot) return ''
  return [snapshot.province, snapshot.city, snapshot.district, snapshot.detailAddress].filter(Boolean).join(' ')
})
const refundLink = computed(() => ({
  name: 'admin-refunds',
  query: { status: 'ALL', applicationType: 'ALL', orderNo: detail.value?.order.orderNo },
}))
const refundDetailLink = computed(() => {
  const applicationId = detail.value?.refundApplicationId
  if (!applicationId) return undefined
  // 从查证页返回时保留本单的售后队列筛选。
  return { ...refundLink.value, name: 'admin-refund-detail', params: { id: applicationId } }
})

function listQuery(next = page.value, source = filters.value) {
  return {
    orderNo: source.orderNo.trim() || undefined,
    status: source.status === 'ALL' ? undefined : source.status,
    orderType: source.orderType === 'ALL' ? undefined : source.orderType,
    createdFrom: source.createdFrom || undefined,
    createdTo: source.createdTo || undefined,
    minAmount: source.minAmount || undefined,
    maxAmount: source.maxAmount || undefined,
    page: next > 1 ? String(next) : undefined,
  }
}

function orderLink(id: string) {
  return { name: 'admin-orders', query: { orderId: id, ...listQuery() } }
}

const returnTarget = computed(() => {
  const { status, orderNo, createdFrom, createdTo, minAmount, maxAmount, page: previousPage } = route.query
  if (route.query.from === 'settlements') {
    return { label: '返回资金记录', to: { name: 'admin-settlements', query: { status, orderNo, createdFrom, createdTo, minAmount, maxAmount, page: previousPage } } }
  }
  if (route.query.from === 'users') {
    const { userId, email, nickname, certificationStatus } = route.query
    return { label: '返回用户管理', to: { name: 'admin-users', query: { userId, email, nickname, certificationStatus, page: previousPage } } }
  }
  return { label: '返回订单查询', to: { name: 'admin-orders', query: listQuery() } }
})

async function applyFilters() {
  const target = { name: 'admin-orders', query: listQuery(1, draft.value) }
  if (router.resolve(target).fullPath === route.fullPath) void load()
  else await router.replace(target)
}

function changePage(next: number) {
  void router.push({ name: 'admin-orders', query: listQuery(next) })
}

/** 订单队列和只读详情分别加载，旧响应不会覆盖深链接或新身份。 */
async function load() {
  const userId = adminId.value
  if (!userId || deepOrderId.value) return
  const current = ++listRevision
  loading.value = true
  error.value = ''
  try {
    const result = await getAdminOrders({ ...listQuery(), page: page.value })
    if (current !== listRevision || adminId.value !== userId) return
    rows.value = result.items
    total.value = result.total
  } catch (failure) {
    if (current === listRevision && adminId.value === userId) error.value = failure instanceof Error ? failure.message : '订单查询失败'
  } finally {
    if (current === listRevision) loading.value = false
  }
}

async function loadDetail() {
  const userId = adminId.value
  const id = deepOrderId.value
  const current = ++detailRevision
  detail.value = undefined
  detailError.value = ''
  detailLoading.value = false
  if (!userId || !id) return
  if (!/^[1-9]\d{0,18}$/.test(id)) {
    detailError.value = '订单编号无效'
    return
  }
  detailLoading.value = true
  try {
    const result = await getAdminOrder(id)
    if (current === detailRevision && adminId.value === userId) detail.value = result
  } catch (failure) {
    if (current === detailRevision && adminId.value === userId) detailError.value = failure instanceof Error ? failure.message : '订单详情读取失败'
  } finally {
    if (current === detailRevision) detailLoading.value = false
  }
}

watch([() => route.query, adminId], () => {
  listRevision++
  rows.value = []
  total.value = 0
  loading.value = false
  error.value = ''
  draft.value = { ...filters.value }
  void loadDetail()
  void load()
}, { immediate: true })
</script>

<template>
  <AdminLayout title="订单查询">
    <template #actions>
      <RouterLink
        v-if="deepOrderId"
        class="button-secondary"
        :to="returnTarget.to"
      >{{ returnTarget.label }}</RouterLink>
    </template>
    <template v-if="!deepOrderId">
      <form
        class="order-filters"
        @submit.prevent="applyFilters"
      >
        <label>订单编号<input
          v-model="draft.orderNo"
          maxlength="32"
          placeholder="包含匹配"
        ></label>
        <label>订单类型<select v-model="draft.orderType"><option value="ALL">全部类型</option><option
          v-for="(label, key) in orderTypes"
          :key="key"
          :value="key"
        >{{ label }}</option></select></label>
        <label>订单状态<select v-model="draft.status"><option value="ALL">全部状态</option><option
          v-for="(label, key) in statusLabels"
          :key="key"
          :value="key"
        >{{ label }}</option></select></label>
        <label>创建时间从<input
          v-model="draft.createdFrom"
          type="datetime-local"
        ></label>
        <label>创建时间至<input
          v-model="draft.createdTo"
          type="datetime-local"
        ></label>
        <label>金额从<input
          :value="draft.minAmount"
          type="number"
          min="0"
          max="9999999999.99"
          step="0.01"
          @input="draft.minAmount = ($event.target as HTMLInputElement).value"
        ></label>
        <label>金额至<input
          :value="draft.maxAmount"
          type="number"
          min="0"
          max="9999999999.99"
          step="0.01"
          @input="draft.maxAmount = ($event.target as HTMLInputElement).value"
        ></label>
        <button
          class="button-primary"
          :disabled="loading"
        >
          查询订单
        </button>
      </form>
      <p
        v-if="error"
        class="form-alert"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-else-if="loading && !rows.length"
        role="status"
      >
        正在读取订单…
      </p>
      <div
        v-else-if="!rows.length"
        class="order-panel order-empty"
      >
        <h2>没有匹配订单</h2>
      </div>
      <section
        v-else
        class="order-panel order-queue"
        aria-label="订单列表"
      >
        <header><h2>订单列表</h2><span>共 {{ total }} 笔，售后与超期订单优先</span></header>
        <div class="order-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  订单编号
                </th><th scope="col">
                  标题
                </th><th scope="col">
                  类型 / 状态
                </th><th scope="col">
                  成交金额
                </th><th scope="col">
                  交易双方
                </th><th scope="col">
                  创建时间
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.orderId"
              >
                <td>
                  <RouterLink
                    class="text-link"
                    :to="orderLink(row.orderId)"
                  >{{ row.orderNo }}</RouterLink>
                </td>
                <td>{{ row.title }}</td>
                <td><span>{{ row.orderType === 'STOCK' ? '现货' : '定制' }}</span><small :class="{ 'order-attention': row.attention }">{{ row.attention ? attentionLabels[row.attention] : statusLabels[row.status] || row.status }}</small></td>
                <td class="order-money">
                  ¥ {{ row.amount }}
                </td>
                <td>{{ row.buyerNickname }}<small>{{ row.creatorNickname }}</small></td>
                <td>{{ formatTime(row.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <WorkPagination
          label="订单分页"
          :page="page"
          :total="total"
          :loading="loading"
          @change="changePage"
        />
      </section>
    </template>
    <p
      v-if="detailLoading"
      role="status"
    >
      正在读取订单详情…
    </p>
    <template v-else-if="detailError">
      <p
        class="form-alert"
        role="alert"
      >
        {{ detailError }}
      </p><button
        class="button-secondary"
        @click="loadDetail"
      >
        重新读取
      </button>
    </template>
    <template v-else-if="detail">
      <header class="order-panel order-overview">
        <div><h2>订单详情 · {{ detail.order.orderNo }}</h2><p>{{ detail.order.title }}</p></div>
        <div>
          <span
            class="status-pill"
            :data-status="detail.order.status"
          >{{ statusLabels[detail.order.status] || detail.order.status }}</span><strong class="order-money">¥ {{ detail.order.totalAmount }}</strong>
        </div>
      </header>
      <div class="order-detail-grid">
        <section class="order-panel">
          <header><h3>订单与约定</h3><span>{{ orderTypes[detail.orderType] }}</span></header>
          <dl class="order-facts">
            <div><dt>买家</dt><dd>{{ detail.order.buyerNickname || '—' }} · #{{ detail.order.buyerId }}</dd></div>
            <div><dt>创作者</dt><dd>{{ detail.order.creatorNickname || '—' }} · #{{ detail.order.creatorId }}</dd></div>
            <div v-if="detail.order.requestId">
              <dt>需求编号</dt><dd>#{{ detail.order.requestId }}</dd>
            </div>
            <div v-if="detail.order.quoteId">
              <dt>报价编号</dt><dd>#{{ detail.order.quoteId }}</dd>
            </div>
            <div v-if="agreement?.request?.materialPreference">
              <dt>材料</dt><dd>{{ agreement.request.materialPreference }}</dd>
            </div>
            <div v-if="agreement?.request?.specification">
              <dt>规格</dt><dd>{{ agreement.request.specification }}</dd>
            </div>
            <div v-if="agreement?.durationDays">
              <dt>约定工期</dt><dd>{{ agreement.durationDays }} 天</dd>
            </div>
            <div v-if="agreement?.expectedShipDate">
              <dt>期望发货</dt><dd>{{ agreement.expectedShipDate }}</dd>
            </div>
            <div v-if="agreement?.confirmedEstimatedShipDate">
              <dt>确认预计发货</dt><dd>{{ agreement.confirmedEstimatedShipDate }}</dd>
            </div>
          </dl>
          <div
            v-if="agreement?.request?.description"
            class="order-note"
          >
            <h4>{{ detail.orderType === 'CUSTOM' ? '需求说明' : '作品说明' }}</h4><p>{{ agreement.request.description }}</p>
          </div>
          <div
            v-if="agreement?.proposal"
            class="order-note"
          >
            <h4>{{ detail.orderType === 'CUSTOM' ? '中标方案' : '工艺说明' }}</h4><p>{{ agreement.proposal }}</p>
          </div>
          <div
            v-if="agreement?.additionalAgreement"
            class="order-note"
          >
            <h4>补充约定</h4><p>{{ agreement.additionalAgreement }}</p>
          </div>
        </section>
        <section class="order-panel">
          <header><h3>履约与物流</h3></header>
          <dl class="order-facts">
            <div><dt>付款时间</dt><dd>{{ formatTime(detail.order.paidAt) }}</dd></div>
            <div v-if="detail.orderType === 'CUSTOM'">
              <dt>确认开工</dt><dd>{{ formatTime(detail.order.startedAt) }}</dd>
            </div>
            <div><dt>最迟发货</dt><dd>{{ formatTime(detail.order.shipDeadlineAt) }}</dd></div>
            <div><dt>实际发货</dt><dd>{{ formatTime(detail.order.shippedAt) }}</dd></div>
            <div><dt>运单编号</dt><dd>{{ detail.order.trackingNo || '—' }}</dd></div>
            <div><dt>完成时间</dt><dd>{{ formatTime(detail.order.originalCompletedAt) }}</dd></div>
          </dl>
          <div
            v-if="address"
            class="order-note"
          >
            <h4>收货快照</h4><p>{{ detail.order.addressSnapshot.recipientName }} {{ detail.order.addressSnapshot.phone }}<br>{{ address }}</p>
          </div>
        </section>
        <section class="order-panel">
          <header>
            <h3>资金流水</h3><RouterLink
              class="text-link"
              :to="refundLink"
            >查看售后记录</RouterLink>
          </header>
          <p
            v-if="detail.order.settlement?.status"
            class="order-muted"
          >
            结算状态 · {{ settlementStatus[String(detail.order.settlement.status)] || detail.order.settlement.status }}
          </p>
          <p
            v-if="!detail.fundFlows.length"
            class="order-muted"
          >
            暂无成功流水
          </p>
          <ul
            v-else
            class="order-records"
          >
            <li
              v-for="(flow, index) in detail.fundFlows"
              :key="flow.flowNo || index"
            >
              <div><strong>{{ flowLabels[flow.type] || flow.type }}</strong><strong class="order-money">¥ {{ flow.amount }}</strong></div>
              <small>{{ formatTime(flow.occurredAt) }}<span v-if="flow.flowNo"> · {{ flow.flowNo }}</span></small>
            </li>
          </ul>
        </section>
        <section class="order-panel">
          <header>
            <h3>会话摘要</h3>
            <RouterLink
              v-if="refundDetailLink"
              class="text-link"
              :to="refundDetailLink"
            >前往售后查证</RouterLink>
          </header>
          <p
            v-if="!detail.conversationSummary"
            class="order-muted"
          >
            暂无关联会话
          </p>
          <dl
            v-else
            class="order-facts"
          >
            <div><dt>会话编号</dt><dd>{{ detail.conversationSummary.conversationId }}</dd></div>
            <div>
              <dt>最近消息</dt><dd>{{ detail.conversationSummary.lastMessageSeq === '0' ? '暂无消息' : formatTime(detail.conversationSummary.lastMessageAt) }}</dd>
            </div>
            <div>
              <dt>归档状态</dt><dd>{{ detail.conversationSummary.archivedAt ? `已归档 · ${formatTime(detail.conversationSummary.archivedAt)}` : '未归档' }}</dd>
            </div>
          </dl>
        </section>
        <section
          v-if="detail.orderType === 'CUSTOM'"
          class="order-panel order-progress"
        >
          <header><h3>制作记录</h3></header>
          <p
            v-if="!detail.order.progressNodes.length"
            class="order-muted"
          >
            暂无制作节点
          </p>
          <ol
            v-else
            class="order-nodes"
          >
            <li
              v-for="node in detail.order.progressNodes"
              :key="node.id"
            >
              <h4>{{ progressNodeName[node.nodeCode] || node.nodeCode }}</h4>
              <p :class="{ 'order-attention': node.overdue }">
                {{ progressNodeStatus[node.status] || node.status }}<span v-if="node.overdue"> · 计划超期</span>
              </p>
              <small v-if="node.plannedFinishDate">计划 {{ node.plannedFinishDate }}</small>
              <small v-if="node.handledAt">处理 {{ formatTime(node.handledAt) }}</small>
              <ul class="order-records">
                <li
                  v-for="record in node.records"
                  :key="record.id"
                >
                  <small>{{ recordLabels[record.recordType] || record.recordType }} · {{ formatTime(record.createdAt) }}</small>
                  <p v-if="record.content || record.skipReason">
                    {{ record.content || record.skipReason }}
                  </p>
                  <small v-if="record.imageIds.length">附件图片 {{ record.imageIds.length }} 张</small>
                </li>
              </ul>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </AdminLayout>
</template>

<style scoped>
.order-filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: end; gap: 10px; margin-bottom: 16px; }
.order-filters label { display: grid; gap: 4px; color: var(--craft-muted); font-size: 12px; font-weight: 600; }
.order-filters :is(input, select) { width: 100%; min-width: 0; min-height: 36px; padding: 6px 10px; border: 1px solid var(--craft-border); border-radius: 8px; background: var(--craft-surface); color: var(--craft-ink); font: inherit; }
.order-filters button { justify-self: start; }
.order-panel { min-width: 0; padding: 16px; border: 1px solid var(--craft-border); border-radius: 14px; background: var(--craft-surface); }
.order-panel > header, .order-overview, .order-records li > div { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.order-panel > header { margin-bottom: 9px; }
.order-panel h2, .order-panel h3, .order-panel h4 { margin: 0; color: var(--craft-ink); }
.order-panel h2, .order-panel h3 { font-size: 15px; overflow-wrap: anywhere; }
.order-panel h4 { font-size: 13px; }
.order-panel header span, .order-muted, .order-panel small { color: var(--craft-muted); font-size: 12px; }
.order-empty { padding: 28px 16px; text-align: center; }
.order-table-wrap { overflow: auto; }
.order-queue table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
.order-queue th { white-space: nowrap; color: var(--craft-muted); background: var(--craft-bg); font-weight: 600; }
.order-queue :is(td, th) { padding: 9px 8px; border-bottom: 1px solid var(--craft-border); }
.order-queue td:first-child { width: 19%; overflow-wrap: anywhere; }
.order-queue td small { display: block; padding-top: 3px; }
.order-queue td .order-attention, .order-attention { color: #92400e; font-weight: 650; }
.order-money { white-space: nowrap; font-variant-numeric: tabular-nums; }
.order-overview { margin-bottom: 14px; align-items: center; }
.order-overview > div:last-child { display: flex; align-items: center; gap: 8px; }
.order-overview p { margin: 5px 0 0; color: var(--craft-muted); }
.order-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 14px; }
.order-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin: 0; }
.order-facts div { padding: 8px 9px; border-radius: 7px; background: var(--craft-bg); font-size: 12px; }
.order-facts dt { color: var(--craft-muted); }
.order-facts dd { margin: 4px 0 0; overflow-wrap: anywhere; }
.order-note { margin-top: 10px; padding: 8px 0 0; border-top: 1px solid var(--craft-border); }
.order-note p, .order-records p { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
.order-records, .order-nodes { margin: 0; padding: 0; list-style: none; }
.order-records li { padding: 7px 0; border-bottom: 1px solid var(--craft-border); font-size: 12px; overflow-wrap: anywhere; }
.order-records li:last-child { border-bottom: 0; }
.order-progress { grid-column: 1 / -1; }
.order-nodes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.order-nodes > li { padding: 8px; border-radius: 7px; background: var(--craft-bg); }
.order-nodes > li > p { margin: 4px 0; font-size: 12px; }
.order-nodes > li > small { display: block; }
@media (max-width: 850px) {
  .order-detail-grid { grid-template-columns: 1fr; }
  .order-filters, .order-nodes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
