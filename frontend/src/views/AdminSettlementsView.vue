<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getAdminSettlements } from '@/api/income'
import type { AdminSettlementVO } from '@/types/income'
import { settlementStatus } from '@/utils/quote'
import { formatTime } from '@/utils/creator'

const rows = ref<AdminSettlementVO[]>([]); const status = ref(''); const orderNo = ref(''); const page = ref(1); const total = ref(0); const error = ref(''); const loading = ref(false)
let revision = 0
/** 资金记录只读查询；订单号精确到字面包含匹配，避免跨页误导。 */
async function load(next = page.value) {
  const current = ++revision; page.value = next; loading.value = true; error.value = ''
  try {
    const result = await getAdminSettlements({ status: status.value || undefined, orderNo: orderNo.value.trim() || undefined, page: next })
    if (current !== revision) return
    rows.value = result.items; total.value = result.total
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '资金记录读取失败' }
  finally { if (current === revision) loading.value = false }
}
function refresh() { void load() }
onMounted(() => { refresh(); window.addEventListener('focus', refresh) })
onBeforeUnmount(() => { revision++; window.removeEventListener('focus', refresh) })
</script>

<template>
  <AdminLayout
    title="资金记录"
    subtitle="待结算、已结算与已取消的模拟结算快照。"
  >
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
      >{{ label }}</option></select></label><label>订单号<input
        v-model="orderNo"
        type="text"
        maxlength="32"
        aria-label="订单号"
        placeholder="按订单号包含匹配"
      ></label><button
        class="button-secondary"
        :disabled="loading"
      >
        查询
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
      正在读取资金记录…
    </p><div
      v-else-if="!rows.length && !error"
      class="creator-empty"
    >
      <h2>暂无资金记录</h2><p>付款成功的订单会在此生成待结算记录，结算或退款后保留历史。</p>
    </div>
    <ul
      v-else
      class="settlement-list"
    >
      <li
        v-for="row in rows"
        :key="row.orderId"
        class="settlement-row"
      >
        <div class="settlement-main">
          <RouterLink
            class="settlement-title"
            :to="`/orders/${row.orderId}`"
          >{{ row.title }}</RouterLink>
          <span class="muted">{{ row.orderNo }}</span>
          <span class="status-pill">{{ settlementStatus[row.status] || row.status }}</span>
        </div>
        <dl class="settlement-facts">
          <div><dt>订单类型</dt><dd>{{ row.orderType === 'STOCK' ? '现货' : '定制' }}</dd></div>
          <div><dt>应结算金额</dt><dd>¥ {{ row.paidAmount }}</dd></div>
          <div><dt>结算时间</dt><dd>{{ row.settledAt ? formatTime(row.settledAt) : '—' }}</dd></div>
          <div><dt>取消时间</dt><dd>{{ row.cancelledAt ? formatTime(row.cancelledAt) : '—' }}</dd></div>
          <div><dt>收款人</dt><dd>{{ row.realName }}</dd></div>
          <div><dt>收款账号</dt><dd>{{ row.payeeAccount }}</dd></div>
        </dl>
      </li>
    </ul>
    <WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </AdminLayout>
</template>

<style scoped>
.settlement-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.settlement-row { border: 1px solid #e5e1d8; border-radius: 12px; padding: 16px 20px; display: grid; gap: 10px; background: #fff; }
.settlement-main { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.settlement-title { font-weight: 600; color: inherit; text-decoration: none; }
.settlement-title:hover { text-decoration: underline; }
.settlement-facts { display: flex; gap: 28px; flex-wrap: wrap; margin: 0; }
.settlement-facts div { display: grid; gap: 4px; }
.settlement-facts dt { font-size: 12px; color: #909399; }
.settlement-facts dd { margin: 0; font-weight: 500; }
</style>
