<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CreatorLayout from '@/layouts/CreatorLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getMySettlements } from '@/api/income'
import { useAuthStore } from '@/stores/auth'
import type { CreatorSettlementVO } from '@/types/income'
import { settlementStatus } from '@/utils/quote'
import { formatTime } from '@/utils/creator'
import '@/assets/styles/craftflow-publication.css'
import '@/assets/styles/craftflow-settlement.css'

const auth = useAuthStore()
const rows = ref<CreatorSettlementVO[]>([])
const status = ref('')
const page = ref(1)
const total = ref(0)
const error = ref('')
const loading = ref(false)
let revision = 0

/** 收入按本人身份只读查询，退出或切换账号后丢弃旧响应。 */
async function load(next = page.value) {
  if (!auth.session) return
  const current = ++revision
  page.value = next
  loading.value = true
  error.value = ''
  try {
    const result = await getMySettlements({ status: status.value || undefined, page: next })
    if (current !== revision) return
    rows.value = result.items
    total.value = result.total
  } catch (failure) {
    if (current !== revision) return
    error.value = failure instanceof Error ? failure.message : '收入记录读取失败'
  } finally {
    if (current === revision) loading.value = false
  }
}

function refresh() { void load() }
watch(() => auth.session?.userId, () => {
  revision++
  rows.value = []
  total.value = 0
  loading.value = false
  status.value = ''
  error.value = ''
  void load(1)
}, { immediate: true, flush: 'sync' })
onMounted(() => window.addEventListener('focus', refresh))
onBeforeUnmount(() => {
  revision++
  window.removeEventListener('focus', refresh)
})
</script>

<template>
  <CreatorLayout presentation="craftflow">
    <section class="cf-settlement">
      <header class="cf-settlement-heading">
        <h1>收入记录</h1>
        <p>订单完成满 7 天且无处理中售后时，系统自动模拟结算。</p>
      </header>

      <section
        class="cf-settlement-card"
        aria-label="逐单结算记录"
        :aria-busy="loading"
      >
        <form
          class="cf-settlement-filters"
          @submit.prevent="load()"
        >
          <label>结算状态<select
            v-model="status"
            aria-label="结算状态"
            @change="rows = []; total = 0; load(1)"
          >
            <option value="">全部状态</option>
            <option
              v-for="(label, value) in settlementStatus"
              :key="value"
              :value="value"
            >
              {{ label }}
            </option>
          </select></label>
          <button
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
          <button
            type="button"
            class="inline-button"
            @click="refresh"
          >
            重试
          </button>
        </p>
        <p
          v-if="loading && !rows.length"
          class="cf-settlement-state"
          role="status"
        >
          正在读取收入记录…
        </p>
        <div
          v-else-if="!rows.length && !error"
          class="cf-settlement-state"
        >
          <h2>暂无收入记录</h2>
          <p>{{ status ? '可以切换结算状态查看其他记录。' : '买家付款后，订单会显示在此。' }}</p>
        </div>
        <div
          v-if="rows.length"
          class="cf-settlement-table"
        >
          <table aria-label="收入记录明细">
            <thead>
              <tr>
                <th scope="col">
                  订单
                </th>
                <th scope="col">
                  买家实付 / 应结算
                </th>
                <th scope="col">
                  结算状态
                </th>
                <th scope="col">
                  模拟结算时间
                </th>
                <th scope="col">
                  收款账户
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.orderId"
                class="income-row"
              >
                <td>
                  <RouterLink :to="{ name: 'order-detail', params: { id: row.orderId }, query: { side: 'CREATOR' } }">
                    {{ row.title }}
                  </RouterLink>
                  <small>{{ row.orderNo }}</small>
                </td>
                <td class="cf-settlement-amount">
                  ¥ {{ row.paidAmount }}
                </td>
                <td><span :data-status="row.status">{{ settlementStatus[row.status] || row.status }}</span></td>
                <td><time :datetime="row.settledAt || undefined">{{ formatTime(row.settledAt) }}</time></td>
                <td>{{ row.maskedPayee }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <WorkPagination
          label="收入记录分页"
          :page="page"
          :total="total"
          :loading="loading"
          @change="load"
        />
      </section>
    </section>
  </CreatorLayout>
</template>
