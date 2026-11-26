<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MessageLayout from '@/layouts/MessageLayout.vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getMyReports } from '@/api/report'
import type { ContentReportVO } from '@/types/report'
import { reportReasons, reportTypes } from '@/utils/report'
import { formatTime } from '@/utils/creator'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/craftflow-reports.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const rows = ref<ContentReportVO[]>([])
const page = computed(() => Math.min(1_000_000, Math.max(1, Math.floor(Number(route.query.page)) || 1)))
const size = ref(20)
const total = ref(0)
const loading = ref(false)
const error = ref('')

let revision = 0

function changePage(next: number) {
  void router.push({ query: { page: next > 1 ? String(next) : undefined } })
}

async function load() {
  const current = ++revision
  loading.value = true; error.value = ''
  try {
    const result = await getMyReports(page.value)
    if (current !== revision) return
    rows.value = result.items; total.value = result.total; size.value = result.size
    const last = Math.max(1, Math.ceil(result.total / result.size))
    if (page.value > last) void router.replace({ query: { page: last > 1 ? String(last) : undefined } })
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '举报列表读取失败' }
  finally { if (current === revision) loading.value = false }
}
watch([page, () => auth.session?.userId, () => auth.session?.roles.includes('ADMIN')], () => { rows.value = []; total.value = 0; void load() }, { immediate: true })
onBeforeUnmount(() => { revision++ })
</script>
<template>
  <MessageLayout admin-title="举报记录">
    <section
      class="message-reports"
      aria-labelledby="my-reports-heading"
      :aria-busy="loading"
    >
      <header class="report-list-heading">
        <h2 id="my-reports-heading">
          我的举报
        </h2>
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
        v-if="loading"
        class="account-loading"
        role="status"
      >
        正在读取举报列表…
      </p>
      <div
        v-else-if="!rows.length && !error"
        class="message-placeholder"
      >
        <span class="message-empty-icon"><AppIcon name="shield" /></span>
        <p>还没有提交过举报。</p>
      </div>
      <article
        v-for="row in rows"
        :key="row.id"
        class="report-list-item"
      >
        <div class="report-item-heading">
          <strong>#{{ row.id }} · 举报{{ reportTypes[row.targetType] }}</strong>
          <span
            class="report-status"
            :class="row.status === 'PENDING' ? 'pending' : 'processed'"
          >{{ row.status === 'PENDING' ? '处理中' : row.latestResult === 'ACTION_TAKEN' ? '已处理：已处置' : '已处理：未成立' }}</span>
        </div>
        <p>{{ row.targetSummary }}</p>
        <p class="muted">
          理由：{{ reportReasons[row.reasonCode] ?? row.reasonCode }}<template v-if="row.description">
            · {{ row.description }}
          </template><time> · 提交于 {{ formatTime(row.createdAt) }}</time>
        </p>
        <p
          v-if="row.status === 'PROCESSED' && row.decisionReason"
          class="muted"
        >
          处理依据：{{ row.decisionReason }}
        </p>
        <RouterLink
          class="inline-button"
          :to="{ path: `${row.targetType === 'REVIEW' ? '/review-reports' : '/reports'}/${row.id}`, query: page > 1 ? { page: String(page) } : {} }"
        >
          查看详情
        </RouterLink>
      </article>
      <WorkPagination
        :page="page"
        :total="total"
        :size="size"
        :loading="loading"
        label="我的举报分页"
        @change="changePage"
      />
    </section>
  </MessageLayout>
</template>
<style scoped>
/* 举报条目按消息列表的行距排列，长文本在当前行内折行。 */
.report-list-heading h2 { color: var(--craft-ink); font: 650 16px/1.4 var(--craft-font); }
.report-list-item {
  display: grid;
  gap: 6px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--craft-border);
}
.message-placeholder p { font: 650 16px/1.4 var(--craft-font); }
.report-list-item p { margin: 0; overflow-wrap: anywhere; }
.report-list-item a { justify-self: start; }
.report-item-heading { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
</style>
