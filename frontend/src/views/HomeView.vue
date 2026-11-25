<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import WorkLayout from '@/layouts/WorkLayout.vue'
import WorkCard from '@/components/WorkCard.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getWorks } from '@/api/work'
import { getCategories } from '@/api/creator'
import type { CategoryVO } from '@/types/creator'
import type { WorkQuery, WorkVO } from '@/types/work'
import '@/assets/styles/craftflow-works.css'

const route = useRoute()
const router = useRouter()
const categories = ref<CategoryVO[]>([])
const categoryError = ref('')
const loadingCategories = ref(true)
const query = reactive<WorkQuery>({})
const parentId = computed(() => categories.value.find(category =>
  category.id === query.categoryId || category.children.some(child => child.id === query.categoryId),
)?.id || '')
const children = computed(() => categories.value.find(category => category.id === parentId.value)?.children || [])
const rows = ref<WorkVO[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
let revision = 0
let disposed = false

/** 以网址为已应用条件，刷新、浏览器回退和分享链接都执行相同查询。 */
function readFilters() {
  const string = (key: string) => typeof route.query[key] === 'string' ? route.query[key] : ''
  const page = Number(string('page'))
  const sort = string('sort')
  Object.assign(query, {
    page: Number.isInteger(page) && page >= 1 && page <= 1_000_000 ? page : 1,
    keyword: string('keyword'),
    categoryId: string('categoryId'),
    minPrice: string('minPrice'),
    maxPrice: string('maxPrice'),
    purchasable: string('purchasable') === 'true',
    customizable: string('customizable') === 'true',
    sort: sort === 'PRICE_ASC' || sort === 'PRICE_DESC' ? sort : 'LATEST',
  })
}

/** 后发查询优先，慢响应不得覆盖已切换的筛选与页码。 */
async function load() {
  const current = ++revision
  loading.value = true
  error.value = ''
  try {
    const result = await getWorks(Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== '' && value !== false),
    ))
    if (current !== revision) return
    rows.value = result.items
    total.value = result.total
  } catch (failure) {
    if (current === revision) error.value = failure instanceof Error ? failure.message : '作品读取失败'
  } finally {
    if (current === revision) loading.value = false
  }
}

/** 品类读取可以独立重试，作品列表仍可继续搜索和翻页。 */
async function loadCategories() {
  loadingCategories.value = true
  categoryError.value = ''
  try {
    const result = await getCategories()
    if (!disposed) categories.value = result
  } catch (failure) {
    if (!disposed) categoryError.value = failure instanceof Error ? failure.message : '品类读取失败'
  } finally {
    if (!disposed) loadingCategories.value = false
  }
}

/** 提交或换品类时从第一页开始，翻页沿用已应用的条件。 */
function apply(page = 1) {
  const next = Object.fromEntries(
    Object.entries({ ...query, keyword: query.keyword?.trim(), page })
      .filter(([, value]) => value != null && value !== '' && value !== false)
      .map(([key, value]) => [key, String(value)]),
  )
  const target = { path: route.path, query: next, hash: route.hash }
  if (router.resolve(target).fullPath === route.fullPath) void load()
  else void router.push(target)
}

function selectCategory(id: string) {
  query.categoryId = id
  apply()
}

function changePage(page: number) {
  readFilters()
  apply(page)
}

watch(() => route.query, () => {
  readFilters()
  void load()
}, { immediate: true })
onMounted(loadCategories)
onBeforeUnmount(() => {
  disposed = true
  revision++
})
</script>

