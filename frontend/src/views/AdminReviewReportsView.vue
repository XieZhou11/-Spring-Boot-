<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import PrivateImage from '@/components/PrivateImage.vue'
import QuoteImages from '@/components/QuoteImages.vue'
import ReportDecisionForm from '@/components/ReportDecisionForm.vue'
import ReportMaterials from '@/components/ReportMaterials.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { decideReviewReport, getAdminReviewReportMessages, getReviewReport, getReviewReports } from '@/api/review'
import { useAuthStore } from '@/stores/auth'
import { formatTime } from '@/utils/creator'
import { progressNodeName } from '@/utils/quote'
import { ApiError } from '@/utils/request'
import { reportReasons } from '@/utils/report'
import type { ReviewReportDecision } from '@/types/report'
import type { ChatMessageVO } from '@/types/customRequest'
import type { ReviewReportDetailVO, ReviewReportVO } from '@/types/review'
import '@/assets/styles/craftflow-reports.css'
import '@/assets/styles/quote.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const adminId = computed(() => auth.session?.roles.includes('ADMIN') ? auth.session.userId : undefined)
const status = computed(() => ['PENDING', 'PROCESSED', 'ALL'].includes(String(route.query.status)) ? String(route.query.status) : 'PENDING')
const page = computed(() => Math.min(1_000_000, Math.max(1, Math.floor(Number(route.query.page)) || 1)))
const selected = computed(() => typeof route.query.reportId === 'string' && /^\d+$/.test(route.query.reportId) ? route.query.reportId : '')
const rows = ref<ReviewReportVO[]>([])
const detail = ref<ReviewReportDetailVO>()
const total = ref(0)
const size = ref(20)
const loading = ref(false)
const loadingDetail = ref(false)
const queueError = ref('')
const detailError = ref('')
const notice = ref('')
const messages = ref<ChatMessageVO[]>([])
const moreMessagesAvailable = ref(false)
const loadingMessages = ref(false)
const messageError = ref('')
let queueRevision = 0
let detailRevision = 0
let messageRevision = 0
const labels: Record<ReviewReportDecision, string> = {
  NOT_UPHELD: '举报不成立', HIDE: '隐藏评价', DELETE: '删除评价', RESTORE: '更正并恢复评价',
}
const back = computed(() => ({
  name: 'admin-content-reports',
  query: { type: route.query.fromType, page: route.query.fromPage, status: route.query.fromStatus },
}))

function filter(nextStatus: string, nextPage = 1) {
  void router.push({ query: { ...route.query, status: nextStatus, page: nextPage > 1 ? String(nextPage) : undefined, reportId: undefined } })
}

async function loadQueue() {
  const current = ++queueRevision
  loading.value = true
  queueError.value = ''
  try {
    const result = await getReviewReports(status.value, page.value)
    if (current !== queueRevision) return
    rows.value = result.items
    total.value = result.total
    size.value = result.size
    const last = Math.max(1, Math.ceil(result.total / result.size))
    if (page.value > last) void router.replace({ query: { ...route.query, page: last > 1 ? String(last) : undefined } })
  } catch (failure) { if (current === queueRevision) queueError.value = failure instanceof Error ? failure.message : '评价举报队列读取失败' }
  finally { if (current === queueRevision) loading.value = false }
}

async function loadDetail() {
  const id = selected.value
  const current = ++detailRevision
  detailError.value = ''
  if (!id || !adminId.value) return
  loadingDetail.value = true
  try {
    const result = await getReviewReport(id)
    if (current === detailRevision) detail.value = result
  } catch (failure) {
    if (current !== detailRevision) return
    if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) detail.value = undefined
    detailError.value = failure instanceof Error ? failure.message : '评价举报详情读取失败'
  }
  finally { if (current === detailRevision) loadingDetail.value = false }
}

