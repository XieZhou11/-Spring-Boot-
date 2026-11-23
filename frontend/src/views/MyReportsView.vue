<script setup lang="ts">
import { onMounted, ref } from 'vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getMyReports } from '@/api/report'
import type { ContentReportVO } from '@/types/report'

const rows = ref<ContentReportVO[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const error = ref('')

const typeLabel: Record<string, string> = { WORK: '作品', COMMENT: '评论', CREATOR_PROFILE: '创作者主页', REVIEW: '评价' }

async function load(next = page.value) {
  loading.value = true; error.value = ''
  try {
    const result = await getMyReports(next)
    rows.value = result.items; page.value = next; total.value = result.total
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '举报列表读取失败' } finally { loading.value = false }
}
onMounted(() => void load())
</script>
<template>
  <div class="page-container">
    <header class="work-section-heading">
      <h1>我的举报</h1><span class="muted">处理中举报可在详情补充证据；被处理人可对结论提出异议</span>
    </header>
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
    <p
      v-if="!rows.length && !loading"
      class="muted"
    >
      还没有提交过举报。
    </p>
    <article
      v-for="row in rows"
      :key="row.id"
      class="report-list-item"
    >
      <div class="report-item-heading">
        <strong>#{{ row.id }} · 举报{{ typeLabel[row.targetType] ?? row.targetType }}</strong>
        <span
          class="report-status"
          :class="row.status === 'PENDING' ? 'pending' : 'processed'"
        >{{ row.status === 'PENDING' ? '处理中' : row.latestResult === 'ACTION_TAKEN' ? '已处理：已处置' : '已处理：未成立' }}</span>
      </div>
      <p>{{ row.targetSummary }}</p>
      <p class="muted">
        理由：{{ row.reasonCode }}<template v-if="row.description">
          · {{ row.description }}
        </template><time> · 提交于 {{ new Date(row.createdAt).toLocaleString('zh-CN') }}</time>
      </p>
      <p
        v-if="row.status === 'PROCESSED' && row.decisionReason"
        class="muted"
      >
        处理依据：{{ row.decisionReason }}
      </p>
      <RouterLink
        v-if="row.targetType !== 'REVIEW'"
        class="inline-button"
        :to="`/reports/${row.id}`"
      >
        查看详情 / 补充材料
      </RouterLink>
      <span
        v-else
        class="muted"
      >评价举报详情可在对应评价的“查询关联举报”中查看</span>
    </article>
    <WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </div>
</template>
<style scoped>
.page-container { max-width: 860px; margin: 0 auto; padding: 24px; }
.report-list-item { padding: 18px 0; border-bottom: 1px solid #e5dfd3; display: grid; gap: 6px; }
.report-item-heading { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.report-status.pending { color: #a35a2a; }
.report-status.processed { color: #68765d; }
</style>
