<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import PrivateImage from '@/components/PrivateImage.vue'
import ReportDecisionForm from '@/components/ReportDecisionForm.vue'
import ReportMaterials from '@/components/ReportMaterials.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { decideContentReport, getAdminReports, getReport } from '@/api/report'
import { useAuthStore } from '@/stores/auth'
import { formatTime } from '@/utils/creator'
import { ApiError } from '@/utils/request'
import { reportReasons, reportTypes } from '@/utils/report'
import type { ContentReportDecision, ContentReportDetailVO, ContentReportStatus, ContentReportTargetType, ContentReportVO } from '@/types/report'
import '@/assets/styles/craftflow-reports.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const statuses = ['PENDING', 'PROCESSED', 'ALL'] as const
const types = ['ALL', ...Object.keys(reportTypes)]
const status = computed(() => statuses.includes(route.query.status as typeof statuses[number]) ? route.query.status as ContentReportStatus | 'ALL' : 'PENDING')
const type = computed(() => types.includes(String(route.query.type)) ? route.query.type as ContentReportTargetType | 'ALL' : 'ALL')
const page = computed(() => Math.min(1_000_000, Math.max(1, Math.floor(Number(route.query.page)) || 1)))
const selected = computed(() => typeof route.query.reportId === 'string' && /^\d+$/.test(route.query.reportId) ? route.query.reportId : '')
const rows = ref<ContentReportVO[]>([])
const detail = ref<ContentReportDetailVO>()
const total = ref(0)
const size = ref(20)
const loading = ref(false)
const loadingDetail = ref(false)
const queueError = ref('')
const detailError = ref('')
const notice = ref('')
let queueRevision = 0
let detailRevision = 0
const labels = computed<Record<ContentReportDecision, string>>(() => ({
  NOT_UPHELD: '举报不成立', OFFLINE: '下架作品', HIDE: '隐藏评论', PAUSE: '暂停新业务',
  RESTORE: detail.value?.report.targetType === 'WORK' ? '恢复作品' : '恢复评论', RESUME: '恢复新业务',
}))

function filter(nextStatus: string, nextType: string, nextPage = 1) {
  void router.push({ query: { status: nextStatus, type: nextType, page: nextPage > 1 ? String(nextPage) : undefined } })
}

function choose(row: ContentReportVO) {
  const queue = { status: status.value, type: type.value, page: String(page.value), reportId: row.id }
  if (row.targetType === 'REVIEW') {
    void router.push({ name: 'admin-review-reports', query: { reportId: row.id, status: status.value, fromStatus: status.value, fromType: type.value, fromPage: queue.page } })
  } else void router.push({ query: queue })
}

async function loadQueue() {
  const current = ++queueRevision
  loading.value = true
  queueError.value = ''
  try {
    const result = await getAdminReports(status.value, type.value, page.value)
    if (current !== queueRevision) return
    rows.value = result.items
    total.value = result.total
    size.value = result.size
    const last = Math.max(1, Math.ceil(result.total / result.size))
    if (page.value > last) void router.replace({ query: { ...route.query, page: last > 1 ? String(last) : undefined } })
  } catch (failure) { if (current === queueRevision) queueError.value = failure instanceof Error ? failure.message : '举报队列读取失败' }
  finally { if (current === queueRevision) loading.value = false }
}

async function loadDetail() {
  const id = selected.value
  const current = ++detailRevision
  detailError.value = ''
  const listingRow = rows.value.find(row => row.id === id)
  if (!id || listingRow?.targetType === 'REVIEW') return
  loadingDetail.value = true
  try {
    const result = await getReport(id)
    if (current === detailRevision) detail.value = result
  } catch (failure) { if (current === detailRevision) detailError.value = failure instanceof Error ? failure.message : '举报详情读取失败' }
  finally { if (current === detailRevision) loadingDetail.value = false }
}

function updateAfterDecision(id: string, result: ContentReportDetailVO) {
  if (id !== selected.value) return
  detail.value = result
  void loadQueue()
}

async function decide(decision: ContentReportDecision, reason: string, expectedHistoryId: string, recovery?: string) {
  const id = selected.value
  const scope = detailRevision
  try { await decideContentReport(id, decision, reason, expectedHistoryId, recovery) }
  catch (failure) {
    if (scope === detailRevision && failure instanceof ApiError && failure.status === 409) await Promise.all([loadDetail(), loadQueue()])
    throw failure
  }
  if (scope !== detailRevision) return
  notice.value = '处置已保存。'
  await Promise.all([loadDetail(), loadQueue()])
}

/** 核验历史时同时比对操作者与暂停条件，避免把其他管理员的处置认作本次提交。 */
async function verify(decision: ContentReportDecision, reason: string, previousId?: string, recovery?: string) {
  const id = selected.value
  const scope = detailRevision
  const operatorId = auth.session?.userId
  if (!operatorId) return false
  const result = await getReport(id)
  if (scope !== detailRevision || auth.session?.userId !== operatorId) return false
  updateAfterDecision(id, result)
  const found = result.history.some(entry =>
    (!previousId || BigInt(entry.id) > BigInt(previousId))
    && entry.operatorId === operatorId
    && entry.reason === reason
    && entry.detail?.decision === decision
    && (decision !== 'PAUSE' || entry.detail.recoveryCondition === recovery),
  )
  if (found) notice.value = '已核对到本次处置。'
  return found
}