/** 在当前举报的权限上下文中读取一页会话，序号使用字符串去重。 */
async function loadMessages(before?: string) {
  const reportId = selected.value
  if (!reportId || !adminId.value || !detail.value?.conversationId || loadingMessages.value) return
  const current = ++messageRevision
  loadingMessages.value = true
  messageError.value = ''
  try {
    const page = await getAdminReviewReportMessages(reportId, { before, size: 20 })
    if (current !== messageRevision) return
    const bySeq = new Map<string, ChatMessageVO>()
    for (const message of [...(before ? messages.value : []), ...page.items]) {
      bySeq.set(message.seqNo, message)
    }
    messages.value = [...bySeq.values()].sort((a, b) => BigInt(a.seqNo) < BigInt(b.seqNo) ? -1 : 1)
    moreMessagesAvailable.value = page.hasMore
  } catch (failure) {
    if (current !== messageRevision) return
    if (failure instanceof ApiError && [401, 403, 404].includes(failure.status)) {
      messages.value = []
      moreMessagesAvailable.value = false
    }
    messageError.value = failure instanceof Error ? failure.message : '关联会话读取失败'
  } finally {
    if (current === messageRevision) loadingMessages.value = false
  }
}

function loadOlderMessages() {
  void loadMessages(messages.value[0]?.seqNo)
}

async function decide(decision: ReviewReportDecision, reason: string, expectedHistoryId: string) {
  const id = selected.value
  const scope = detailRevision
  try { await decideReviewReport(id, decision, reason, expectedHistoryId) }
  catch (failure) {
    if (scope === detailRevision && failure instanceof ApiError && failure.status === 409) await Promise.all([loadDetail(), loadQueue()])
    throw failure
  }
  if (scope !== detailRevision) return
  notice.value = '处置已保存。'
  await Promise.all([loadDetail(), loadQueue()])
}

async function verify(decision: ReviewReportDecision, reason: string, previousId?: string) {
  const scope = detailRevision
  const operatorId = auth.session?.userId
  const result = await getReviewReport(selected.value)
  if (scope !== detailRevision) return false
  detail.value = result
  void loadQueue()
  // 核验本次管理员提交，避免把他人相同裁定认成本次请求。
  const found = result.history.some(entry => entry.operatorId === operatorId
    && (!previousId || BigInt(entry.id) > BigInt(previousId))
    && entry.reason === reason
    && entry.detail?.decision === decision)
  if (found) notice.value = '已核对到本次处置。'
  return found
}

watch([status, page, () => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], () => { rows.value = []; total.value = 0; void loadQueue() }, { immediate: true })
watch([selected, adminId], () => {
  detail.value = undefined; notice.value = ''; loadingDetail.value = false
  void loadDetail()
}, { immediate: true, flush: 'sync' })
// 举报、账号或会话切换时撤下上一上下文的消息，并丢弃已经发出的请求结果。
watch(() => detail.value?.conversationId, conversationId => {
  messageRevision++
  messages.value = []
  moreMessagesAvailable.value = false
  loadingMessages.value = false
  messageError.value = ''
  if (conversationId) void loadMessages()
}, { flush: 'sync' })
onBeforeUnmount(() => { queueRevision++; detailRevision++; messageRevision++ })
</script>

