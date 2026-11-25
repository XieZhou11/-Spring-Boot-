<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ReportDialog from '@/components/ReportDialog.vue'
import ReportMaterials from '@/components/ReportMaterials.vue'
import { addReportEvidence, getReport } from '@/api/report'
import { addReviewReportEvidence, getReviewReport } from '@/api/review'
import { useAuthStore } from '@/stores/auth'
import { formatTime } from '@/utils/creator'
import { matchesReportMaterial, reportTypes } from '@/utils/report'
import type { ReportInput } from '@/types/report'

const props = defineProps<{ review?: boolean }>()
const route = useRoute()
const auth = useAuthStore()
const id = computed(() => String(route.params.id))
const detail = ref<Awaited<ReturnType<typeof getReport | typeof getReviewReport>>>()
const loading = ref(false)
const error = ref('')
const message = ref('')
const formOpen = ref(false)
let revision = 0
const target = computed(() => {
  const result = detail.value
  if (!result) return
  if ('review' in result) {
    return { title: '评价', summary: result.review.content, processedAt: result.report.processedAt }
  }
  return { title: reportTypes[result.report.targetType], summary: result.targetSummary, processedAt: result.report.lastProcessedAt }
})
const back = computed(() => ({
  path: '/me/reports',
  query: typeof route.query.page === 'string' ? { page: route.query.page } : {},
}))

function read() {
  return props.review ? getReviewReport(id.value) : getReport(id.value)
}

async function load() {
  const current = ++revision
  loading.value = true
  error.value = ''
  try {
    const result = await read()
    if (current === revision) detail.value = result
  } catch (failure) {
    if (current === revision) error.value = failure instanceof Error ? failure.message : '举报详情读取失败'
  } finally { if (current === revision) loading.value = false }
}

async function submit(input: ReportInput) {
  const current = revision
  const save = props.review ? addReviewReportEvidence : addReportEvidence
  const result = await save(id.value, { content: input.description, imageIds: input.imageIds })
  if (current !== revision) return
  detail.value = result
  message.value = '材料已提交。'
  formOpen.value = false
}

async function prepareVerification(input: ReportInput) {
  const current = revision
  const previousId = (await read()).evidence.at(-1)?.id
  return async () => {
    const result = await read()
    if (current !== revision) return false
    const found = result.evidence.some(item => item.submitterId === auth.session?.userId
      && (!previousId || BigInt(item.id) > BigInt(previousId)) && matchesReportMaterial(item, input))
    if (found) {
      detail.value = result
      message.value = '已核对到本次材料。'
      formOpen.value = false
    }
    return found
  }
}

watch([id, () => props.review, () => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], () => {
  detail.value = undefined; formOpen.value = false; message.value = ''
  void load()
}, { immediate: true })
onBeforeUnmount(() => { revision++ })
</script>

<template>
  <div class="report-public-page">
    <nav class="work-breadcrumb">
      <RouterLink :to="back">我的举报</RouterLink><span>/</span><span>举报详情</span>
    </nav>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        @click="load"
      >
        重新读取
      </button>
    </p>
    <p
      v-if="loading && !detail"
      role="status"
    >
      正在读取举报详情…
    </p>
    <article v-if="detail && target">
      <header class="report-heading">
        <h1>举报 #{{ detail.report.id }} · 举报{{ target.title }}</h1>
        <span
          class="report-status"
          :class="{ pending: detail.report.status === 'PENDING' }"
        >{{ detail.report.status === 'PENDING' ? '处理中' : detail.report.latestResult === 'ACTION_TAKEN' ? '已处理：已处置' : '已处理：未成立' }}</span>
      </header>
      <p
        v-if="target.summary"
        class="report-target"
      >
        {{ target.summary }}
      </p>
      <dl class="report-facts">
        <div><dt>提交时间</dt><dd>{{ formatTime(detail.report.createdAt) }}</dd></div>
        <div v-if="target.processedAt">
          <dt>最近处置</dt><dd>{{ formatTime(target.processedAt) }}</dd>
        </div>
      </dl>
      <ReportMaterials
        :report="detail.report"
        :evidence="detail.evidence"
        :history="detail.history"
        :scope="review ? 'review' : 'report'"
      />
      <p
        v-if="message"
        role="status"
      >
        {{ message }}
      </p>
      <button
        v-if="detail.canSupplement || detail.canObjection"
        type="button"
        class="button-secondary"
        @click="formOpen = !formOpen; message = ''"
      >
        {{ detail.canSupplement ? '补充证据' : '对处置结论提出异议' }}
      </button>
      <ReportDialog
        v-if="formOpen"
        evidence
        :submit-label="detail.canSupplement ? '提交补充证据' : '提交处置异议'"
        :submit-report="submit"
        :prepare-verification="prepareVerification"
      />
    </article>
  </div>
</template>

<style src="@/assets/styles/craftflow-reports.css"></style>
