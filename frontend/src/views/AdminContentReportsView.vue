<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { decideContentReport, getAdminReports, getReport, getReportImage } from '@/api/report'
import type { ContentReportVO, ContentReportDetailVO, ContentReportTargetType, ContentReportDecision, ReportEvidenceVO, ReviewReportHistoryEntry } from '@/types/report'
import type { ImageVO } from '@/types/creator'

const rows = ref<ContentReportVO[]>([])
const detail = ref<ContentReportDetailVO>()
const status = ref<'PENDING' | 'PROCESSED' | 'ALL'>('PENDING')
const type = ref<ContentReportTargetType | 'ALL'>('ALL')
const reason = ref('')
const busy = ref(false)
const error = ref('')
const images = ref<Record<string, ImageVO>>({})

const typeLabel: Record<string, string> = { WORK: '作品', COMMENT: '评论', CREATOR_PROFILE: '创作者主页', REVIEW: '评价' }

/** 举报队列按状态与类型筛选；详情证据图片统一签名。 */
async function load(id?: string) {
  busy.value = true; error.value = ''
  try {
    const page = await getAdminReports(status.value, type.value)
    rows.value = page.items
    const target = id || detail.value?.report.id || rows.value[0]?.id
    detail.value = target ? await getReport(target) : undefined
    if (detail.value) {
      const ids = [...detail.value.report.imageIds, ...detail.value.evidence.flatMap(e => e.imageIds)]
      for (const fileId of ids) if (!images.value[fileId]) images.value[fileId] = await getReportImage(fileId)
    }
  } catch (e) { error.value = e instanceof Error ? e.message : '举报队列读取失败' } finally { busy.value = false }
}
async function choose(row: ContentReportVO) {
  error.value = ''
  try { detail.value = await getReport(row.id); const ids = [...detail.value.report.imageIds, ...detail.value.evidence.flatMap(e => e.imageIds)]; for (const fileId of ids) if (!images.value[fileId]) images.value[fileId] = await getReportImage(fileId) }
  catch (e) { error.value = e instanceof Error ? e.message : '举报详情读取失败' }
}
/** 按目标类型可用的处置动作：作品下架、评论隐藏、主页暂停，已处理后可更正恢复。 */
function decisions(): { key: ContentReportDecision; label: string }[] {
  const t = detail.value?.report.targetType
  if (!t || t === 'REVIEW') return []
  const pending = detail.value?.report.status === 'PENDING'
  const actions: Record<string, { key: ContentReportDecision; label: string }> = { WORK: { key: 'OFFLINE', label: '下架作品' }, COMMENT: { key: 'HIDE', label: '隐藏评论' }, CREATOR_PROFILE: { key: 'PAUSE', label: '暂停新业务' } }
  const restores: Record<string, { key: ContentReportDecision; label: string }> = { WORK: { key: 'RESTORE', label: '恢复作品' }, COMMENT: { key: 'RESTORE', label: '恢复评论' }, CREATOR_PROFILE: { key: 'RESUME', label: '恢复新业务' } }
  const result: { key: ContentReportDecision; label: string }[] = [{ key: 'NOT_UPHELD', label: '举报不成立' }]
  if (pending) result.push(actions[t])
  else result.push(actions[t], restores[t])
  return result
}
async function decide(decision: ContentReportDecision) {
  if (!detail.value || reason.value.trim().length < 5) return
  busy.value = true
  try { await decideContentReport(detail.value.report.id, decision, reason.value.trim()); reason.value = ''; await load(detail.value.report.id) }
  catch (e) { error.value = e instanceof Error ? e.message : '举报处理失败' } finally { busy.value = false }
}
function evidenceTitle(item: ReportEvidenceVO) { return item.evidenceType === 'OBJECTION' ? '处置异议' : '补充证据' }
function historyTitle(entry: ReviewReportHistoryEntry) { return entry.action === 'CORRECT' ? '更正' : '处置' }
onMounted(() => void load())
</script>
<template>
  <AdminLayout
    title="内容举报"
    subtitle="作品、评论与创作者主页举报的统一核查与处置队列"
  >
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        @click="load()"
      >
        重新读取
      </button>
    </p>
    <div class="admin-review-grid">
      <aside class="admin-queue">
        <h2>筛选</h2>
        <div class="admin-filter-row">
          <label>状态<select
            v-model="status"
            aria-label="举报状态筛选"
            @change="load()"
          ><option value="PENDING">待处理</option><option value="PROCESSED">已处理</option><option value="ALL">全部</option></select></label>
          <label>类型<select
            v-model="type"
            aria-label="举报类型筛选"
            @change="load()"
          ><option value="ALL">全部</option><option value="WORK">作品</option><option value="COMMENT">评论</option><option value="CREATOR_PROFILE">主页</option><option value="REVIEW">评价</option></select></label>
        </div>
        <h2>举报队列</h2>
        <button
          v-for="row in rows"
          :key="row.id"
          class="admin-queue-item"
          :class="{ active: detail?.report.id === row.id }"
          @click="choose(row)"
        >
          <strong>#{{ row.id }} · 举报{{ typeLabel[row.targetType] ?? row.targetType }} · {{ row.reasonCode }}</strong>
          <span>{{ row.status === 'PENDING' ? '待处理' : row.latestResult === 'ACTION_TAKEN' ? '已处置' : '未成立' }} · {{ row.createdAt }}</span>
          <span>{{ row.targetSummary }}</span>
        </button>
        <p
          v-if="!rows.length"
          class="muted"
        >
          当前筛选下暂无举报。
        </p>
      </aside>
      <section
        v-if="detail"
        class="admin-review-detail"
      >
        <template v-if="detail.report.targetType === 'REVIEW'">
          <h2>评价举报</h2>
          <p>评价举报在评价举报页核查与处置。<RouterLink to="/admin/review-reports">前往评价举报 ↗</RouterLink></p>
          <p>{{ detail.targetSummary }}</p>
        </template>
        <template v-else>
          <h2>内容核查</h2>
          <dl>
            <div><dt>类型</dt><dd>{{ typeLabel[detail.report.targetType] }}</dd></div>
            <div><dt>目标状态</dt><dd>{{ detail.targetState }}</dd></div>
            <div><dt>被处理人</dt><dd>{{ detail.ownerId }}</dd></div>
            <div v-if="detail.workId">
              <dt>关联作品</dt><dd>{{ detail.workId }}</dd>
            </div>
          </dl>
          <blockquote>{{ detail.targetSummary }}</blockquote>
          <h3>举报说明与证据</h3>
          <p>{{ detail.report.description || '举报人仅附图片证据' }}</p>
          <div class="review-image-row">
            <img
              v-for="id in detail.report.imageIds"
              :key="id"
              :src="images[id]?.url"
              alt="举报证据"
            >
          </div>
          <article
            v-for="item in detail.evidence"
            :key="item.id"
          >
            <h4>{{ evidenceTitle(item) }} · {{ item.submitterId }}</h4>
            <p>{{ item.content }}</p>
            <div class="review-image-row">
              <img
                v-for="id in item.imageIds"
                :key="id"
                :src="images[id]?.url"
                alt="补充材料"
              >
            </div>
          </article>
          <section
            v-if="detail.history.length"
          >
            <h3>处置历史</h3>
            <ol>
              <li
                v-for="entry in detail.history"
                :key="entry.id"
              >
                <strong>{{ historyTitle(entry) }} · {{ entry.afterStatus }}</strong>
                <p>{{ entry.reason }}</p>
                <small>{{ entry.createdAt }} · 管理员 {{ entry.operatorId }}</small>
              </li>
            </ol>
          </section>
          <label>处理依据<textarea
            v-model="reason"
            maxlength="500"
            minlength="5"
          /></label>
          <div class="admin-decision-actions">
            <button
              v-for="option in decisions()"
              :key="option.key"
              :disabled="busy || reason.trim().length < 5"
              @click="decide(option.key)"
            >
              {{ option.label }}
            </button>
          </div>
          <p class="field-help">
            处置理由至少5个字；已处理举报可通过更正按钮恢复内容或新业务。
          </p>
        </template>
      </section>
      <p
        v-else
        class="admin-review-placeholder"
      >
        暂无内容举报。
      </p>
    </div>
  </AdminLayout>
</template>
<style scoped>
.admin-filter-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.admin-filter-row select { padding: 4px 8px; }
</style>
