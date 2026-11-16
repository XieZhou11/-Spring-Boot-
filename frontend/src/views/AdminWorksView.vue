<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import WorkImage from '@/components/WorkImage.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getManagedWorks } from '@/api/work'
import { workStatusLabels } from '@/utils/work'
import { formatTime } from '@/utils/creator'
import type { WorkStatus, WorkVO } from '@/types/work'
import '@/assets/styles/work.css'
const status = ref<WorkStatus | ''>('PENDING')
const keyword = ref('')
const page = ref(1)
const total = ref(0)
const rows = ref<WorkVO[]>([])
const error = ref('')
const loading = ref(false)
let revision = 0
/** 筛选请求乱序时只呈现最后一次结果，保留当前审核范围。 */
async function load(next = page.value) {
  const current = ++revision; page.value = next; loading.value = true; error.value = ''
  try { const result = await getManagedWorks({ page: next, status: status.value, keyword: keyword.value }, true); if (current === revision) { rows.value = result.items; total.value = result.total } }
  catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '审核队列读取失败' }
  finally { if (current === revision) loading.value = false }
}
onMounted(() => void load())
onBeforeUnmount(() => revision++)
</script>
<template>
  <AdminLayout
    title="作品审核"
    subtitle="看见手艺，也守护每一份原创。"
  >
    <nav
      class="category-tabs"
      aria-label="审核队列状态"
    >
      <button
        :class="{ active: !status }"
        @click="status = ''; load(1)"
      >
        全部作品
      </button><button
        v-for="key in (['PENDING', 'ONLINE', 'REJECTED', 'OFFLINE'] as const)"
        :key="key"
        :class="{ active: status === key }"
        @click="status = key; load(1)"
      >
        {{ workStatusLabels[key] }}
      </button>
    </nav><form
      class="queue-toolbar"
      @submit.prevent="load(1)"
    >
      <label class="work-field">搜索作品<input
        v-model="keyword"
        type="search"
        placeholder="标题或描述"
      ></label><button
        class="button-secondary"
        type="submit"
      >
        搜索
      </button><span class="muted">共 {{ total }} 件作品</span>
    </form><p
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
    </p><p
      v-if="loading"
      class="account-loading"
    >
      正在读取审核队列…
    </p><div
      v-else-if="!rows.length && !error"
      class="work-empty"
    >
      <span aria-hidden="true">✓</span><h3>当前队列已处理完毕</h3><p>每一份审核，都让好手艺更值得信任。</p>
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
          :label="work.title"
        /><div
          v-else
          class="managed-work-empty-image"
        >
          拾
        </div><div class="managed-work-copy">
          <span
            class="work-status"
            :class="work.reviewStatus"
          >{{ workStatusLabels[work.reviewStatus] }}</span><h3>{{ work.title || '未命名草稿' }}</h3><p>{{ work.creatorNickname }} · {{ work.categoryPath.join(' / ') }}</p><p>{{ formatTime(work.submittedAt || work.updatedAt) }}</p>
        </div><RouterLink
          class="button-secondary"
          :to="`/admin/works/${work.id}`"
        >{{ work.reviewStatus === 'PENDING' ? '审核作品' : '查看材料' }} ↗</RouterLink>
      </article>
    </div><WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </AdminLayout>
</template>
