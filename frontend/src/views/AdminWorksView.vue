<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { isNavigationFailure, useRoute, useRouter, type LocationQuery } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import WorkImage from '@/components/WorkImage.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { useHistoryReturn } from '@/composables/useHistoryReturn'
import { getManagedWorks } from '@/api/work'
import { workStatusLabels } from '@/utils/work'
import { formatTime } from '@/utils/creator'
import type { WorkStatus, WorkVO } from '@/types/work'
import '@/assets/styles/work.css'
const route = useRoute()
const router = useRouter()
const { entry } = useHistoryReturn()
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
/** 筛选放入 URL；选择材料和回退时保留同一页队列。 */
async function filter(next = 1) {
  const target = { path: '/admin/works', query: { status: status.value || 'ALL', keyword: keyword.value.trim() || undefined, page: next > 1 ? String(next) : undefined } }
  if (router.resolve(target).fullPath === route.fullPath) void load(next)
  else if (isNavigationFailure(await router.push(target))) syncFilters(route.query)
}
/** 离开被取消时恢复已生效的 URL 条件，避免按钮、页码与列表不一致。 */
function syncFilters(query: LocationQuery) {
  status.value = query.status === 'ALL' ? '' : ['PENDING', 'ONLINE', 'REJECTED', 'OFFLINE'].includes(String(query.status)) ? query.status as WorkStatus : 'PENDING'
  keyword.value = typeof query.keyword === 'string' ? query.keyword : ''
  page.value = Math.max(1, Number(query.page) || 1)
}
// 切换同一队列的审核详情时保留列表节点、滚动位置和未提交的搜索词。
watch([() => route.query.status, () => route.query.keyword, () => route.query.page], () => {
  syncFilters(route.query)
  void load()
}, { immediate: true })
onBeforeUnmount(() => revision++)
</script>
<template>
  <AdminLayout
    title="作品审核"
  >
    <div
      class="admin-review-grid"
      :class="{ 'has-selection': !!route.params.id }"
    >
      <section
        class="review-queue"
        aria-label="作品审核队列"
        :aria-busy="loading"
        :data-history-ready="!route.params.id && !loading ? route.fullPath : undefined"
      >
        <header class="review-queue-heading">
          <h2>作品队列</h2><span>{{ total }} 件作品</span>
        </header>
        <nav
          class="category-tabs"
          aria-label="审核队列状态"
        >
          <button
            :class="{ active: !status }"
            :aria-pressed="!status"
            @click="status = ''; filter(1)"
          >
            全部作品
          </button><button
            v-for="key in (['PENDING', 'ONLINE', 'REJECTED', 'OFFLINE'] as const)"
            :key="key"
            :class="{ active: status === key }"
            :aria-pressed="status === key"
            @click="status = key; filter(1)"
          >
            {{ workStatusLabels[key] }}
          </button>
        </nav><form
          class="queue-toolbar"
          @submit.prevent="filter(1)"
        >
          <label class="work-field">搜索作品<input
            v-model="keyword"
            type="search"
            aria-label="搜索作品标题或描述"
            placeholder="搜索作品标题或描述"
          ></label><button
            class="button-secondary"
            type="submit"
          >
            搜索
          </button>
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
          <h3>当前筛选条件下暂无作品</h3>
        </div><div
          v-else
          class="managed-work-list"
          data-history-scroll="admin-works-queue"
        >
          <article
            v-for="work in rows"
            :key="work.id"
            class="managed-work-row"
            :class="{ selected: route.params.id === work.id }"
          >
            <WorkImage
              v-if="work.mainImageIds[0]"
              :image-id="work.mainImageIds[0]"
              :initial="work.coverImage"
              :label="work.title"
            /><div
              v-else
              class="managed-work-empty-image"
              aria-hidden="true"
            >
              <AppIcon name="image" />
            </div><div class="managed-work-copy">
              <span
                class="work-status"
                :class="work.reviewStatus"
              >{{ workStatusLabels[work.reviewStatus] }}</span><h3>{{ work.title || `作品 ${work.id}` }}</h3><p>{{ work.creatorNickname }} · {{ work.categoryPath.join(' / ') }}</p><p>{{ formatTime(work.submittedAt || work.updatedAt) }}</p>
            </div><RouterLink
              class="text-link"
              :to="entry({ path: `/admin/works/${work.id}`, query: route.query })"
              :data-history-focus="`admin-work-${work.id}`"
              :aria-current="route.params.id === work.id ? 'true' : undefined"
            >{{ work.reviewStatus === 'PENDING' ? '审核作品' : '查看材料' }} ↗</RouterLink>
          </article>
        </div><WorkPagination
          :page="page"
          :total="total"
          :loading="loading"
          @change="filter"
        />
      </section>
      <section
        class="review-detail"
        aria-label="当前审核材料"
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
          <AppIcon name="image" /><h2>选择作品查看材料</h2>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>
