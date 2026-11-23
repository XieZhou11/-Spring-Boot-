<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { addReportEvidence, getReport, getReportImage } from '@/api/report'
import type { ContentReportDetailVO, ReportEvidenceVO, ReviewReportHistoryEntry, ReportInput } from '@/types/report'
import type { ImageVO } from '@/types/creator'
import ReportDialog from '@/components/ReportDialog.vue'

const route = useRoute()
const detail = ref<ContentReportDetailVO>()
const error = ref('')
const message = ref('')
const busy = ref(false)
const images = ref<Record<string, ImageVO>>({})
const objectionOpen = ref(false)

const typeLabel: Record<string, string> = { WORK: '作品', COMMENT: '评论', CREATOR_PROFILE: '创作者主页', REVIEW: '评价' }

/** 举报详情、证据图片与处置历史统一读取；证据图片按关系签名。 */
async function load() {
  busy.value = true; error.value = ''
  try {
    const result = await getReport(String(route.params.id))
    detail.value = result
    const ids = [...result.report.imageIds, ...result.evidence.flatMap(e => e.imageIds)]
    for (const id of ids) if (!images.value[id]) images.value[id] = await getReportImage(id)
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '举报详情读取失败' } finally { busy.value = false }
}
/** 处理中补证或对已处理结论提出异议；举报表单的说明字段映射为补证内容。 */
async function submitEvidence(input: ReportInput) {
  error.value = ''
  try {
    detail.value = await addReportEvidence(String(route.params.id), { content: input.description, imageIds: input.imageIds })
    message.value = '材料已提交。'
    objectionOpen.value = false
    await load()
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '材料提交失败' }
}
function evidenceTitle(item: ReportEvidenceVO) { return item.evidenceType === 'OBJECTION' ? '处置异议' : '补充证据' }
function historyTitle(entry: ReviewReportHistoryEntry) { return entry.action === 'CORRECT' ? '更正' : '处置' }
onMounted(() => void load())
</script>
<template>
  <div class="page-container">
    <nav class="work-breadcrumb">
      <RouterLink to="/me/reports">我的举报</RouterLink><span>/</span><span>举报详情</span>
    </nav>
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
    <template v-if="detail">
      <header class="work-section-heading">
        <h1>举报 #{{ detail.report.id }} · 举报{{ typeLabel[detail.report.targetType] ?? detail.report.targetType }}</h1>
        <span
          class="report-status"
          :class="detail.report.status === 'PENDING' ? 'pending' : 'processed'"
        >{{ detail.report.status === 'PENDING' ? '处理中' : detail.report.latestResult === 'ACTION_TAKEN' ? '已处理：已处置' : '已处理：未成立' }}</span>
      </header>
      <dl class="report-detail-facts">
        <div><dt>被举报内容</dt><dd>{{ detail.targetSummary }}</dd></div>
        <div><dt>当前状态</dt><dd>{{ detail.targetState }}</dd></div>
        <div><dt>提交时间</dt><dd>{{ new Date(detail.report.createdAt).toLocaleString('zh-CN') }}</dd></div>
        <div v-if="detail.report.lastProcessedAt">
          <dt>最近处理</dt><dd>{{ new Date(detail.report.lastProcessedAt).toLocaleString('zh-CN') }}</dd>
        </div>
      </dl>
      <p
        v-if="message"
        role="status"
      >
        {{ message }}
      </p>
      <section class="report-section">
        <h2>初次举报</h2>
        <p>理由：{{ detail.report.reasonCode }}</p>
        <p>{{ detail.report.description || '举报人仅附图片证据' }}</p>
        <div class="report-image-row">
          <img
            v-for="id in detail.report.imageIds"
            :key="id"
            :src="images[id]?.url"
            alt="举报证据"
          >
        </div>
      </section>
      <section class="report-section">
        <h2>补充材料（{{ detail.evidence.length }}）</h2>
        <p
          v-if="!detail.evidence.length"
          class="muted"
        >
          暂无补充材料。
        </p>
        <article
          v-for="item in detail.evidence"
          :key="item.id"
          class="report-evidence"
        >
          <h3>{{ evidenceTitle(item) }} · {{ new Date(item.createdAt).toLocaleString('zh-CN') }}</h3>
          <p>{{ item.content }}</p>
          <div class="report-image-row">
            <img
              v-for="id in item.imageIds"
              :key="id"
              :src="images[id]?.url"
              alt="补充材料图片"
            >
          </div>
        </article>
        <button
          v-if="detail.canSupplement"
          class="inline-button"
          @click="objectionOpen = !objectionOpen; message = ''"
        >
          补充证据
        </button>
        <button
          v-if="detail.canObjection"
          class="inline-button"
          @click="objectionOpen = !objectionOpen; message = ''"
        >
          对处置结论提出异议
        </button>
        <ReportDialog
          v-if="objectionOpen && (detail.canSupplement || detail.canObjection)"
          :submit-label="detail.canSupplement ? '提交补充证据' : '提交处置异议'"
          @submit="submitEvidence"
        />
      </section>
      <section
        v-if="detail.history.length"
        class="report-section"
      >
        <h2>处置历史</h2>
        <ol>
          <li
            v-for="entry in detail.history"
            :key="entry.id"
          >
            <strong>{{ historyTitle(entry) }} · {{ entry.afterStatus }}</strong>
            <p>{{ entry.reason }}</p>
            <small>{{ new Date(entry.createdAt).toLocaleString('zh-CN') }}</small>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>
<style scoped>
.page-container { max-width: 860px; margin: 0 auto; padding: 24px; }
.report-status.pending { color: #a35a2a; }
.report-status.processed { color: #68765d; }
.report-detail-facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 18px 0; }
.report-detail-facts dt { font-size: 12px; color: #777; }
.report-section { margin-top: 28px; padding-top: 18px; border-top: 1px solid #e5dfd3; }
.report-evidence { padding: 12px 0; }
.report-image-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.report-image-row img { width: 110px; height: 110px; object-fit: cover; border-radius: 6px; }
@media(max-width: 620px) { .report-detail-facts { grid-template-columns: 1fr; } }
</style>
