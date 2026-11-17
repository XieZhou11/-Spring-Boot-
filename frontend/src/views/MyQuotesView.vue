<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import CreatorLayout from '@/layouts/CreatorLayout.vue'
import WorkLayout from '@/layouts/WorkLayout.vue'
import QuoteRecord from '@/components/QuoteRecord.vue'
import WorkPagination from '@/components/WorkPagination.vue'
import { getMyQuotes, getQuoteQuota } from '@/api/quote'
import type { QuoteQuotaVO, QuoteVO } from '@/types/quote'
import { quoteStatus } from '@/utils/quote'
import { useAuthStore } from '@/stores/auth'
import '@/assets/styles/custom-request.css'
import '@/assets/styles/quote.css'
const rows = ref<QuoteVO[]>([]); const quota = ref<QuoteQuotaVO>(); const status = ref(''); const page = ref(1); const total = ref(0); const error = ref(''); const loading = ref(false)
const auth = useAuthStore(); const canCreateQuote = computed(() => auth.session?.roles.includes('CREATOR'))
let revision = 0
/** 历史报价以本人资源查询，不读取或推断其他创作者的方案。 */
async function load(next = page.value) {
  const current = ++revision; page.value = next; loading.value = true; error.value = ''
  try {
    const [result, limits] = await Promise.all([getMyQuotes({ status: status.value || undefined, page: next }), getQuoteQuota()])
    if (current !== revision) return
    rows.value = result.items; total.value = result.total; quota.value = limits
  } catch (failure) { if (current === revision) error.value = failure instanceof Error ? failure.message : '报价读取失败' }
  finally { if (current === revision) loading.value = false }
}
function refresh() { void load() }
onMounted(() => { refresh(); window.addEventListener('quote-updated', refresh); window.addEventListener('focus', refresh) })
onBeforeUnmount(() => { revision++; window.removeEventListener('quote-updated', refresh); window.removeEventListener('focus', refresh) })
</script>
<template>
  <component :is="canCreateQuote ? CreatorLayout : WorkLayout">
    <header class="work-section-heading">
      <div>
        <p class="eyebrow">
          YOUR PROPOSALS
        </p><h1>我的报价</h1><p class="muted">
          每一份方案，都有完整的记录。
        </p>
      </div><span
        v-if="quota"
        class="muted"
      >今日已提交 {{ quota.used }} / {{ quota.limit }} 次</span>
    </header>
    <form
      class="request-filters"
      @submit.prevent="load(1)"
    >
      <label>报价状态<select
        v-model="status"
        aria-label="报价状态"
        @change="load(1)"
      ><option value="">全部状态</option><option
        v-for="(label, value) in quoteStatus"
        :key="value"
        :value="value"
      >{{ label }}</option></select></label><button
        class="button-secondary"
        :disabled="loading"
      >
        刷新报价
      </button><RouterLink
        v-if="canCreateQuote"
        to="/requests"
      >寻找需求 ↗</RouterLink>
    </form>
    <p
      v-if="error"
      class="form-alert"
      role="alert"
    >
      {{ error }}
    </p><p
      v-if="loading && !rows.length"
      role="status"
    >
      正在读取报价…
    </p><div
      v-else-if="!rows.length && !error"
      class="creator-empty"
    >
      <h2>暂无报价记录</h2><p>{{ canCreateQuote ? '从需求大厅或收到的邀约中提交制作方案。' : '本人提交过的报价会保留在这里。' }}</p>
    </div>
    <QuoteRecord
      v-for="quote in rows"
      :key="quote.id"
      :quote="quote"
      show-request
      @changed="refresh"
    /><WorkPagination
      :page="page"
      :total="total"
      :loading="loading"
      @change="load"
    />
  </component>
</template>
