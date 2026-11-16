<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { getWorkHistory } from '@/api/work'
import type { WorkHistoryVO } from '@/types/work'
import WorkPagination from './WorkPagination.vue'
import WorkImage from './WorkImage.vue'
import { formatTime } from '@/utils/creator'
import { workStatusLabels } from '@/utils/work'
const props = defineProps<{ workId: string; admin?: boolean; revision?: string }>()
const rows = ref<WorkHistoryVO[]>([])
const total = ref(0)
const page = ref(1)
const error = ref('')
const loading = ref(false)
let requestRevision = 0
const labels: Record<string, string> = { CREATE: '创建草稿', SAVE: '保存内容', SUBMIT: '提交审核', WITHDRAW: '撤回审核', REVIEW: '审核结论', APPROVE: '审核通过', REJECT: '审核驳回', OFFLINE: '下架作品', TRADING_SETTINGS: '更新交易设置', UPDATE: '修改作品' }
const fields: Record<string, string> = { title: '标题', categoryId: '品类编号', material: '材质', specification: '尺寸规格', description: '作品描述', processDescription: '制作说明', saleEnabled: '出售现货', customEnabled: '接受定制', stockPrice: '现货价格', customReferenceDays: '定制周期', mainImageIds: '主图', specificationImageIds: '尺寸图' }
/** 仅通过受保护的历史接口读取快照，不从页面当前值反推审核材料。 */
async function load(next = page.value) {
  const current = ++requestRevision; page.value = next; loading.value = true; error.value = ''
  try { const result = await getWorkHistory(props.workId, next, props.admin); if (current === requestRevision) { rows.value = result.items; total.value = result.total } }
  catch (failure) { if (current === requestRevision) error.value = failure instanceof Error ? failure.message : '历史读取失败' }
  finally { if (current === requestRevision) loading.value = false }
}
function display(value: unknown) { return typeof value === 'boolean' ? value ? '开启' : '关闭' : value === null || value === undefined || value === '' ? '—' : String(value) }
watch(() => [props.workId, props.revision], () => void load(1), { immediate: true })
onBeforeUnmount(() => requestRevision++)
</script>
<template>
  <section class="work-history">
    <header class="work-section-heading">
      <div>
        <p class="eyebrow">
          EVERY CHANGE HAS A TRACE
        </p><h2>修改与审核历史</h2>
      </div>
    </header><p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        @click="load()"
      >
        重试
      </button>
    </p><p
      v-if="!rows.length && !loading && !error"
      class="field-help"
    >
      暂无操作历史。
    </p><article
      v-for="row in rows"
      :key="row.id"
      class="work-history-row"
    >
      <div class="history-dot" /><div>
        <header><strong>{{ labels[row.action] || row.action }}</strong><span>{{ row.beforeStatus ? workStatusLabels[row.beforeStatus] + ' → ' : '' }}{{ workStatusLabels[row.afterStatus] }}</span><time>{{ formatTime(row.createdAt) }}</time></header><p v-if="row.reason">
          {{ row.reason }}
        </p><p class="field-help">
          {{ row.operatorType === 'ADMIN' ? '管理员' : '创作者' }} · {{ row.operatorId }}<span v-if="row.detail?.submittedVersion"> · 审核轮次 {{ row.detail.submittedVersion }}</span>
        </p><details v-if="row.detail?.snapshot || row.detail?.before || row.detail?.after">
          <summary>查看本次材料与修改比较</summary><div class="history-comparison">
            <div
              v-for="(label, key) in fields"
              :key="key"
            >
              <template v-if="row.detail.before && row.detail.after">
                <strong>{{ label }}</strong><div
                  v-if="key === 'mainImageIds' || key === 'specificationImageIds'"
                  class="compare-values"
                >
                  <div>
                    <p>修改前</p><div class="history-images">
                      <WorkImage
                        v-for="id in row.detail.before[key] || []"
                        :key="id"
                        :image-id="id"
                        :label="`修改前${label}`"
                      />
                    </div>
                  </div>
                  <div>
                    <p>修改后</p><div class="history-images">
                      <WorkImage
                        v-for="id in row.detail.after[key] || []"
                        :key="id"
                        :image-id="id"
                        :label="`修改后${label}`"
                      />
                    </div>
                  </div>
                </div><div
                  v-else
                  class="compare-values"
                >
                  <span>修改前：{{ display(row.detail.before[key as keyof typeof row.detail.before]) }}</span><span>修改后：{{ display(row.detail.after[key as keyof typeof row.detail.after]) }}</span>
                </div>
              </template><template v-else-if="row.detail.snapshot">
                <strong>{{ label }}</strong><div
                  v-if="key === 'mainImageIds' || key === 'specificationImageIds'"
                  class="history-images"
                >
                  <WorkImage
                    v-for="id in row.detail.snapshot[key] || []"
                    :key="id"
                    :image-id="id"
                    :label="label"
                  />
                </div><p v-else>
                  {{ display(row.detail.snapshot[key as keyof typeof row.detail.snapshot]) }}
                </p>
              </template>
            </div>
          </div>
        </details>
      </div>
    </article><WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </section>
</template>