watch([status, type, page, () => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], () => { rows.value = []; total.value = 0; void loadQueue() }, { immediate: true })
watch([selected, () => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], () => {
  detail.value = undefined; notice.value = ''; loadingDetail.value = false
  void loadDetail()
}, { immediate: true })
onBeforeUnmount(() => { queueRevision++; detailRevision++ })
</script>

<template>
  <AdminLayout title="内容举报">
    <div class="report-admin-grid">
      <aside
        class="review-queue report-queue"
        aria-label="举报队列"
      >
        <div class="report-filters">
          <label>状态<select
            :value="status"
            aria-label="举报状态筛选"
            @change="filter(($event.target as HTMLSelectElement).value, type)"
          >
            <option value="PENDING">待处理</option><option value="PROCESSED">已处理</option><option value="ALL">全部</option>
          </select></label>
          <label>类型<select
            :value="type"
            aria-label="举报类型筛选"
            @change="filter(status, ($event.target as HTMLSelectElement).value)"
          >
            <option value="ALL">全部</option><option
              v-for="(label, key) in reportTypes"
              :key="key"
              :value="key"
            >{{ label }}</option>
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
          正在读取举报…
        </p>
        <p
          v-else-if="!rows.length"
          class="work-empty"
        >
          当前筛选下暂无举报。
        </p>
        <button
          v-for="row in rows"
          :key="row.id"
          type="button"
          class="report-queue-row"
          :aria-pressed="selected === row.id"
          @click="choose(row)"
        >
          <strong>举报{{ reportTypes[row.targetType] }} · {{ reportReasons[row.reasonCode] ?? row.reasonCode }}</strong>
          <span>{{ row.targetSummary }}</span>
          <small>{{ row.status === 'PENDING' ? '待处理' : row.latestResult === 'ACTION_TAKEN' ? '已处置' : '未成立' }} · {{ formatTime(row.createdAt) }}</small>
        </button>
        <WorkPagination
          :page="page"
          :total="total"
          :size="size"
          :loading="loading"
          label="举报分页"
          @change="next => filter(status, type, next)"
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
          正在读取举报详情…
        </p>
        <template v-if="detail">
          <header class="report-heading">
            <h2>举报{{ reportTypes[detail.report.targetType] }} #{{ detail.report.id }}</h2>
            <span
              class="status-pill"
              :data-status="detail.report.status"
            >{{ detail.report.status === 'PENDING' ? '待处理' : '已处理' }}</span>
          </header>
          <p class="report-target">
            {{ detail.targetSummary }}
          </p>
          <RouterLink
            v-if="detail.report.targetType === 'WORK' && detail.targetState !== 'DRAFT' && detail.targetState !== '不可用'"
            class="text-link"
            :to="{ path: `/admin/works/${detail.report.targetId}`, query: { status: 'ALL' } }"
          >查看作品审核材料</RouterLink>
          <RouterLink
            v-else-if="detail.report.targetType === 'CREATOR_PROFILE' && detail.ownerId"
            class="text-link"
            :to="`/creators/${detail.report.targetId}`"
          >查看创作者主页</RouterLink>
          <dl class="report-facts">
            <div><dt>目标状态</dt><dd>{{ detail.targetState }}</dd></div>
            <div><dt>提交时间</dt><dd>{{ formatTime(detail.report.createdAt) }}</dd></div>
            <div v-if="detail.report.lastProcessedAt">
              <dt>最近处置</dt><dd>{{ formatTime(detail.report.lastProcessedAt) }}</dd>
            </div>
            <div v-if="detail.ownerId">
              <dt>被处理人</dt><dd>{{ detail.ownerId }}</dd>
            </div>
          </dl>
          <section
            v-if="detail.originalComment || detail.originalCommentImageIds?.length"
            aria-labelledby="original-comment"
          >
            <h2 id="original-comment">
              原评论
            </h2>
            <p
              v-if="detail.originalComment"
              class="report-target"
            >
              {{ detail.originalComment }}
            </p>
            <div
              v-if="detail.originalCommentImageIds?.length"
              class="report-review-images"
            >
              <PrivateImage
                v-for="(imageId, index) in detail.originalCommentImageIds"
                :key="imageId"
                :image-id="imageId"
                :admin-report-id="detail.report.id"
                :label="`原评论图片 ${index + 1}`"
                scope="report"
              />
            </div>
          </section>
          <ReportMaterials
            :report="detail.report"
            :evidence="detail.evidence"
            :history="detail.history"
            scope="report"
            admin
          />
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
          请选择举报查看详情。
        </p>
      </section>
    </div>
  </AdminLayout>
</template>
