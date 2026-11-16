<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getCategories } from '@/api/creator'
import { getRequestQuota, getRequests } from '@/api/customRequest'
import type { CategoryVO } from '@/types/creator'
import type { CustomRequestVO, RequestQuotaVO } from '@/types/customRequest'
import { requestStatus } from '@/utils/customRequest'
import { formatTime } from '@/utils/creator'
import '@/assets/styles/custom-request.css'
const props = defineProps<{ scope: 'hall' | 'mine' | 'invitations' }>()
const title = computed(() => props.scope === 'hall' ? '需求大厅' : props.scope === 'mine' ? '我的需求' : '收到的定向邀约')
const rows = ref<CustomRequestVO[]>([]); const categories = ref<CategoryVO[]>([]); const quota = ref<RequestQuotaVO>()
const page = ref(1); const total = ref(0); const loading = ref(false); const error = ref('')
const filters = reactive({ categoryId: '', minBudget: '', maxBudget: '', publishedAfter: '', publishedBefore: '', allCategories: false, status: '' })
const selectable = computed(() => categories.value.flatMap(root => root.children.length ? root.children.filter(c => c.enabled && c.selectableForWork).map(c => ({ id: c.id, name: `${root.name} / ${c.name}` })) : root.enabled && root.selectableForWork ? [{ id: root.id, name: root.name }] : []))
let revision = 0
/** 大厅默认由服务端按认证主品类过滤；切换筛选只重置页码。 */
async function load(next = page.value) {
  const current = ++revision; loading.value = true; error.value = ''; page.value = next
  try {
    const params = Object.fromEntries(Object.entries({ ...(props.scope === 'hall' ? filters : { status: filters.status }), page: next }).filter(([, value]) => value !== ''))
    if (filters.publishedAfter) params.publishedAfter = `${filters.publishedAfter}T00:00:00+08:00`
    if (filters.publishedBefore) params.publishedBefore = `${filters.publishedBefore}T00:00:00+08:00`
    const result = await getRequests(params, props.scope)
    if (current !== revision) return
    rows.value = result.items; total.value = result.total
    if (props.scope === 'mine') quota.value = await getRequestQuota()
  } catch (failure) { if (current === revision) { rows.value = []; error.value = failure instanceof Error ? failure.message : '需求读取失败' } }
  finally { if (current === revision) loading.value = false }
}
watch(() => props.scope, () => { rows.value = []; Object.assign(filters, { categoryId: '', minBudget: '', maxBudget: '', publishedAfter: '', publishedBefore: '', allCategories: false, status: '' }); void load(1) })
onMounted(() => { void load(); void getCategories().then(result => categories.value = result).catch(() => { /* 主列表仍显示具体请求错误。 */ }) })
onBeforeUnmount(() => revision++)
</script>
<template>
  <WorkLayout>
    <nav
      class="request-tabs"
      aria-label="定制需求"
    >
      <RouterLink to="/account/requests">我的需求</RouterLink><RouterLink to="/requests">需求大厅</RouterLink><RouterLink to="/creator/invitations">收到的邀约</RouterLink>
    </nav>
    <header class="work-section-heading">
      <div>
        <p class="eyebrow">
          AN IDEA, A PAIR OF HANDS
        </p><h1>{{ title }}</h1><p class="muted">
          {{ scope === 'hall' ? '发现一个值得用手艺回应的想法。' : scope === 'mine' ? '从一份想法开始，慢慢做成心里的样子。' : '有人欣赏你的手艺，想请你专门做一件。' }}
        </p>
      </div><RouterLink
        v-if="scope === 'mine'"
        class="button-primary"
        to="/account/requests/new"
      >发布定制需求 ↗</RouterLink>
    </header>
    <p
      v-if="quota"
      class="field-help"
    >
      开放中 {{ quota.used }} / {{ quota.limit }} 条 · 草稿不占额度
    </p>
    <form
      class="request-filters"
      @submit.prevent="load(1)"
    >
      <template v-if="scope === 'hall'">
        <label>需求品类<select
          v-model="filters.categoryId"
          aria-label="筛选需求品类"
        ><option value="">{{ filters.allCategories ? '所有启用品类' : '我的认证主品类' }}</option><option
          v-for="category in selectable"
          :key="category.id"
          :value="category.id"
        >{{ category.name }}</option></select></label><label>预算下限<input
          v-model="filters.minBudget"
          inputmode="decimal"
          aria-label="筛选预算下限"
          placeholder="元"
        ></label><label>预算上限<input
          v-model="filters.maxBudget"
          inputmode="decimal"
          aria-label="筛选预算上限"
          placeholder="元"
        ></label><label>发布起日<input
          v-model="filters.publishedAfter"
          type="date"
        ></label><label>发布止日（不含）<input
          v-model="filters.publishedBefore"
          type="date"
        ></label><label class="request-check"><input
          v-model="filters.allCategories"
          type="checkbox"
          @change="filters.categoryId = ''"
        >查看其他品类</label>
      </template>
      <label v-else>需求状态<select v-model="filters.status"><option value="">全部状态</option><option
        v-for="(label, state) in requestStatus"
        :key="state"
        :value="state"
      >{{ label }}</option></select></label>
      <button
        class="button-secondary"
        :disabled="loading"
      >
        {{ loading ? '读取中…' : '筛选需求' }}
      </button>
    </form>
    <p
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
      v-if="loading && !rows.length"
      role="status"
    >
      正在读取需求…
    </p>
    <div
      v-else-if="!rows.length && !error"
      class="work-empty"
    >
      <h2>{{ scope === 'mine' ? '把第一个想法写下来' : '暂时没有符合条件的需求' }}</h2><p>{{ scope === 'mine' ? '草稿可以慢慢完善，准备好后再发布。' : '可以调整筛选，或稍后回来看看。' }}</p>
    </div>
    <div class="request-list">
      <article
        v-for="row in rows"
        :key="row.id"
        class="request-card"
      >
        <header><span class="eyebrow">{{ row.categoryPath.join(' / ') || '未选择品类' }}</span><span class="work-status">{{ requestStatus[row.status] || row.status }}</span></header><h2><RouterLink :to="row.canEdit && scope === 'mine' ? `/account/requests/${row.id}/edit` : `/requests/${row.id}`">{{ row.title || '未命名草稿' }}</RouterLink></h2><p class="request-excerpt">
          {{ row.description || '还没有填写描述' }}
        </p><footer><strong class="work-price">{{ row.budgetMin ? `¥ ${row.budgetMin} — ${row.budgetMax || '待定'}` : '预算待填写' }}</strong><span>{{ row.visibility === 'DIRECTED' ? '定向邀约' : '公开需求' }} · {{ row.buyerNickname }}</span><time>{{ formatTime(row.publishedAt || row.updatedAt) }}</time></footer>
      </article>
    </div>
    <WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </WorkLayout>
</template>
