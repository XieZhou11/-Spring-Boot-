<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { getAdminDashboard } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { AdminDashboardVO } from '@/types/admin'
import { formatTime } from '@/utils/creator'
import { requestStatus } from '@/utils/customRequest'
import { orderStatus } from '@/utils/quote'
import { workStatusLabels } from '@/utils/work'

const auth = useAuthStore()
const adminId = computed(() => auth.session?.roles.includes('ADMIN') ? auth.session.userId : undefined)
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
const from = ref(today)
const to = ref(today)
const data = ref<AdminDashboardVO>()
const error = ref('')
const loading = ref(false)
let revision = 0

const queues = [
  { key: 'creatorApplications', label: '入驻审核', to: { name: 'admin-creator-applications', query: { status: 'PENDING' } } },
  { key: 'works', label: '作品审核', to: { path: '/admin/works', query: { status: 'PENDING' } } },
  { key: 'reports', label: '待处理举报', to: { path: '/admin/content-reports', query: { status: 'PENDING' } } },
  { key: 'refunds', label: '待处理售后', to: { name: 'admin-refunds', query: { status: 'WAIT_ADMIN' } } },
]

function totals(labels: Record<string, string>, counts: Record<string, number>) {
  return Object.entries(labels).map(([key, label]) => ({ label, count: counts[key] ?? 0 }))
}

const panels = computed(() => {
  if (!data.value) return []
  return [
    { title: '作品统计', entries: totals(workStatusLabels, data.value.works) },
    { title: '需求统计', entries: totals(requestStatus, data.value.requests) },
  ]
})

const orderGroups = computed(() => {
  const counts = data.value?.orders ?? {}
  return [
    { title: '现货', entries: Object.entries(orderStatus).filter(([status]) => !['PAID', 'IN_PRODUCTION'].includes(status)).map(([status, label]) => ({ label, count: counts['STOCK:' + status] ?? 0 })) },
    { title: '定制', entries: Object.entries(orderStatus).map(([status, label]) => ({ label, count: counts['CUSTOM:' + status] ?? 0 })) },
  ]
})

/** 日期只筛选新增指标，汇总金额和各状态数量由服务端统一计算。 */
async function load() {
  const userId = adminId.value
  if (!userId) return
  error.value = ''
  if (from.value > to.value) {
    error.value = '起始日期不能晚于结束日期'
    return
  }
  const current = ++revision
  loading.value = true
  try {
    const result = await getAdminDashboard({ from: from.value, to: to.value })
    if (current === revision && adminId.value === userId) data.value = result
  } catch (failure) {
    if (current === revision && adminId.value === userId) error.value = failure instanceof Error ? failure.message : '看板读取失败'
  } finally {
    if (current === revision) loading.value = false
  }
}

watch(adminId, () => {
  revision++
  data.value = undefined
  error.value = ''
  loading.value = false
  void load()
}, { immediate: true })
</script>

