<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { isNavigationFailure, useRoute, useRouter, type LocationQuery } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { getApplications } from '@/api/creator'
import type { ApplicationStatus, ApplicationSummaryVO } from '@/types/creator'
import { applicationStatusLabels, formatTime } from '@/utils/creator'

const route = useRoute()
const router = useRouter()
const status = ref<ApplicationStatus>('PENDING')
const rows = ref<ApplicationSummaryVO[]>([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const total = ref(0)
let revision = 0
/** 队列以服务端提交顺序为准，筛选后回到第一页。 */
async function load(reset = false) {
  if (reset) page.value = 1
  const current = ++revision
  loading.value = true
  error.value = ''
  try {
    const result = await getApplications(page.value, true, status.value)
    if (current !== revision) return
    rows.value = result.items
    total.value = result.total
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '审核队列读取失败' }
  finally { if (current === revision) loading.value = false }
}
/** 队列条件随子路由保留，刷新和返回列表都恢复同一审核范围。 */
async function filter() {
  const target = { path: '/admin/creator-applications', query: { status: status.value, page: page.value > 1 ? String(page.value) : undefined } }
  if (router.resolve(target).fullPath === route.fullPath) void load()
  else if (isNavigationFailure(await router.push(target))) syncFilters(route.query)
}
/** 离开被取消时恢复已生效的筛选和页码，保持队列与控件一致。 */
function syncFilters(query: LocationQuery) {
  status.value = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'].includes(String(query.status)) ? query.status as ApplicationStatus : 'PENDING'
  page.value = Math.max(1, Number(query.page) || 1)
}
watch(() => route.query, query => {
  syncFilters(query)
  void load()
}, { immediate: true })
onBeforeUnmount(() => revision++)
</script>

<template>
  <AdminLayout
    title="创作者入驻审核"
    presentation="craftflow"
  >
    <div
      class="admin-review-grid"
      :class="{ 'has-selection': !!route.params.id }"
    >
      <section
        class="review-queue"
        aria-label="入驻审核队列"
        :aria-busy="loading"
      >
        <header class="review-queue-heading">
          <h2>入驻申请</h2><span>{{ total }} 份申请</span>
        </header>
        <div class="queue-toolbar">
          <label>审核状态 <select
            v-model="status"
            aria-label="审核状态"
            @change="page = 1; filter()"
          ><option value="PENDING">待审核</option><option value="APPROVED">已认证</option><option value="REJECTED">已驳回</option><option value="WITHDRAWN">已撤回</option></select></label><button
            class="button-secondary"
            :disabled="loading"
            @click="load()"
          >
            刷新队列
          </button>
        </div>
        <p
          v-if="loading"
          class="account-loading"
        >
          正在读取审核队列…
        </p><p
          v-else-if="error"
          class="form-alert"
          role="alert"
        >
          {{ error }}
        </p>
        <template v-else>
          <div
            v-if="!rows.length"
            class="creator-empty"
          >
            <h3>当前状态暂无申请</h3><p>切换状态可查看历史审核记录。</p>
          </div><div
            v-else
            class="review-table-wrap"
          >
            <table class="review-table">
              <thead>
                <tr>
                  <th scope="col">
                    申请编号 / 申请人
                  </th><th scope="col">
                    提交时间
                  </th><th scope="col">
                    状态
                  </th><th scope="col">
                    材料
                  </th>
                </tr>
              </thead><tbody>
                <tr
                  v-for="row in rows"
                  :key="row.id"
                  :class="{ selected: route.params.id === row.id }"
                >
                  <td><strong>{{ row.nickname }}</strong><small>#{{ row.id }}</small></td><td>{{ formatTime(row.submittedAt) }}</td><td>
                    <span
                      class="status-pill"
                      :data-status="row.status"
                    >{{ applicationStatusLabels[row.status] }}</span>
                  </td><td>
                    <RouterLink
                      class="text-link"
                      :aria-current="route.params.id === row.id ? 'true' : undefined"
                      :to="{ path: `/admin/creator-applications/${row.id}`, query: route.query }"
                    >查看材料 ↗</RouterLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <div
          v-if="total > 20"
          class="pagination"
        >
          <button
            class="button-secondary"
            :disabled="loading || page <= 1"
            @click="page--; filter()"
          >
            上一页
          </button><span>第 {{ page }} 页 · 共 {{ total }} 条</span><button
            class="button-secondary"
            :disabled="loading || page * 20 >= total"
            @click="page++; filter()"
          >
            下一页
          </button>
        </div>
      </section>
      <section
        class="review-detail"
        aria-label="当前入驻材料"
      >
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :key="String(route.params.id)"
            @reviewed="load()"
          />
        </RouterView>
        <div
          v-if="!route.params.id"
          class="review-placeholder"
        >
          <AppIcon name="shield" /><h2>选择申请查看材料</h2>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>
