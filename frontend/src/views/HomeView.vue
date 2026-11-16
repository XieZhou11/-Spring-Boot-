<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkCard from '@/components/WorkCard.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getWorks } from '@/api/work'
import { getCategories } from '@/api/creator'
import type { CategoryVO } from '@/types/creator'
import type { WorkQuery, WorkVO } from '@/types/work'

const route = useRoute()
const router = useRouter()
const categories = ref<CategoryVO[]>([])
const parentId = ref('')
const children = computed(() => categories.value.find(c => c.id === parentId.value)?.children || [])
const query = reactive<WorkQuery>({ page: 1, sort: 'LATEST', keyword: '', categoryId: '', minPrice: '', maxPrice: '' })
const rows = ref<WorkVO[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
let revision = 0
/** 参数来自 URL，刷新、回退和共享链接保持同一筛选。 */
async function load() {
  const current = ++revision
  loading.value = true
  error.value = ''
  const q = route.query
  const string = (key: string) => typeof q[key] === 'string' ? q[key] as string : ''
  Object.assign(query, { page: Math.max(1, Number(q.page) || 1), keyword: string('keyword'), categoryId: string('categoryId'), minPrice: string('minPrice'), maxPrice: string('maxPrice'), purchasable: q.purchasable === 'true' || undefined, customizable: q.customizable === 'true' || undefined, sort: ['PRICE_ASC', 'PRICE_DESC'].includes(string('sort')) ? string('sort') : 'LATEST' })
  parentId.value = categories.value.find(c => c.id === query.categoryId || c.children.some(child => child.id === query.categoryId))?.id || ''
  try {
    const result = await getWorks(Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== undefined)))
    if (current !== revision) return
    rows.value = result.items
    total.value = result.total
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '作品读取失败' }
  finally { if (current === revision) loading.value = false }
}
function apply(page = 1) {
  const next = Object.fromEntries(Object.entries({ ...query, page }).filter(([, value]) => value !== '' && value !== undefined && value !== false).map(([key, value]) => [key, String(value)]))
  if (JSON.stringify(route.query) === JSON.stringify(next)) void load()
  else void router.push({ path: '/', query: next })
}
function selectParent(id: string) { parentId.value = id; query.categoryId = id; apply() }
watch(() => route.query, () => void load(), { immediate: true })
onMounted(async () => {
  try {
    categories.value = await getCategories()
    parentId.value = categories.value.find(c => c.id === query.categoryId || c.children.some(child => child.id === query.categoryId))?.id || ''
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '品类读取失败' }
})
onBeforeUnmount(() => revision++)
</script>

<template>
  <WorkLayout>
    <section class="discovery-hero">
      <div>
        <p class="eyebrow">
          MADE BY HAND, MEANT FOR YOU
        </p><h1>发现手作之美</h1><p>让日常慢一点，让喜欢特别一点。<br>在一针一线、一琢一磨之间，遇见有温度的好物。</p><a
          href="#discover"
          class="button-primary"
        >发现好手艺 <span aria-hidden="true">↗</span></a>
      </div><img
        src="@/assets/craft-scene.svg"
        alt="陶器、织物与手作工具组成的温暖工作台"
      ><span class="hero-note">一物一心意 · 好手艺，值得被看见</span>
    </section>
    <section
      id="discover"
      class="discovery-section"
    >
      <header class="work-section-heading">
        <div>
          <p class="eyebrow">
            THE CRAFT COLLECTION
          </p><h2>为生活，拾一份美好</h2>
        </div><span class="muted">{{ total }} 件作品</span>
      </header>
      <nav
        class="category-tabs"
        aria-label="一级品类"
      >
        <button
          :class="{ active: !parentId }"
          @click="selectParent('')"
        >
          全部作品
        </button><button
          v-for="category in categories"
          :key="category.id"
          :class="{ active: parentId === category.id }"
          @click="selectParent(category.id)"
        >
          {{ category.name }}
        </button>
      </nav>
      <nav
        v-if="children.length"
        class="category-children"
        aria-label="二级品类"
      >
        <button
          :class="{ active: query.categoryId === parentId }"
          @click="query.categoryId = parentId; apply()"
        >
          全部
        </button><button
          v-for="category in children"
          :key="category.id"
          :class="{ active: query.categoryId === category.id }"
          @click="query.categoryId = category.id; apply()"
        >
          {{ category.name }}
        </button>
      </nav>
      <form
        class="work-filters"
        @submit.prevent="apply()"
      >
        <label class="filter-keyword">关键词<input
          v-model="query.keyword"
          type="search"
          aria-label="作品关键词"
          placeholder="标题或作品描述"
        ></label><label>现货价格<input
          v-model="query.minPrice"
          inputmode="decimal"
          aria-label="最低价格"
          placeholder="最低价"
        ></label><span aria-hidden="true">—</span><label><span class="sr-only">最高价格</span><input
          v-model="query.maxPrice"
          inputmode="decimal"
          aria-label="最高价格"
          placeholder="最高价"
        ></label><label class="check-label"><input
          v-model="query.purchasable"
          type="checkbox"
        >可直购</label><label class="check-label"><input
          v-model="query.customizable"
          type="checkbox"
        >接受定制</label><label><span class="sr-only">作品排序</span><select
          v-model="query.sort"
          aria-label="作品排序"
        ><option value="LATEST">最新发布</option><option value="PRICE_ASC">价格从低到高</option><option value="PRICE_DESC">价格从高到低</option></select></label><button
          type="submit"
          class="button-primary"
        >
          筛选
        </button>
      </form>
      <p
        v-if="error"
        class="form-alert"
        role="alert"
      >
        {{ error }} <button
          class="inline-button"
          @click="load"
        >
          重新读取
        </button>
      </p><p
        v-if="loading"
        class="account-loading"
        role="status"
      >
        正在寻找好手作…
      </p><div
        v-else-if="!rows.length && !error"
        class="work-empty"
      >
        <span aria-hidden="true">✳</span><h3>还没有符合条件的作品</h3><p>试试其他品类，或放宽筛选条件。</p>
      </div><div
        v-else-if="!error"
        class="work-grid"
      >
        <WorkCard
          v-for="work in rows"
          :key="work.id"
          :work="work"
        />
      </div><WorkPagination
        :page="query.page || 1"
        :total="total"
        :loading="loading"
        @change="apply"
      />
    </section>
  </WorkLayout>
</template>
