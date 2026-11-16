<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import CreatorLayout from '@/layouts/CreatorLayout.vue'
import WorkImage from '@/components/WorkImage.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { deleteWork, getManagedWorks, getPublicationQuota, offlineWork, withdrawWork } from '@/api/work'
import type { PublicationQuotaVO, WorkStatus, WorkVO } from '@/types/work'
import { workStatusLabels } from '@/utils/work'
import { formatTime } from '@/utils/creator'
const rows = ref<WorkVO[]>([])
const quota = ref<PublicationQuotaVO>()
const status = ref<WorkStatus | ''>('')
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const busy = ref('')
const error = ref('')
let revision = 0
async function load(next = page.value) {
  const current = ++revision; page.value = next; loading.value = true; error.value = ''
  try {
    const [result, available] = await Promise.all([getManagedWorks({ status: status.value, page: next }), getPublicationQuota()])
    if (current === revision) { rows.value = result.items; total.value = result.total; quota.value = available }
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '作品读取失败' }
  finally { if (current === revision) loading.value = false }
}
/** 列表动作携带所见版本，冲突后重新查询，绝不自动覆盖新内容。 */
async function action(work: WorkVO, type: 'delete' | 'withdraw' | 'offline') {
  if (!window.confirm(type === 'delete' ? '确定删除这份草稿？' : type === 'withdraw' ? '撤回后可继续修改，确定撤回？' : '下架后将停止公开展示，确定下架？')) return
  busy.value = work.id; error.value = ''
  try {
    if (type === 'delete') await deleteWork(work.id, work.version)
    else if (type === 'withdraw') await withdrawWork(work.id, work.version)
    else await offlineWork(work.id, work.version)
    await load()
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '操作结果未知，请刷新列表核验' }
  finally { busy.value = '' }
}
onMounted(() => { void load(); window.addEventListener('work-updated', refresh) })
function refresh() { void load() }
onBeforeUnmount(() => { revision++; window.removeEventListener('work-updated', refresh) })
</script>
<template>
  <CreatorLayout>
    <header class="work-section-heading">
      <div>
        <h1>我的作品</h1>
      </div><RouterLink
        class="button-primary"
        to="/creator/works/new"
      >＋ 发布作品</RouterLink>
    </header><div
      v-if="quota"
      class="publication-quota"
    >
      <span>今日首次提交 <strong>{{ quota.used }} / {{ quota.limit }}</strong></span><span>北京时间 · 草稿和重提不重复计数</span><p v-if="!quota.canPublish">
        {{ quota.reason }}
      </p>
    </div><nav
      class="category-tabs"
      aria-label="作品状态"
    >
      <button
        :class="{ active: !status }"
        @click="status = ''; load(1)"
      >
        全部作品
      </button><button
        v-for="(label, key) in workStatusLabels"
        :key="key"
        :class="{ active: status === key }"
        @click="status = key; load(1)"
      >
        {{ label }}
      </button>
    </nav><p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }} <button
        class="inline-button"
        @click="load()"
      >
        刷新核验
      </button>
    </p><p
      v-if="loading"
      class="account-loading"
    >
      正在读取作品…
    </p><div
      v-else-if="!rows.length && !error"
      class="work-empty"
    >
      <span aria-hidden="true">✳</span><h3>好作品，从一个想法开始</h3><p>保存草稿，慢慢完善，再交给大家看见。</p><RouterLink
        class="button-secondary"
        to="/creator/works/new"
      >发布第一件作品</RouterLink>
    </div><div
      v-else
      class="managed-work-list"
    >
      <article
        v-for="work in rows"
        :key="work.id"
        class="managed-work-row"
      >
        <WorkImage
          v-if="work.mainImageIds[0]"
          :image-id="work.mainImageIds[0]"
          :initial="work.coverImage"
          :label="work.title || '草稿图片'"
        /><div
          v-else
          class="managed-work-empty-image"
        >
          拾
        </div><div class="managed-work-copy">
          <span
            class="work-status"
            :class="work.reviewStatus"
          >{{ workStatusLabels[work.reviewStatus] }}</span><h3>{{ work.title || '未命名草稿' }}</h3><p>{{ work.categoryPath.join(' / ') || '未选择品类' }} · {{ formatTime(work.updatedAt) }}</p><p
            v-if="work.reviewReason"
            class="field-error"
          >
            {{ work.reviewReason }}
          </p>
        </div><div class="managed-work-actions">
          <RouterLink
            class="inline-button"
            :to="`/creator/works/${work.id}/edit`"
          >{{ work.reviewStatus === 'PENDING' ? '查看材料' : work.reviewStatus === 'ONLINE' ? '编辑与交易设置' : '编辑作品' }}</RouterLink><RouterLink
            v-if="work.reviewStatus === 'ONLINE'"
            :to="`/works/${work.id}`"
            class="inline-button"
          >查看公开页</RouterLink><button
            v-if="work.reviewStatus === 'DRAFT'"
            class="inline-button"
            :disabled="busy === work.id"
            @click="action(work, 'delete')"
          >
            删除草稿
          </button><button
            v-if="work.reviewStatus === 'PENDING'"
            class="inline-button"
            :disabled="busy === work.id"
            @click="action(work, 'withdraw')"
          >
            撤回审核
          </button><button
            v-if="work.reviewStatus === 'ONLINE'"
            class="inline-button"
            :disabled="busy === work.id"
            @click="action(work, 'offline')"
          >
            下架
          </button>
        </div>
      </article>
    </div><WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </CreatorLayout>
</template>
