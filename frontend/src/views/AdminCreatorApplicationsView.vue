<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import { getApplications } from '@/api/creator'
import type { ApplicationStatus, ApplicationSummaryVO } from '@/types/creator'
import { applicationStatusLabels, formatTime } from '@/utils/creator'

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
onMounted(() => void load())
</script>

<template>
  <AdminLayout
    title="创作者入驻审核"
    subtitle="从成品到制作过程，认真了解每一位创作者。"
  >
    <div class="queue-toolbar">
      <label>审核状态 <select
        v-model="status"
        @change="load(true)"
      ><option value="PENDING">待审核</option><option value="APPROVED">已认证</option><option value="REJECTED">已驳回</option><option value="WITHDRAWN">已撤回</option></select></label><span>共 {{ total }} 份申请</span><button
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
      role="status"
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
        <span aria-hidden="true">✓</span><h2>这里暂时没有申请</h2><p>可切换状态查看历史审核记录。</p>
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
            >
              <td><strong>{{ row.nickname }}</strong><small>#{{ row.id }}</small></td><td>{{ formatTime(row.submittedAt) }}</td><td>
                <span
                  class="status-pill"
                  :data-status="row.status"
                >{{ applicationStatusLabels[row.status] }}</span>
              </td><td>
                <RouterLink
                  class="text-link"
                  :to="`/admin/creator-applications/${row.id}`"
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
        @click="page--; load()"
      >
        上一页
      </button><span>第 {{ page }} 页 · 共 {{ total }} 条</span><button
        class="button-secondary"
        :disabled="loading || page * 20 >= total"
        @click="page++; load()"
      >
        下一页
      </button>
    </div>
  </AdminLayout>
</template>
