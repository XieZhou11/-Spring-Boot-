<script setup lang="ts">
import PrivateImage from '@/components/PrivateImage.vue'
import { formatTime } from '@/utils/creator'
import { reportDecisions, reportReasons } from '@/utils/report'
import type { ReportEvidenceVO, ReviewReportHistoryEntry } from '@/types/report'

defineProps<{
  scope: 'report' | 'review'
  report: { reasonCode: string; description: string | null; imageIds: string[] }
  evidence: ReportEvidenceVO[]
  history: ReviewReportHistoryEntry[]
  admin?: boolean
}>()
</script>

<template>
  <section class="report-materials">
    <h2>举报理由与证据</h2>
    <strong>{{ reportReasons[report.reasonCode] ?? report.reasonCode }}</strong>
    <p v-if="report.description">
      {{ report.description }}
    </p>
    <div
      v-if="report.imageIds.length"
      class="report-images"
    >
      <PrivateImage
        v-for="id in report.imageIds"
        :key="id"
        :image-id="id"
        :scope="scope"
        label="初次举报证据"
      />
    </div>
  </section>
  <section
    v-if="evidence.length"
    class="report-materials"
  >
    <h2>补充材料</h2>
    <article
      v-for="item in evidence"
      :key="item.id"
    >
      <strong>{{ item.evidenceType === 'OBJECTION' ? '处置异议' : '补充证据' }}</strong>
      <small>{{ formatTime(item.createdAt) }}<template v-if="admin"> · 用户 {{ item.submitterId }}</template></small>
      <p v-if="item.content">
        {{ item.content }}
      </p>
      <div
        v-if="item.imageIds.length"
        class="report-images"
      >
        <PrivateImage
          v-for="id in item.imageIds"
          :key="id"
          :image-id="id"
          :scope="scope"
          label="补充材料图片"
        />
      </div>
    </article>
  </section>
  <section
    v-if="history.length"
    class="report-materials"
  >
    <h2>处置历史</h2>
    <article
      v-for="entry in history"
      :key="entry.id"
    >
      <strong>{{ entry.action === 'CORRECT' ? '更正' : '处置' }} · {{ reportDecisions[String(entry.detail?.decision)] ?? (entry.afterStatus === 'NOT_UPHELD' ? '未成立' : '已处置') }}</strong>
      <small>{{ formatTime(entry.createdAt) }}<template v-if="admin"> · 管理员 {{ entry.operatorId }}</template></small>
      <p v-if="entry.reason">
        {{ entry.reason }}
      </p>
      <p v-if="entry.detail?.recoveryCondition">
        恢复条件 {{ entry.detail.recoveryCondition }}
      </p>
    </article>
  </section>
</template>

<style scoped>
.report-materials {
  display: grid;
  gap: 10px;
  padding: 16px 0;
  border-top: 1px solid var(--craft-border);
}
.report-materials h2 { margin: 0; font-size: 15px; }
.report-materials p { margin: 4px 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.report-materials article { padding: 10px 12px; border-left: 2px solid var(--craft-border); }
.report-materials small { margin-left: 8px; color: var(--craft-muted); }
.report-images { display: flex; flex-wrap: wrap; gap: 10px; }
.report-images :deep(.work-image) { width: min(120px, 100%); aspect-ratio: 1; overflow: hidden; border-radius: 8px; }
</style>
