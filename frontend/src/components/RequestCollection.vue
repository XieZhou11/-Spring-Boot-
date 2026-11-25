<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getCategories } from '@/api/creator'
import { getRequestQuota, getRequests } from '@/api/customRequest'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { CategoryVO } from '@/types/creator'
import type { CustomRequestVO, RequestQuotaVO } from '@/types/customRequest'
import { requestBudget, requestListPaths, requestStatus } from '@/utils/customRequest'
import { formatTime } from '@/utils/creator'
import '@/assets/styles/craftflow-demand.css'

const props = defineProps<{
  scope: keyof typeof requestListPaths
  location: string
  selectedId?: string
  refreshVersion?: number
}>()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const listRoute = computed(() => router.resolve(props.location))
const isBuyer = computed(() => props.scope === 'mine')
const title = computed(() => ({ mine: '我的需求', hall: '需求大厅', invitations: '收到的定向邀约' })[props.scope])
const rows = ref<CustomRequestVO[]>([])
const categories = ref<CategoryVO[]>([])
const quota = ref<RequestQuotaVO>()
const total = ref(0)
const loading = ref(false)
const error = ref('')
const hallKeys = ['categoryId', 'minBudget', 'maxBudget', 'publishedAfter', 'publishedBefore', 'allCategories'] as const
const filters = reactive({ categoryId: '', minBudget: '', maxBudget: '', publishedAfter: '', publishedBefore: '', allCategories: '', status: '' })
const queryKeys = computed(() => props.scope === 'hall' ? hallKeys : ['status'] as const)
const applied = computed<Record<string, string>>(() => {
  const query = listRoute.value.query
  const values: Record<string, string> = {}
  for (const key of queryKeys.value) {
    const value = query[key]
    if (typeof value === 'string' && value) values[key] = value
  }
  if (values.allCategories !== 'true') delete values.allCategories
  if (values.status === 'ALL') delete values.status
  return values
})
const page = computed(() => {
  const value = listRoute.value.query.page
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 1
  return Math.min(1000000, Math.max(1, parsed))
})
const selectable = computed(() => categories.value.flatMap(root => {
  if (!root.enabled) return []
  if (!root.children.length) return root.selectableForWork ? [{ id: root.id, name: root.name }] : []
  return root.children.filter(child => child.enabled && child.selectableForWork)
    .map(child => ({ id: child.id, name: `${root.name} / ${child.name}` }))
}))
let revision = 0

/** 仅按已提交到地址栏的筛选和页码读取，保证刷新及返回可以恢复结果。 */
async function load() {
  if (!auth.session) return
  const current = ++revision
  loading.value = true
  error.value = ''
  const params: Record<string, string | number> = { ...applied.value, page: page.value }
  for (const key of ['publishedAfter', 'publishedBefore'] as const) {
    if (params[key]) params[key] = `${params[key]}T00:00:00+08:00`
  }
  try {
    const result = await getRequests(params, props.scope)
    if (current !== revision) return
    rows.value = result.items
    total.value = result.total
  } catch (failure) {
    if (current !== revision) return
    rows.value = []
    total.value = 0
    error.value = failure instanceof Error ? failure.message : '需求读取失败'
  } finally {
    if (current === revision) loading.value = false
  }
  if (isBuyer.value && current === revision) {
    try {
      const result = await getRequestQuota()
      if (current === revision) quota.value = result
    } catch {
      // 额度读取失败时保留已加载的需求，可随下次同步更新额度。
    }
  }
}

function goToList(values: Record<string, string>, next: number) {
  const query = Object.fromEntries(queryKeys.value.filter(key => values[key]).map(key => [key, values[key]]))
  if (next > 1) query.page = String(next)
  const target = { path: requestListPaths[props.scope], query }
  if (router.resolve(target).fullPath === router.currentRoute.value.fullPath) void load()
  else void router.push(target)
}

function openRequest(row: CustomRequestVO) {
  return { name: 'custom-request-detail', params: { id: row.id }, query: { returnTo: listRoute.value.fullPath } }
}

function createRequestLink() {
  const returnTo = listRoute.value.fullPath
  return { path: '/my-requests/new', query: returnTo === requestListPaths.mine ? {} : { returnTo } }
}

watch([() => props.scope, () => listRoute.value.fullPath], () => {
  for (const key of [...hallKeys, 'status'] as const) filters[key] = applied.value[key] || ''
  rows.value = []
  total.value = 0
  void load()
}, { immediate: true })
watch(() => auth.session?.userId, () => {
  revision++
  rows.value = []
  total.value = 0
  quota.value = undefined
  loading.value = false
  error.value = ''
  void load()
}, { flush: 'sync' })
watch(() => props.refreshVersion, () => { void load() })
watch(() => props.scope, scope => {
  quota.value = undefined
  if (scope === 'hall') void getCategories().then(result => categories.value = result).catch(() => { /* 主列表独立显示读取错误。 */ })
}, { immediate: true })

/** 收到状态变化或实时重连时重新核验服务端结果。 */
function refresh() { void load() }
function visible() { if (document.visibilityState === 'visible') refresh() }
watch(() => notifications.connected, (connected, previous) => { if (connected && !previous) refresh() })
onMounted(() => {
  window.addEventListener('custom-request-updated', refresh)
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', visible)
})
onBeforeUnmount(() => {
  revision++
  window.removeEventListener('custom-request-updated', refresh)
  window.removeEventListener('focus', refresh)
  document.removeEventListener('visibilitychange', visible)
})
</script>