<template>
  <AdminLayout title="数据看板">
    <form
      class="dashboard-toolbar"
      @submit.prevent="load"
    >
      <div>
        <label>新增统计起始日<input
          v-model="from"
          type="date"
          required
        ></label>
        <label>新增统计结束日<input
          v-model="to"
          type="date"
          required
        ></label>
        <button
          class="button-secondary"
          :disabled="loading"
        >
          {{ loading ? '正在更新…' : '更新看板' }}
        </button>
      </div>
      <p
        v-if="data"
        class="dashboard-updated"
      >
        <time :datetime="data.updatedAt">更新于 {{ formatTime(data.updatedAt) }}（北京时间）</time>
      </p>
    </form>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="loading && !data"
      role="status"
    >
      正在读取看板…
    </p>
    <template v-if="data">
      <div class="dashboard-top">
        <section
          class="dashboard-panel"
          aria-labelledby="dashboard-users"
        >
          <header>
            <h2 id="dashboard-users">
              账号统计
            </h2><span>{{ data.from }} 至 {{ data.to }}</span>
          </header>
          <dl class="dashboard-metrics dashboard-metrics--users">
            <div>
              <dt>用户总数</dt><dd>{{ data.userTotal }}</dd><dd class="dashboard-muted">
                所选期间新增 {{ data.newUsers }}
              </dd>
            </div>
            <div>
              <dt>认证创作者</dt><dd>{{ data.certifiedCreators }}</dd><dd class="dashboard-muted">
                所选期间新增 {{ data.newCertifiedCreators }}
              </dd>
            </div>
          </dl>
        </section>
        <section
          class="dashboard-panel"
          aria-labelledby="dashboard-todos"
        >
          <header>
            <h2 id="dashboard-todos">
              待办队列
            </h2><span>共 {{ data.todos.total ?? 0 }} 项</span>
          </header>
          <ul class="dashboard-todos">
            <li
              v-for="queue in queues"
              :key="queue.key"
            >
              <RouterLink :to="queue.to"><span>{{ queue.label }}</span><strong>{{ data.todos[queue.key] ?? 0 }}</strong></RouterLink>
            </li>
          </ul>
        </section>
      </div>
      <section
        class="dashboard-panel"
        aria-labelledby="dashboard-funds"
      >
        <header>
          <h2 id="dashboard-funds">
            模拟资金
          </h2><RouterLink
            class="text-link"
            to="/admin/settlements"
          >查看资金记录</RouterLink>
        </header>
        <dl class="dashboard-metrics dashboard-metrics--funds">
          <div><dt>模拟支付</dt><dd>¥ {{ data.paymentAmount }}</dd></div>
          <div><dt>模拟退款</dt><dd>¥ {{ data.refundAmount }}</dd></div>
          <div><dt>待结算金额</dt><dd>¥ {{ data.pendingSettlementAmount }}</dd></div>
          <div><dt>已结算金额</dt><dd>¥ {{ data.settledAmount }}</dd></div>
        </dl>
      </section>
      <div class="dashboard-breakdown">
        <section
          v-for="panel in panels"
          :key="panel.title"
          class="dashboard-panel"
        >
          <header><h2>{{ panel.title }}</h2><span>共 {{ panel.entries.reduce((sum, item) => sum + item.count, 0) }} 项</span></header>
          <dl class="dashboard-states">
            <div
              v-for="item in panel.entries"
              :key="item.label"
            >
              <dt>{{ item.label }}</dt><dd>{{ item.count }}</dd>
            </div>
          </dl>
        </section>
        <section
          class="dashboard-panel dashboard-orders"
          aria-labelledby="dashboard-orders"
        >
          <header>
            <h2 id="dashboard-orders">
              订单统计
            </h2><RouterLink
              class="text-link"
              to="/admin/orders"
            >查看订单</RouterLink>
          </header>
          <div class="dashboard-order-types">
            <div
              v-for="group in orderGroups"
              :key="group.title"
            >
              <h3>{{ group.title }}</h3>
              <dl class="dashboard-states">
                <div
                  v-for="item in group.entries"
                  :key="item.label"
                >
                  <dt>{{ item.label }}</dt><dd>{{ item.count }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </div>
    </template>
  </AdminLayout>
</template>

<style scoped>
.dashboard-toolbar,
.dashboard-toolbar > div,
.dashboard-panel header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.dashboard-toolbar { margin-bottom: 16px; }
.dashboard-toolbar label {
  display: grid;
  gap: 5px;
  color: var(--craft-muted);
  font-size: 12px;
  font-weight: 600;
}
.dashboard-toolbar input {
  min-height: 36px;
  padding: 5px 10px;
  border: 1px solid var(--craft-border);
  border-radius: 8px;
  background: var(--craft-surface);
  color: var(--craft-ink);
  font: inherit;
}
.dashboard-updated { margin: 0 0 8px; color: var(--craft-muted); font-size: 12px; }
.dashboard-top,
.dashboard-breakdown,
.dashboard-order-types { display: grid; gap: 14px; }
.dashboard-top { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); }
.dashboard-breakdown { grid-template-columns: repeat(2, minmax(0, 1fr)) minmax(0, 1.8fr); }
.dashboard-panel {
  min-width: 0;
  margin-bottom: 14px;
  padding: 17px;
  border: 1px solid var(--craft-border);
  border-radius: 14px;
  background: var(--craft-surface);
}
.dashboard-panel header {
  align-items: center;
  margin-bottom: 13px;
  color: var(--craft-muted);
  font-size: 12px;
}
.dashboard-panel h2,
.dashboard-panel h3 { margin: 0; color: var(--craft-ink); }
.dashboard-panel h2 { font-size: 15px; }
.dashboard-panel h3 { margin-bottom: 6px; font-size: 12px; }
.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}
.dashboard-metrics--funds { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.dashboard-metrics > div { padding: 10px 12px; border-radius: 9px; background: var(--craft-bg); }
.dashboard-metrics dt,
.dashboard-metrics .dashboard-muted { color: var(--craft-muted); font-size: 12px; }
.dashboard-metrics dd { margin: 3px 0 0; font-size: 23px; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.dashboard-todos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dashboard-todos a,
.dashboard-states > div {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}
.dashboard-todos a { padding: 8px 10px; border-radius: 7px; color: var(--craft-ink); background: var(--craft-bg); }
.dashboard-todos a:hover { color: #854d0e; background: #fffbeb; }
.dashboard-todos strong { font-variant-numeric: tabular-nums; }
.dashboard-states { margin: 0; }
.dashboard-states > div { padding: 5px 0; border-bottom: 1px solid var(--craft-border); }
.dashboard-states > div:last-child { border-bottom: 0; }
.dashboard-states dt { color: var(--craft-muted); }
.dashboard-states dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.dashboard-order-types { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 1050px) {
  .dashboard-breakdown { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-orders { grid-column: 1 / -1; }
}
@media (max-width: 700px) {
  .dashboard-top { grid-template-columns: 1fr; }
  .dashboard-metrics--funds { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
