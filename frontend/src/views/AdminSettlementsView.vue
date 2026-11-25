<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getAdminSettlements } from '@/api/income'
import { useAuthStore } from '@/stores/auth'
import type { AdminSettlementVO } from '@/types/income'
import { settlementStatus } from '@/utils/quote'
import { formatTime } from '@/utils/creator'
import { ApiError } from '@/utils/request'
import '@/assets/styles/craftflow-settlement.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const adminId = computed(() => auth.session?.roles.includes('ADMIN') ? auth.session.userId : undefined)
const rows = ref<AdminSettlementVO[]>([])
const total = ref(0)
const error = ref('')
const loading = ref(false)
let revision = 0

function readQuery(key: string) {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const filters = computed(() => {
  const status = readQuery('status')
  return {
    status: Object.hasOwn(settlementStatus, status) ? status : '',
    orderNo: readQuery('orderNo'),
    createdFrom: readQuery('createdFrom'),
    createdTo: readQuery('createdTo'),
    minAmount: readQuery('minAmount'),
    maxAmount: readQuery('maxAmount'),
  }
})
const draft = ref({ ...filters.value })
// v-model 会把数字输入框的 0 转为 number，URL 只省略空输入。
const amountQuery = (value: string | number) => value === '' ? undefined : String(value)
const page = computed(() => {
  const value = Number(readQuery('page'))
  return Number.isInteger(value) && value > 0 && value <= 1_000_000 ? value : 1
})

/** URL 保存已生效的筛选和页码，焦点刷新沿用查询条件，返回时恢复同一页。 */
async function applyFilters(next = 1, source = draft.value) {
  const target = {
    name: 'admin-settlements',
    query: {
      status: source.status || undefined,
      orderNo: source.orderNo.trim() || undefined,
      createdFrom: source.createdFrom || undefined,
      createdTo: source.createdTo || undefined,
      minAmount: amountQuery(source.minAmount),
      maxAmount: amountQuery(source.maxAmount),
      page: next > 1 ? String(next) : undefined,
    },
  }
  if (router.resolve(target).fullPath === route.fullPath) void load()
  else await router.push(target)
}

async function load() {
  const userId = adminId.value
  if (!userId) return
  const current = ++revision
  loading.value = true
  error.value = ''
  const query = filters.value
  try {
    const result = await getAdminSettlements({
      status: query.status || 'ALL',
      orderNo: query.orderNo || undefined,
      createdFrom: query.createdFrom || undefined,
      createdTo: query.createdTo || undefined,
      minAmount: query.minAmount || undefined,
      maxAmount: query.maxAmount || undefined,
      page: page.value,
    })
    if (current !== revision || adminId.value !== userId) return
    rows.value = result.items
    total.value = result.total
  } catch (failure) {
    if (current !== revision || adminId.value !== userId) return
    if (failure instanceof ApiError && [401, 403].includes(failure.status)) {
      rows.value = []
      total.value = 0
    }
    error.value = failure instanceof Error ? failure.message : '资金记录读取失败'
  } finally {
    if (current === revision) loading.value = false
  }
}

/** 收款快照属于当前管理员，账号或权限变化后立即清理。 */
watch([filters, page, adminId], () => {
  revision++
  draft.value = { ...filters.value }
  rows.value = []
  total.value = 0
  error.value = ''
  loading.value = false
  void load()
}, { immediate: true })

onMounted(() => window.addEventListener('focus', load))
onBeforeUnmount(() => {
  revision++
  window.removeEventListener('focus', load)
})
</script>

<template>
  <AdminLayout
    title="资金记录"
  >
    <section
      class="cf-settlement cf-settlement-card"
      aria-label="模拟结算记录"
      :aria-busy="loading"
    >
      <form
        class="cf-settlement-filters cf-settlement-filters--admin"
        @submit.prevent="applyFilters()"
      >
        <label>结算状态<select
          v-model="draft.status"
          aria-label="结算状态"
          @change="applyFilters()"
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
        <label>订单号<input
          v-model="draft.orderNo"
          type="text"
          maxlength="32"
          placeholder="包含匹配"
        ></label>
        <label>记录创建时间从<input
          v-model="draft.createdFrom"
          type="datetime-local"
        ></label>
        <label>记录创建时间至<input
          v-model="draft.createdTo"
          type="datetime-local"
        ></label>
        <label>实付金额从<input
          v-model="draft.minAmount"
          type="number"
          min="0"
          step="0.01"
        ></label>
        <label>实付金额至<input
          v-model="draft.maxAmount"
          type="number"
          min="0"
          step="0.01"
        ></label>
        <button
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
        <button
          type="button"
          class="inline-button"
          @click="load"
        >
          重试
        </button>
      </p>
      <p
        v-if="loading && !rows.length"
        class="cf-settlement-state"
        role="status"
      >
        正在读取资金记录…
      </p>
      <div
        v-else-if="!rows.length && !error"
        class="cf-settlement-state"
      >
        <h2>暂无资金记录</h2>
        <p>买家付款后生成待结算记录，可调整筛选查看其他订单。</p>
      </div>
      <div
        v-if="rows.length"
        class="cf-settlement-table"
      >
        <table aria-label="资金记录明细">
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
                取消时间
              </th>
              <th scope="col">
                收款快照
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.orderId"
              class="settlement-row"
            >
              <td>
                <RouterLink :to="{ name: 'admin-orders', query: { orderId: row.orderId, from: 'settlements', ...filters, page: page > 1 ? String(page) : undefined } }">
                  {{ row.title }}
                </RouterLink>
                <small>{{ row.orderType === 'STOCK' ? '现货' : '定制' }} · {{ row.orderNo }}</small>
              </td>
              <td class="cf-settlement-amount">
                ¥ {{ row.paidAmount }}
              </td>
              <td><span :data-status="row.status">{{ settlementStatus[row.status] || row.status }}</span></td>
              <td><time :datetime="row.settledAt || undefined">{{ formatTime(row.settledAt) }}</time></td>
              <td><time :datetime="row.cancelledAt || undefined">{{ formatTime(row.cancelledAt) }}</time></td>
              <td>
                {{ row.realName }}
                <small>{{ row.payeeAccount }}</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <WorkPagination
        label="资金记录分页"
        :page="page"
        :total="total"
        :loading="loading"
        @change="applyFilters($event, filters)"
      />
    </section>
  </AdminLayout>
</template>