<template>
  <section
    class="cf-request-collection"
    :class="{ 'cf-request-rail': isBuyer }"
    :aria-label="title"
  >
    <header class="cf-request-list-heading">
      <div>
        <component :is="selectedId ? 'h2' : 'h1'">
          {{ title }}
        </component>
        <p v-if="isBuyer && quota">
          开放中 {{ quota.used }} / {{ quota.limit }} 条 · 草稿不占额度
        </p>
      </div>
      <RouterLink
        v-if="isBuyer"
        class="button-primary"
        :to="createRequestLink()"
      >
        <AppIcon name="plus" />发布定制需求
      </RouterLink>
    </header>

    <form
      class="cf-request-filters"
      @submit.prevent="goToList(filters, 1)"
    >
      <template v-if="scope === 'hall'">
        <label>
          需求品类
          <select
            v-model="filters.categoryId"
            aria-label="筛选需求品类"
          >
            <option value="">{{ filters.allCategories ? '所有启用品类' : '我的认证主品类' }}</option>
            <option
              v-for="category in selectable"
              :key="category.id"
              :value="category.id"
            >{{ category.name }}</option>
          </select>
        </label>
        <label>
          预算下限
          <input
            v-model="filters.minBudget"
            inputmode="decimal"
            aria-label="筛选预算下限"
            placeholder="元"
          >
        </label>
        <label>
          预算上限
          <input
            v-model="filters.maxBudget"
            inputmode="decimal"
            aria-label="筛选预算上限"
            placeholder="元"
          >
        </label>
        <label>发布起日<input
          v-model="filters.publishedAfter"
          type="date"
        ></label>
        <label>发布止日（不含）<input
          v-model="filters.publishedBefore"
          type="date"
        ></label>
        <label class="cf-request-check">
          <input
            v-model="filters.allCategories"
            type="checkbox"
            true-value="true"
            false-value=""
            @change="filters.categoryId = ''"
          >
          查看其他品类
        </label>
      </template>
      <label v-else>
        需求状态
        <select
          v-model="filters.status"
          aria-label="需求状态"
        >
          <option value="">全部状态</option>
          <option
            v-for="(label, state) in requestStatus"
            :key="state"
            :value="state"
          >{{ label }}</option>
        </select>
      </label>
      <button
        class="button-secondary"
        :disabled="loading"
      >
        筛选需求
      </button>
    </form>

    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
      <button
        class="inline-button"
        @click="load"
      >
        重新读取
      </button>
    </p>
    <p
      v-else-if="loading && !rows.length"
      class="cf-request-state"
      role="status"
    >
      正在读取需求…
    </p>
    <div
      v-else-if="!rows.length"
      class="cf-request-state"
    >
      <p>{{ isBuyer && !applied.status && page === 1 ? '还没有定制需求' : '暂时没有符合条件的需求' }}</p>
    </div>

    <div
      v-if="rows.length"
      class="cf-request-list"
    >
      <template
        v-for="row in rows"
        :key="row.id"
      >
        <RouterLink
          v-if="isBuyer"
          class="cf-request-item"
          :class="{ 'is-selected': selectedId === row.id }"
          :to="openRequest(row)"
          :aria-label="row.title || '未命名草稿'"
          :aria-current="selectedId === row.id ? 'page' : undefined"
        >
          <span class="cf-request-tags">
            <span
              class="cf-request-status"
              :data-status="row.status"
            >{{ requestStatus[row.status] || row.status }}</span>
            <span
              class="cf-request-status"
              :data-visibility="row.visibility"
            >{{ row.visibility === 'DIRECTED' ? '定向邀约' : '公开需求' }}</span>
          </span>
          <strong>{{ row.title || '未命名草稿' }}</strong>
          <span class="cf-request-item-meta">
            <span>{{ requestBudget(row) }}</span>
            <time :datetime="row.publishedAt || row.updatedAt">{{ formatTime(row.publishedAt || row.updatedAt) }}</time>
          </span>
          <span
            v-if="row.invitedCreatorNickname"
            class="cf-request-item-meta"
          >受邀创作者 {{ row.invitedCreatorNickname }}</span>
        </RouterLink>
        <article
          v-else
          class="cf-request-card"
        >
          <header class="cf-request-tags">
            <span
              class="cf-request-status"
              :data-status="row.status"
            >{{ requestStatus[row.status] || row.status }}</span>
            <span
              class="cf-request-status"
              :data-visibility="row.visibility"
            >{{ row.visibility === 'DIRECTED' ? '定向邀约' : '公开需求' }}</span>
            <span class="cf-request-category">{{ row.categoryPath.join(' / ') }}</span>
          </header>
          <h2><RouterLink :to="openRequest(row)">{{ row.title || '未命名草稿' }}</RouterLink></h2>
          <p
            v-if="row.description"
            class="cf-request-excerpt"
          >
            {{ row.description }}
          </p>
          <dl class="cf-request-card-facts">
            <div><dt>预算</dt><dd>{{ requestBudget(row) }}</dd></div>
            <div><dt>期望发货</dt><dd>{{ row.expectedShipDate || '待填写' }}</dd></div>
          </dl>
          <footer>
            <span>{{ row.buyerNickname }} · <time :datetime="row.publishedAt || row.updatedAt">{{ formatTime(row.publishedAt || row.updatedAt) }}</time></span>
            <RouterLink
              class="button-secondary"
              :to="openRequest(row)"
              :aria-label="`查看需求详情：${row.title}`"
            >查看详情</RouterLink>
          </footer>
        </article>
      </template>
    </div>
    <WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="goToList(applied, $event)"
    />
  </section>
</template>
