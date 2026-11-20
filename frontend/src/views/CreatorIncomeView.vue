<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CreatorLayout from '@/layouts/CreatorLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getMySettlements } from '@/api/income'
import type { CreatorSettlementVO } from '@/types/income'
import { settlementStatus } from '@/utils/quote'
import { formatTime } from '@/utils/creator'

const rows = ref<CreatorSettlementVO[]>([]); const status = ref(''); const page = ref(1); const total = ref(0); const error = ref(''); const loading = ref(false)
let revision = 0
/** 收入记录为只读查询，会话或焦点恢复时静默刷新当前页。 */
async function load(next = page.value) {
  const current = ++revision; page.value = next; loading.value = true; error.value = ''
  try {
    const result = await getMySettlements({ status: status.value || undefined, page: next })
    if (current !== revision) return
    rows.value = result.items; total.value = result.total
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '收入记录读取失败' }
  finally { if (current === revision) loading.value = false }
}
function refresh() { void load() }
onMounted(() => { refresh(); window.addEventListener('focus', refresh) })
onBeforeUnmount(() => { revision++; window.removeEventListener('focus', refresh) })
</script>

<template>
  <CreatorLayout>
    <header class="work-section-heading">
      <div>
        <p class="eyebrow">
          INCOME RECORDS
        </p><h1>收入记录</h1><p class="muted">
          每笔订单的应结算金额与模拟结算进度。
        </p>
      </div>
    </header>
    <form
      class="request-filters"
      @submit.prevent="load(1)"
    >
      <label>结算状态<select
        v-model="status"
        aria-label="结算状态"
        @change="load(1)"
      ><option value="">全部状态</option><option
        v-for="(label, value) in settlementStatus"
        :key="value"
        :value="value"
      >{{ label }}</option></select></label><button
        class="button-secondary"
        :disabled="loading"
      >
        刷新记录
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
      role="status"
    >
      正在读取收入记录…
    </p><div
      v-else-if="!rows.length && !error"
      class="creator-empty"
    >
      <h2>暂无收入记录</h2><p>订单完成满七天且无处理中售后时，系统会自动生成模拟结算记录。</p>
    </div>
    <ul
      v-else
      class="income-list"
    >
      <li
        v-for="row in rows"
        :key="row.orderId"
        class="income-row"
      >
        <div class="income-main">
          <RouterLink
            class="income-title"
            :to="`/orders/${row.orderId}`"
          >{{ row.title }}</RouterLink>
          <span class="muted">{{ row.orderNo }}</span>
        </div>
        <dl class="income-facts">
          <div><dt>应结算金额</dt><dd>¥ {{ row.paidAmount }}</dd></div>
          <div><dt>结算状态</dt><dd>{{ settlementStatus[row.status] || row.status }}</dd></div>
          <div><dt>结算时间</dt><dd>{{ row.settledAt ? formatTime(row.settledAt) : '—' }}</dd></div>
          <div><dt>收款账户</dt><dd>{{ row.maskedPayee }}</dd></div>
        </dl>
      </li>
    </ul>
    <WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </CreatorLayout>
</template>

<style scoped>
.income-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.income-row { border: 1px solid #e5e1d8; border-radius: 12px; padding: 16px 20px; display: grid; gap: 10px; background: #fff; }
.income-main { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.income-title { font-weight: 600; color: inherit; text-decoration: none; }
.income-title:hover { text-decoration: underline; }
.income-facts { display: flex; gap: 32px; flex-wrap: wrap; margin: 0; }
.income-facts div { display: grid; gap: 4px; }
.income-facts dt { font-size: 12px; color: #909399; }
.income-facts dd { margin: 0; font-weight: 500; }
</style>