<template>
  <WorkLayout>
    <div class="cf-works">
      <form
        class="cf-work-search"
        @submit.prevent="apply()"
      >
        <div class="cf-work-search-heading">
          <div>
            <h1>作品广场</h1>
            <p>发现原创手工作品，选购单件现货或以作品为参考发起同类定制。</p>
          </div>
          <div class="cf-work-search-fields">
            <div class="cf-work-keyword">
              <AppIcon name="search" />
              <input
                v-model="query.keyword"
                type="search"
                aria-label="作品关键词"
                maxlength="100"
                placeholder="搜索作品标题或描述"
              >
            </div>
            <select
              v-model="query.sort"
              aria-label="作品排序"
            >
              <option value="LATEST">
                最新发布
              </option>
              <option value="PRICE_ASC">
                现货价格：低到高
              </option>
              <option value="PRICE_DESC">
                现货价格：高到低
              </option>
            </select>
          </div>
        </div>
        <div class="cf-work-filter-row">
          <nav
            class="cf-work-categories"
            aria-label="一级品类"
          >
            <button
              type="button"
              :aria-pressed="!query.categoryId"
              @click="selectCategory('')"
            >
              全部作品
            </button>
            <button
              v-for="category in categories"
              :key="category.id"
              type="button"
              :aria-pressed="parentId === category.id"
              @click="selectCategory(category.id)"
            >
              {{ category.name }}
            </button>
          </nav>
          <div class="cf-work-criteria">
            <div
              class="cf-work-trade"
              role="group"
              aria-label="交易属性"
            >
              <label><input
                v-model="query.purchasable"
                type="checkbox"
              >可直购</label>
              <label><input
                v-model="query.customizable"
                type="checkbox"
              >接受定制</label>
            </div>
            <div
              class="cf-work-price-range"
              role="group"
              aria-label="现货价格区间"
            >
              <input
                v-model="query.minPrice"
                inputmode="decimal"
                aria-label="最低价格"
                placeholder="最低价"
              >
              <span aria-hidden="true">–</span>
              <input
                v-model="query.maxPrice"
                inputmode="decimal"
                aria-label="最高价格"
                placeholder="最高价"
              >
            </div>
            <button
              type="submit"
              class="button-primary"
            >
              筛选
            </button>
          </div>
        </div>
        <nav
          v-if="children.length"
          class="cf-work-categories cf-work-subcategories"
          aria-label="二级品类"
        >
          <button
            type="button"
            :aria-pressed="query.categoryId === parentId"
            @click="selectCategory(parentId)"
          >
            全部
          </button>
          <button
            v-for="category in children"
            :key="category.id"
            type="button"
            :aria-pressed="query.categoryId === category.id"
            @click="selectCategory(category.id)"
          >
            {{ category.name }}
          </button>
        </nav>
        <p
          v-if="categoryError"
          class="cf-work-error"
          role="alert"
        >
          {{ categoryError }}
          <button
            type="button"
            class="inline-button"
            @click="loadCategories"
          >
            重新读取品类
          </button>
        </p>
        <p
          v-else-if="loadingCategories"
          class="cf-work-status"
          role="status"
        >
          正在读取品类…
        </p>
      </form>
      <section
        id="discover"
        class="cf-work-results"
        aria-label="搜索结果"
        :aria-busy="loading"
      >
        <div
          v-if="error"
          class="cf-work-state cf-work-error"
          role="alert"
        >
          {{ error }}
          <button
            type="button"
            class="inline-button"
            @click="apply(query.page)"
          >
            重新读取
          </button>
        </div>
        <p
          v-else-if="loading"
          class="cf-work-state cf-work-status"
          role="status"
        >
          正在读取作品…
        </p>
        <div
          v-else-if="!rows.length"
          class="cf-work-state"
        >
          <h2>还没有符合条件的作品</h2>
          <p>试试其他关键词，或放宽筛选条件。</p>
        </div>
        <template v-else>
          <p class="cf-work-count">
            共 {{ total }} 件作品
          </p>
          <div class="work-grid">
            <WorkCard
              v-for="work in rows"
              :key="work.id"
              :work="work"
              :browse-path="route.fullPath"
            />
          </div>
        </template>
        <WorkPagination
          v-if="!error"
          :page="query.page || 1"
          :total="total"
          :loading="loading"
          @change="changePage"
        />
      </section>
    </div>
  </WorkLayout>
</template>