<template>
  <AdminLayout title="评价举报">
    <RouterLink
      class="inline-button report-history-link"
      :to="back"
    >返回内容举报</RouterLink>
    <div class="report-admin-grid">
      <aside
        class="review-queue report-queue"
        aria-label="评价举报队列"
      >
        <div class="report-filters">
          <label>状态<select
            :value="status"
            aria-label="评价举报状态筛选"
            @change="filter(($event.target as HTMLSelectElement).value)"
          >
            <option value="PENDING">待处理</option><option value="PROCESSED">已处理</option><option value="ALL">全部</option>
          </select></label>
        </div>
        <p
          v-if="queueError"
          class="form-alert"
          role="alert"
        >
          {{ queueError }} <button
            class="inline-button"
            @click="loadQueue"
          >
            重新读取
          </button>
        </p>
        <p
          v-else-if="loading && !rows.length"
          class="muted"
          role="status"
        >
          正在读取评价举报…
        </p>
        <p
          v-else-if="!rows.length"
          class="work-empty"
        >
          当前筛选下暂无评价举报。
        </p>
        <button
          v-for="row in rows"
          :key="row.id"
          type="button"
          class="report-queue-row"
          :aria-pressed="selected === row.id"
          @click="router.push({ query: { ...route.query, reportId: row.id } })"
        >
          <strong>举报 #{{ row.id }} · {{ reportReasons[row.reasonCode] ?? row.reasonCode }}</strong>
          <span>{{ row.description || '图片证据' }}</span>
          <small>{{ row.status === 'PENDING' ? '待处理' : '已处理' }} · {{ formatTime(row.createdAt) }}</small>
        </button>
        <WorkPagination
          :page="page"
          :total="total"
          :size="size"
          :loading="loading"
          label="评价举报分页"
          @change="next => filter(status, next)"
        />
      </aside>
      <section class="review-detail report-detail">
        <p
          v-if="detailError"
          class="form-alert"
          role="alert"
        >
          {{ detailError }} <button
            class="inline-button"
            @click="loadDetail"
          >
            重新读取
          </button>
        </p>
        <p
          v-else-if="loadingDetail && !detail"
          class="muted"
          role="status"
        >
          正在读取评价举报详情…
        </p>
        <template v-if="detail">
          <header class="report-heading">
            <h2>评价举报 #{{ detail.report.id }}</h2>
            <span
              class="status-pill"
              :data-status="detail.report.status"
            >{{ detail.report.status === 'PENDING' ? '待处理' : '已处理' }}</span>
          </header>
          <dl class="report-facts">
            <div>
              <dt>订单编号</dt><dd>
                <RouterLink
                  class="inline-button"
                  :to="{ name: 'admin-orders', query: { orderId: detail.orderId } }"
                >{{ detail.orderNo }}</RouterLink>
              </dd>
            </div>
            <div><dt>评分</dt><dd>{{ detail.review.rating }} 星</dd></div>
            <div><dt>评价状态</dt><dd>{{ detail.targetState }}</dd></div>
            <div><dt>提交时间</dt><dd>{{ formatTime(detail.report.createdAt) }}</dd></div>
            <div v-if="detail.report.processedAt">
              <dt>最近处置</dt><dd>{{ formatTime(detail.report.processedAt) }}</dd>
            </div>
          </dl>
          <p class="report-target">
            {{ detail.review.content }}
          </p>
          <div
            v-if="detail.review.images.length"
            class="report-review-images"
          >
            <PrivateImage
              v-for="image in detail.review.images"
              :key="image.id"
              :image-id="image.id"
              scope="review"
              label="评价图片"
            />
          </div>
          <ReportMaterials
            :report="detail.report"
            :evidence="detail.evidence"
            :history="detail.history"
            scope="review"
            admin
          />
          <details
            :key="detail.report.id"
            class="report-conversation"
          >
            <summary>关联订单会话（只读）</summary>
            <p
              v-if="loadingMessages"
              class="muted"
              role="status"
            >
              正在读取会话…
            </p>
            <p
              v-else-if="messageError"
              class="form-alert"
              role="alert"
            >
              {{ messageError }}
              <button
                type="button"
                class="inline-button"
                @click="loadOlderMessages"
              >
                重试读取会话
              </button>
            </p>
            <button
              v-else-if="moreMessagesAvailable"
              type="button"
              class="inline-button"
              @click="loadOlderMessages"
            >
              读取更早会话
            </button>
            <p
              v-else-if="!messages.length"
              class="muted"
            >
              {{ detail.conversationId ? '当前无会话消息' : '暂无关联会话' }}
            </p>
            <ol class="report-chat-messages">
              <li
                v-for="message in messages"
                :key="message.seqNo"
              >
                <header>
                  <strong>{{ message.senderId === detail.buyerId ? '买家' : '创作者' }}</strong>
                  <time>{{ formatTime(message.createdAt) }}</time>
                </header>
                <p v-if="message.referencedNodeCode">
                  引用进度：{{ progressNodeName[message.referencedNodeCode] }}
                </p>
                <p
                  v-if="message.content"
                  class="report-target"
                >
                  {{ message.content }}
                </p>
                <QuoteImages
                  v-if="message.imageIds.length"
                  :image-ids="message.imageIds"
                  :admin-review-report-id="detail.report.id"
                  scope="chat"
                  label="会话凭证"
                />
              </li>
            </ol>
          </details>
          <p
            v-if="notice"
            role="status"
          >
            {{ notice }}
          </p>
          <ReportDecisionForm
            :key="detail.report.id"
            :actions="detail.allowedDecisions"
            :labels="labels"
            :submit-decision="decide"
            :verify-decision="verify"
            :last-history-id="detail.history.at(-1)?.id"
          />
        </template>
        <p
          v-else-if="!detailError && !loadingDetail"
          class="work-empty"
        >
          请选择评价举报查看详情。
        </p>
      </section>
    </div>
  </AdminLayout>
</template>
